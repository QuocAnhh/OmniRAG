from pydantic import BaseModel, EmailStr, Field, UUID4
from typing import Annotated, Optional

# bcrypt silently truncates at 72 bytes, so the upper bound is a correctness
# guard as much as a limit — without it, two different long passwords sharing a
# 72-byte prefix authenticate interchangeably.
Password = Annotated[str, Field(min_length=12, max_length=128)]


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
    password: Password
    tenant_id: UUID4


class UserRegister(BaseModel):
    email: EmailStr
    password: Password
    full_name: Optional[str] = None
    tenant_name: str  # For creating a new tenant


class UserUpdate(UserBase):
    password: Optional[Password] = None


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
