import tempfile
import os
from pathlib import Path
from uuid import UUID
import logging
from app.worker import celery_app

logger = logging.getLogger(__name__)
from app.services.openrouter_rag_service import get_openrouter_rag_service
from app.services.storage_service import storage_service
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
        # Update status to processing
        self.update_state(state='PROCESSING', meta={'status': 'Downloading file'})
        _update_document_status(document_id, status="processing")
        
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
            loaded_documents = rag_service._load_document(tmp_file_path, filename)

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
            )
            num_chunks = ingest_result.get("chunks_created", 0)

            # Mark document as 'completed' immediately after Qdrant indexing.
            # Users can now chat with the bot right away — no need to wait for graph!
            _update_document_status(
                document_id,
                status="completed",
                doc_metadata={
                    "num_chunks": num_chunks,
                    "chunking_strategy": chunking_strategy,
                    "processing_time": ingest_result.get("processing_time"),
                    "preview": ingest_result.get("preview"),
                    "model": ingest_result.get("model_used")
                },
                error_message=None
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
                
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error processing document {document_id}: {error_msg}")
        
        try:
            _update_document_status(document_id, status="failed", error_message=error_msg)
        except Exception as db_err:
            logger.error(f"Failed to update document status for {document_id}: {db_err}")

        return {
            'status': 'failed',
            'document_id': document_id,
            'error': error_msg
        }


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

        # Running the insert operation
        logger.info(f"[LightRAG] Calling insert_text for {filename}...")
        asyncio.run(lightrag_service.insert_text(full_text))

        if document_id:
            _update_kg_status(document_id, "completed")

        logger.info(f"--- [SUCCESS] Knowledge graph completed: bot={bot_id}, file={filename} ---")
    except Exception as e:
        import traceback
        error_stack = traceback.format_exc()
        logger.error(f"[LightRAG] Graph extraction CRITICAL ERROR for {filename}: {e}\n{error_stack}")
        if document_id:
            _update_kg_status(document_id, "failed")


def _update_document_status(
    document_id: str,
    status: str,
    doc_metadata: dict | None = None,
    error_message: str | None = None,
):
    db = SessionLocal()
    try:
        doc_uuid = UUID(document_id)
        doc = db.query(DocumentModel).filter(DocumentModel.id == doc_uuid).first()
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
        db.close()


def _update_kg_status(document_id: str, kg_status: str):
    """Update only the kg_status field inside doc_metadata without touching the main status."""
    db = SessionLocal()
    try:
        doc_uuid = UUID(document_id)
        doc = db.query(DocumentModel).filter(DocumentModel.id == doc_uuid).first()
        if not doc:
            return
        doc.doc_metadata = {**(doc.doc_metadata or {}), "kg_status": kg_status}
        db.add(doc)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to update kg_status for {document_id}: {e}")
    finally:
        db.close()
