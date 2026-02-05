import tempfile
import os
from pathlib import Path
from app.worker import celery_app
from app.services.rag_service import rag_service
from app.services.storage_service import storage_service


@celery_app.task(bind=True, name="process_document")
def process_document_task(self, document_id: str, bot_id: str, file_path: str):
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
        
        # Download file from MinIO
        file_data = storage_service.download_file(file_path)
        
        # Get file extension from path
        file_ext = Path(file_path).suffix
        
        # Create temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
            tmp_file.write(file_data)
            tmp_file_path = tmp_file.name
        
        try:
            self.update_state(state='PROCESSING', meta={'status': 'Processing document'})
            
            # Process document with RAG service
            num_chunks = rag_service.process_file_sync(tmp_file_path, bot_id)
            
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
        self.update_state(state='FAILURE', meta={'error': str(e)})
        return {
            'status': 'failed',
            'document_id': document_id,
            'error': str(e)
        }
