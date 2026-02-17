from pydantic import BaseModel, UUID4
from typing import Optional, List
from datetime import datetime

class FolderBase(BaseModel):
    name: str
    parent_id: Optional[UUID4] = None

class FolderCreate(FolderBase):
    pass

class FolderUpdate(FolderBase):
    name: Optional[str] = None

class Folder(FolderBase):
    id: UUID4
    bot_id: UUID4
    parent_id: Optional[UUID4] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class FolderTreeItem(Folder):
    children: List["FolderTreeItem"] = []
