from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from uuid import UUID

from app.api import deps
from app.models.user import User
from app.models.bot import Bot as BotModel
from app.models.folder import Folder as FolderModel
from app.models.document import Document as DocumentModel
from app.schemas.folder import Folder, FolderCreate, FolderUpdate

router = APIRouter()

@router.post("/", response_model=Folder, status_code=201)
def create_folder(
    folder_in: FolderCreate,
    bot_id: str = Query(..., description="ID of the bot to create folder for"),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Create a new folder"""
    try:
        bot_uuid = UUID(bot_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid bot ID format")

    # Check bot access
    bot = db.query(BotModel).filter(
        BotModel.id == bot_uuid,
        BotModel.tenant_id == current_user.tenant_id
    ).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
        
    # Check parent folder if provided
    if folder_in.parent_id:
        parent = db.query(FolderModel).filter(
            FolderModel.id == folder_in.parent_id,
            FolderModel.bot_id == bot_uuid
        ).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent folder not found")

    folder = FolderModel(
        id=uuid.uuid4(),
        bot_id=bot_uuid,
        **folder_in.model_dump()
    )
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return folder

@router.get("/", response_model=List[Folder])
def list_folders(
    bot_id: str = Query(..., description="ID of the bot to list folders for"),
    parent_id: Optional[str] = Query(None, description="Filter by parent folder ID"),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """List folders for a bot"""
    try:
        bot_uuid = UUID(bot_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid bot ID format")
        
    # Check bot access
    bot = db.query(BotModel).filter(
        BotModel.id == bot_uuid,
        BotModel.tenant_id == current_user.tenant_id
    ).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    query = db.query(FolderModel).filter(FolderModel.bot_id == bot_uuid)
    
    if parent_id:
        try:
            parent_uuid = UUID(parent_id)
            query = query.filter(FolderModel.parent_id == parent_uuid)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid parent ID format")
    else:
        # If no parent_id specified, behavior depends on frontend needs
        # Usually we want root folders (parent_id is NULL)
        # But let's allow fetching all if needed, or filter by None
        # For tree view, usually fetching all is better properly ordered
        pass 
        
    return query.all()

@router.put("/{folder_id}", response_model=Folder)
def update_folder(
    folder_id: str,
    folder_in: FolderUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Update a folder"""
    try:
        folder_uuid = UUID(folder_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid folder ID format")

    folder = db.query(FolderModel).join(BotModel).filter(
        FolderModel.id == folder_uuid,
        BotModel.tenant_id == current_user.tenant_id
    ).first()
    
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    # Update logic
    update_data = folder_in.model_dump(exclude_unset=True)
    
    # Validation loop check if parent_id changed
    if 'parent_id' in update_data and update_data['parent_id']:
        if update_data['parent_id'] == folder.id:
            raise HTTPException(status_code=400, detail="Cannot set folder as its own parent")
            
        # Also check circular dependency (simplified for now)
        # In production would need recursive check
        
    for field, value in update_data.items():
        setattr(folder, field, value)

    db.add(folder)
    db.commit()
    db.refresh(folder)
    return folder

@router.delete("/{folder_id}", status_code=204)
def delete_folder(
    folder_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Delete a folder and cascade delete subfolders/content logic"""
    try:
        folder_uuid = UUID(folder_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid folder ID format")

    folder = db.query(FolderModel).join(BotModel).filter(
        FolderModel.id == folder_uuid,
        BotModel.tenant_id == current_user.tenant_id
    ).first()
    
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    # DB cascade handles deletion, but we might want to check for documents
    # Current behavior: Documents set to NULL folder_id (ondelete="SET NULL" in model)
    # If we want to delete documents inside, we need to change model or do it manually
    # Let's keep documents and move them to root (or trash)
    
    db.delete(folder)
    db.commit()
    return None
