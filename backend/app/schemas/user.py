from pydantic import BaseModel, EmailStr, UUID4
from typing import Optional


# Token schemas
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenPayload(BaseModel):
    sub: Optional[str] = None


# User schemas
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: str = "member"


class UserCreate(UserBase):
    password: str
    tenant_id: UUID4


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    tenant_name: str  # For creating a new tenant


class UserUpdate(UserBase):
    password: Optional[str] = None


class UserInDB(UserBase):
    id: UUID4
    tenant_id: UUID4
    is_active: bool
    
    class Config:
        from_attributes = True


class User(UserInDB):
    pass


# Login schema
class UserLogin(BaseModel):
    email: EmailStr
    password: str
