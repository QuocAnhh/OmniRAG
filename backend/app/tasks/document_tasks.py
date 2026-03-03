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
    chunking_strategy: str = "recursive"
):
    """
    Background task to process document:
    1. Download from MinIO
    2. Extract text and chunk
    3. Generate embeddings
    4. Store in Qdrant  <- document marked 'completed' here, chat is available immediately
    5. Kick off LightRAG graph extraction as a separate background task (non-blocking)
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
            
            # Process document with OpenRouter RAG service (Qdrant vector indexing)
            rag_service = get_openrouter_rag_service()
            ingest_result = rag_service.process_file_sync(
                tmp_file_path,
                bot_id,
                filename,
                chunking_strategy=chunking_strategy
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
            # Runs independently in the background. Does NOT block chatting.
            # Only responsible for populating the Knowledge Graph visualization.
            try:
                documents = rag_service._load_document(tmp_file_path, filename)
                full_text = "\n\n".join([doc.page_content for doc in documents])
                if full_text.strip():
                    build_knowledge_graph_task.delay(bot_id=bot_id, full_text=full_text, filename=filename)
                    logger.info(f"Queued LightRAG knowledge graph task for bot={bot_id}, file={filename}")
            except Exception as e:
                logger.error(f"Failed to queue LightRAG task for {filename}: {e}")
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
def build_knowledge_graph_task(self, bot_id: str, full_text: str, filename: str):
    """
    Separate background Celery task for LightRAG entity/relationship extraction.
    Fires AFTER document is already 'completed' and chat is available.
    """
    logger.info(f"--- [START] LightRAG extraction task: bot={bot_id}, file={filename} ---")
    try:
        from app.services.lightrag_service import get_lightrag_service
        import asyncio
        
        # Ensure we have a clean event loop if we are in a worker environment
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        lightrag_service = get_lightrag_service(bot_id=bot_id)
        
        # Running the insert operation
        logger.info(f"[LightRAG] Calling insert_text for {filename}...")
        asyncio.run(lightrag_service.insert_text(full_text))
        
        logger.info(f"--- [SUCCESS] Knowledge graph completed: bot={bot_id}, file={filename} ---")
    except Exception as e:
        import traceback
        error_stack = traceback.format_exc()
        logger.error(f"[LightRAG] Graph extraction CRITICAL ERROR for {filename}: {e}\n{error_stack}")
        # Task remains in queue if task_acks_late is True elsewhere


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
