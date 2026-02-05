from pydantic import BaseModel, EmailStr, UUID4
from typing import Optional, Dict, Any
from datetime import datetime


class TenantBase(BaseModel):
    name: str
    email: EmailStr
    plan: str = "free"


class TenantCreate(TenantBase):
    pass


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    plan: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class TenantInDB(TenantBase):
    id: UUID4
    settings: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class Tenant(TenantInDB):
    pass
