from pydantic import BaseModel, UUID4
from typing import Optional, Dict, Any, List
from datetime import datetime

class DocumentBase(BaseModel):
    filename: str
    file_type: str

class DocumentCreate(DocumentBase):
    pass

class DocumentUpdate(BaseModel):
    folder_id: Optional[UUID4] = None
    tags: Optional[List[str]] = None

class Document(DocumentBase):
    id: UUID4
    bot_id: UUID4
    folder_id: Optional[UUID4] = None
    tags: Optional[List[str]] = []
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    status: str
    error_message: Optional[str] = None
    doc_metadata: Dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
