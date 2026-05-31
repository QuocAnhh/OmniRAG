import tempfile
import os
import json
from pathlib import Path
from uuid import UUID
import logging
from datetime import datetime
from app.worker import celery_app

logger = logging.getLogger(__name__)
from app.services.openrouter_rag_service import get_openrouter_rag_service
from app.services.storage_service import storage_service
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.document import Document as DocumentModel
# Import all related models to ensure SQLAlchemy registry is populated
from app.models.bot import Bot
from app.models.folder import Folder
from app.models.tenant import Tenant
from app.models.user import User


@celery_app.task(bind=True, name="process_document")
def process_document_task(
    self,
    document_id: str,
    bot_id: str,
    file_path: str,
    filename: str,
    chunking_strategy: str = "recursive",
    enable_knowledge_graph: bool = False,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
    enrich_picture_description: bool = False,
):
    """
    Background task to process document:
    1. Download from MinIO
    2. Extract text and chunk
    3. Generate embeddings
    4. Store in Qdrant  <- document marked 'completed' here, chat is available immediately
    5. Optionally kick off LightRAG graph extraction (only if enable_knowledge_graph=True)
    """
    try:
        # Reuse a single DB session across all status updates for this task
        db = SessionLocal()

        # Update status to processing
        self.update_state(state='PROCESSING', meta={'status': 'Downloading file'})
        _update_document_status(document_id, status="processing", _session=db)

        # Download file from MinIO
        file_data = storage_service.download_file(file_path)

        # Get file extension
        file_ext = Path(filename).suffix

        # Create temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
            tmp_file.write(file_data)
            tmp_file_path = tmp_file.name

        try:
            self.update_state(state='PROCESSING', meta={'status': 'Processing document'})

            rag_service = get_openrouter_rag_service()

            # Load document ONCE — reuse for both Qdrant indexing and LightRAG
            # to avoid parsing the file twice when knowledge graph is enabled.
            loaded_documents = rag_service._load_document(
                tmp_file_path, filename,
                enrich_picture_description=enrich_picture_description,
            )

            # Extract full text now (cheap, in-memory) if KG will need it later
            full_text = (
                "\n\n".join([doc.page_content for doc in loaded_documents])
                if enable_knowledge_graph else ""
            )

            # Process document with OpenRouter RAG service (Qdrant vector indexing)
            # Pass pre-loaded documents to skip a second _load_document call inside.
            ingest_result = rag_service.process_file_sync(
                tmp_file_path,
                bot_id,
                filename,
                chunking_strategy=chunking_strategy,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                preloaded_documents=loaded_documents,
                document_id=document_id,
            )
            num_chunks = ingest_result.get("chunks_created", 0)

            # Mark document as 'completed' immediately after Qdrant indexing.
            _update_document_status(
                document_id,
                status="completed",
                doc_metadata={
                    "num_chunks": num_chunks,
                    "chunking_strategy": chunking_strategy,
                    "enrich_picture_description": enrich_picture_description,
                    "processing_time": ingest_result.get("processing_time"),
                    "preview": ingest_result.get("preview"),
                    "model": ingest_result.get("model_used"),
                    "has_structured_json": loaded_documents[0].metadata.get("has_structured_json", False) if loaded_documents else False,
                },
                error_message=None,
                _session=db,
            )

            # --- Fire-and-forget: LightRAG Knowledge Graph (separate task) ---
            # Only runs if user explicitly opted in via enable_knowledge_graph=True.
            # Runs independently in the background. Does NOT block chatting.
            # Uses full_text already extracted above — no second file parse.
            if enable_knowledge_graph:
                try:
                    if full_text.strip():
                        build_knowledge_graph_task.delay(bot_id=bot_id, full_text=full_text, filename=filename, document_id=document_id)
                        logger.info(f"Queued LightRAG knowledge graph task for bot={bot_id}, file={filename}")
                except Exception as e:
                    logger.error(f"Failed to queue LightRAG task for {filename}: {e}")
            else:
                logger.info(f"Knowledge graph skipped for bot={bot_id}, file={filename} (not enabled)")
            # -----------------------------------------------------------------

            return {
                'status': 'completed',
                'document_id': document_id,
                'num_chunks': num_chunks
            }
        finally:
            # Clean up temp file
            if os.path.exists(tmp_file_path):
                os.remove(tmp_file_path)
            db.close()
                
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error processing document {document_id}: {error_msg}")

        try:
            db = SessionLocal()
            _update_document_status(document_id, status="failed", error_message=error_msg, _session=db)
            db.close()
        except Exception as db_err:
            logger.error(f"Failed to update document status for {document_id}: {db_err}")

        return {
            'status': 'failed',
            'document_id': document_id,
            'error': error_msg
        }


def _sanitize_text_for_lightrag(text: str) -> str:
    """
    Sanitize text before LightRAG insertion to prevent JSONDecodeError.
    - Remove/replace problematic characters
    - Truncate extremely long lines
    - Fix malformed JSON snippets
    """
    import re

    if not text:
        return ""

    # Remove null bytes
    text = text.replace('\x00', '')

    # Remove control characters except newlines, tabs, carriage returns
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', text)

    # Truncate lines that are too long (can cause LLM output issues)
    lines = text.split('\n')
    max_line_length = 10000
    truncated_lines = [line if len(line) <= max_line_length else line[:max_line_length] + '...[truncated]' for line in lines]
    text = '\n'.join(truncated_lines)

    # Limit total length (LightRAG works better with manageable chunks)
    max_length = 500000  # 500K chars
    if len(text) > max_length:
        text = text[:max_length] + '\n\n...[Document truncated for knowledge graph processing]'

    return text.strip()


@celery_app.task(bind=True, name="build_knowledge_graph")
def build_knowledge_graph_task(self, bot_id: str, full_text: str, filename: str, document_id: str = ""):
    """
    Separate background Celery task for LightRAG entity/relationship extraction.
    Fires AFTER document is already 'completed' and chat is available.
    Updates doc_metadata.kg_status at each stage so the frontend can poll progress.
    """
    logger.info(f"--- [START] LightRAG extraction task: bot={bot_id}, file={filename} ---")

    if document_id:
        _update_kg_status(document_id, "processing")

    try:
        from app.services.lightrag_service import get_lightrag_service
        import asyncio

        lightrag_service = get_lightrag_service(bot_id=bot_id)

        # Sanitize text before LightRAG processing
        sanitized_text = _sanitize_text_for_lightrag(full_text)
        logger.info(f"[LightRAG] Text sanitized: {len(full_text)} -> {len(sanitized_text)} chars")

        # Running the insert operation
        logger.info(f"[LightRAG] Calling insert_text for {filename}...")
        asyncio.run(lightrag_service.insert_text(sanitized_text))

        if document_id:
            _update_kg_status(document_id, "completed")

        logger.info(f"--- [SUCCESS] Knowledge graph completed: bot={bot_id}, file={filename} ---")

    except json.JSONDecodeError as e:
        # Specific handling for JSON parsing errors from LLM
        import json
        import traceback
        error_stack = traceback.format_exc()
        logger.error(f"[LightRAG] JSONDecodeError from LLM response for {filename}: {e}\n{error_stack}")

        if document_id:
            _update_kg_status(document_id, "failed",
                            error_msg=f"LLM returned malformed JSON: {str(e)}")

    except Exception as e:
        import traceback
        error_stack = traceback.format_exc()
        logger.error(f"[LightRAG] Graph extraction CRITICAL ERROR for {filename}: {e}\n{error_stack}")
        if document_id:
            _update_kg_status(document_id, "failed",
                            error_msg=f"{type(e).__name__}: {str(e)}")


def _resolve_reindex_chunk_config(bot: Bot, doc: DocumentModel) -> tuple[str, int, int, bool]:
    """Resolve the same chunking/enrichment settings used by normal uploads."""
    from app.services.domain_config import get_domain_profile

    bot_cfg = bot.config or {}
    meta = doc.doc_metadata or {}
    profile = get_domain_profile(bot_cfg.get("domain", "general"))
    strategy = meta.get("chunking_strategy") or bot_cfg.get("chunking_strategy") or profile.chunk_strategy
    chunk_size = meta.get("chunk_size") or bot_cfg.get("chunk_size") or profile.chunk_size
    chunk_overlap = meta.get("chunk_overlap") or bot_cfg.get("chunk_overlap") or profile.chunk_overlap
    enrich_picture_description = bool(bot_cfg.get("enrich_picture_description", False))
    return strategy, int(chunk_size), int(chunk_overlap), enrich_picture_description


def reindex_qdrant_v2(bot_id: str | None = None, limit: int | None = None) -> dict:
    """
    Rebuild completed documents into the configured RAG collection.

    This is intentionally additive: it does not delete the legacy v1 collection.
    """
    db = SessionLocal()
    processed = 0
    failed = 0
    failures: list[dict] = []
    try:
        query = select(DocumentModel).where(DocumentModel.status == "completed")
        if bot_id:
            query = query.where(DocumentModel.bot_id == UUID(bot_id))
        query = query.order_by(DocumentModel.created_at)
        if limit:
            query = query.limit(limit)

        docs = db.execute(query).scalars().all()
        rag_service = get_openrouter_rag_service()

        for doc in docs:
            try:
                bot = db.execute(select(Bot).where(Bot.id == doc.bot_id)).scalar_one_or_none()
                if not bot or not doc.file_path:
                    raise RuntimeError("Missing bot or file_path for reindex")

                strategy, chunk_size, chunk_overlap, enrich_picture_description = _resolve_reindex_chunk_config(bot, doc)
                file_data = storage_service.download_file(doc.file_path)
                file_ext = Path(doc.filename).suffix

                with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
                    tmp_file.write(file_data)
                    tmp_file_path = tmp_file.name

                try:
                    loaded_documents = rag_service._load_document(
                        tmp_file_path,
                        doc.filename,
                        enrich_picture_description=enrich_picture_description,
                    )
                    result = rag_service.process_file_sync(
                        tmp_file_path,
                        str(doc.bot_id),
                        doc.filename,
                        chunking_strategy=strategy,
                        chunk_size=chunk_size,
                        chunk_overlap=chunk_overlap,
                        preloaded_documents=loaded_documents,
                        document_id=str(doc.id),
                    )
                finally:
                    if os.path.exists(tmp_file_path):
                        os.remove(tmp_file_path)

                doc.doc_metadata = {
                    **(doc.doc_metadata or {}),
                    "reindex_status": "completed",
                    "reindex_collection": rag_service.collection_name,
                    "reindexed_at": datetime.utcnow().isoformat(),
                    "reindex_chunks": result.get("chunks_created", 0),
                }
                db.add(doc)
                db.commit()
                processed += 1
            except Exception as e:
                failed += 1
                failures.append({"document_id": str(doc.id), "filename": doc.filename, "error": str(e)})
                doc.doc_metadata = {
                    **(doc.doc_metadata or {}),
                    "reindex_status": "failed",
                    "reindex_error": str(e),
                }
                db.add(doc)
                db.commit()
                logger.error(f"Reindex failed for document {doc.id}: {e}")

        if bot_id:
            rag_service.invalidate_bot_cache(bot_id)
        return {
            "status": "completed" if failed == 0 else "partial",
            "collection": rag_service.collection_name,
            "processed": processed,
            "failed": failed,
            "failures": failures,
        }
    finally:
        db.close()


@celery_app.task(bind=True, name="reindex_qdrant_v2")
def reindex_qdrant_v2_task(self, bot_id: str | None = None, limit: int | None = None):
    return reindex_qdrant_v2(bot_id=bot_id, limit=limit)


def _update_document_status(
    document_id: str,
    status: str,
    doc_metadata: dict | None = None,
    error_message: str | None = None,
    _session=None,
):
    """Update document status. Reuses _session if provided (avoids per-call session creation)."""
    db = _session or SessionLocal()
    own_session = _session is None
    try:
        doc_uuid = UUID(document_id)
        doc = db.execute(select(DocumentModel).where(DocumentModel.id == doc_uuid)).scalar_one_or_none()
        if not doc:
            return
        doc.status = status
        if doc_metadata is not None:
            doc.doc_metadata = {**(doc.doc_metadata or {}), **doc_metadata}
        if error_message is not None:
            doc.error_message = error_message
        db.add(doc)
        db.commit()
    finally:
        if own_session:
            db.close()


def _update_kg_status(document_id: str, kg_status: str, error_msg: str | None = None):
    """Update only the kg_status field inside doc_metadata without touching the main status."""
    db = SessionLocal()
    try:
        doc_uuid = UUID(document_id)
        doc = db.execute(select(DocumentModel).where(DocumentModel.id == doc_uuid)).scalar_one_or_none()
        if not doc:
            return
        metadata = {**(doc.doc_metadata or {}), "kg_status": kg_status}
        if error_msg:
            metadata["kg_error"] = error_msg
        doc.doc_metadata = metadata
        db.add(doc)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to update kg_status for {document_id}: {e}")
    finally:
        db.close()
