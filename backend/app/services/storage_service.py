from minio import Minio
from minio.error import S3Error
from io import BytesIO
from typing import BinaryIO
import uuid
from app.core.config import settings


class StorageService:
    def __init__(self):
        self.client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE
        )
        self._ensure_bucket()
    
    def _ensure_bucket(self):
        """Ensure bucket exists"""
        try:
            if not self.client.bucket_exists(settings.MINIO_BUCKET):
                self.client.make_bucket(settings.MINIO_BUCKET)
                print(f"Created MinIO bucket: {settings.MINIO_BUCKET}")
        except S3Error as e:
            print(f"Error creating bucket: {e}")
    
    def upload_file(self, file: BinaryIO, filename: str, content_type: str = "application/octet-stream") -> str:
        """
        Upload file to MinIO and return the object path
        """
        # Generate unique filename
        file_id = str(uuid.uuid4())
        object_name = f"documents/{file_id}/{filename}"
        
        # Get file size
        file.seek(0, 2)  # Seek to end
        file_size = file.tell()
        file.seek(0)  # Seek back to beginning
        
        try:
            self.client.put_object(
                settings.MINIO_BUCKET,
                object_name,
                file,
                file_size,
                content_type=content_type
            )
            return object_name
        except S3Error as e:
            raise Exception(f"Failed to upload file: {e}")
    
    def download_file(self, object_name: str) -> bytes:
        """Download file from MinIO"""
        try:
            response = self.client.get_object(settings.MINIO_BUCKET, object_name)
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except S3Error as e:
            raise Exception(f"Failed to download file: {e}")
    
    def delete_file(self, object_name: str):
        """Delete file from MinIO"""
        try:
            self.client.remove_object(settings.MINIO_BUCKET, object_name)
        except S3Error as e:
            raise Exception(f"Failed to delete file: {e}")
    
    def get_file_url(self, object_name: str, expires_in_seconds: int = 3600) -> str:
        """Get presigned URL for file"""
        try:
            url = self.client.presigned_get_object(
                settings.MINIO_BUCKET,
                object_name,
                expires=expires_in_seconds
            )
            return url
        except S3Error as e:
            raise Exception(f"Failed to generate URL: {e}")


storage_service = StorageService()
