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
    4. Store in Qdrant
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
            
            # Process document with OpenRouter RAG service
            rag_service = get_openrouter_rag_service()
            ingest_result = rag_service.process_file_sync(
                tmp_file_path,
                bot_id,
                filename,
                chunking_strategy=chunking_strategy
            )
            num_chunks = ingest_result.get("chunks_created", 0)

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
        
        # Safely update status in DB
        try:
            _update_document_status(document_id, status="failed", error_message=error_msg)
        except Exception as db_err:
            logger.error(f"Failed to update document status for {document_id}: {db_err}")

        # Return simple dict to avoid pickling complex Exception objects
        return {
            'status': 'failed',
            'document_id': document_id,
            'error': error_msg
        }


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
