from pydantic import BaseModel, UUID4
from typing import Optional, Dict, Any
from datetime import datetime

class BotBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: Optional[bool] = True

class BotCreate(BotBase):
    avatar_url: Optional[str] = None
    config: Optional[Dict[str, Any]] = {}

class BotUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class Bot(BotBase):
    id: UUID4
    tenant_id: UUID4
    avatar_url: Optional[str] = None
    config: Dict[str, Any]
    api_key: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
