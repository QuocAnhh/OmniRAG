from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
import secrets
import hashlib

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.core.security import get_password_hash

router = APIRouter()


# Schemas
class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


class APIKeyCreate(BaseModel):
    name: str
    description: Optional[str] = None


class APIKeyResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    key: Optional[str] = None  # Only returned on creation
    key_prefix: str
    created_at: datetime
    last_used_at: Optional[datetime]
    is_active: bool


@router.get("/me")
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
):
    """
    Get current user profile.
    """
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "tenant_id": str(current_user.tenant_id),
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
    }


@router.put("/me")
async def update_user_profile(
    profile_update: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update current user profile.
    Can update full_name, email, and password (with current password verification).
    """
    if profile_update.full_name:
        current_user.full_name = profile_update.full_name
    
    if profile_update.email:
        # Check if email is already taken by another user
        existing_user = db.query(User).filter(
            User.email == profile_update.email,
            User.id != current_user.id
        ).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        current_user.email = profile_update.email
    
    # Password change requires current password verification
    if profile_update.new_password:
        if not profile_update.current_password:
            raise HTTPException(
                status_code=400,
                detail="Current password is required to set a new password"
            )
        
        from app.core.security import verify_password
        if not verify_password(profile_update.current_password, current_user.hashed_password):
            raise HTTPException(status_code=400, detail="Incorrect current password")
        
        current_user.hashed_password = get_password_hash(profile_update.new_password)
    
    current_user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(current_user)
    
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "message": "Profile updated successfully"
    }


@router.get("/me/api-keys")
async def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List all API keys for the current user.
    Note: Full keys are never returned, only prefixes.
    """
    from app.db.mongodb import get_mongodb
    
    mongo_db = await get_mongodb()
    api_keys_collection = mongo_db.api_keys
    
    # Fetch API keys for this user
    keys = await api_keys_collection.find(
        {"user_id": str(current_user.id)},
        {"key_hash": 0}  # Never return the hash
    ).to_list(None)
    
    return [
        {
            "id": str(key["_id"]),
            "name": key.get("name"),
            "description": key.get("description"),
            "key_prefix": key.get("key_prefix"),
            "created_at": key.get("created_at"),
            "last_used_at": key.get("last_used_at"),
            "is_active": key.get("is_active", True)
        }
        for key in keys
    ]


@router.post("/me/api-keys")
async def create_api_key(
    api_key_data: APIKeyCreate,
    current_user: User = Depends(get_current_user),
):
    """
    Generate a new API key for the current user.
    The full key is only returned once at creation time.
    """
    from app.db.mongodb import get_mongodb
    
    # Generate secure API key
    api_key = f"omni_{secrets.token_urlsafe(32)}"
    key_prefix = api_key[:12] + "..."
    
    # Hash the key for storage
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    
    mongo_db = await get_mongodb()
    api_keys_collection = mongo_db.api_keys
    
    # Store in MongoDB
    key_doc = {
        "user_id": str(current_user.id),
        "tenant_id": str(current_user.tenant_id),
        "name": api_key_data.name,
        "description": api_key_data.description,
        "key_hash": key_hash,
        "key_prefix": key_prefix,
        "created_at": datetime.utcnow(),
        "last_used_at": None,
        "is_active": True
    }
    
    result = await api_keys_collection.insert_one(key_doc)
    
    return {
        "id": str(result.inserted_id),
        "name": api_key_data.name,
        "description": api_key_data.description,
        "key": api_key,  # Only returned on creation!
        "key_prefix": key_prefix,
        "created_at": key_doc["created_at"],
        "is_active": True,
        "message": "API key created successfully. Save it now - it won't be shown again!"
    }


@router.delete("/me/api-keys/{key_id}")
async def revoke_api_key(
    key_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Revoke (delete) an API key.
    """
    from app.db.mongodb import get_mongodb
    from bson import ObjectId
    
    mongo_db = await get_mongodb()
    api_keys_collection = mongo_db.api_keys
    
    # Verify the key belongs to the current user
    result = await api_keys_collection.delete_one({
        "_id": ObjectId(key_id),
        "user_id": str(current_user.id)
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="API key not found")
    
    return {"message": "API key revoked successfully"}


@router.patch("/me/api-keys/{key_id}/toggle")
async def toggle_api_key(
    key_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Toggle API key active status (enable/disable without deleting).
    """
    from app.db.mongodb import get_mongodb
    from bson import ObjectId
    
    mongo_db = await get_mongodb()
    api_keys_collection = mongo_db.api_keys
    
    # Find the key
    key = await api_keys_collection.find_one({
        "_id": ObjectId(key_id),
        "user_id": str(current_user.id)
    })
    
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Toggle active status
    new_status = not key.get("is_active", True)
    
    await api_keys_collection.update_one(
        {"_id": ObjectId(key_id)},
        {"$set": {"is_active": new_status}}
    )
    
    return {
        "message": f"API key {'enabled' if new_status else 'disabled'} successfully",
        "is_active": new_status
    }
