from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
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
    bot = db.execute(
        select(BotModel).where(BotModel.id == bot_uuid, BotModel.tenant_id == current_user.tenant_id)
    ).scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    # Check parent folder if provided
    if folder_in.parent_id:
        parent = db.execute(
            select(FolderModel).where(
                FolderModel.id == folder_in.parent_id,
                FolderModel.bot_id == bot_uuid,
            )
        ).scalar_one_or_none()
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
    bot = db.execute(
        select(BotModel).where(BotModel.id == bot_uuid, BotModel.tenant_id == current_user.tenant_id)
    ).scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    stmt = select(FolderModel).where(FolderModel.bot_id == bot_uuid)

    if parent_id:
        try:
            parent_uuid = UUID(parent_id)
            stmt = stmt.where(FolderModel.parent_id == parent_uuid)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid parent ID format")

    return db.execute(stmt).scalars().all()

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

    folder = db.execute(
        select(FolderModel).join(BotModel).where(
            FolderModel.id == folder_uuid,
            BotModel.tenant_id == current_user.tenant_id,
        )
    ).scalar_one_or_none()
    
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    # Update logic
    update_data = folder_in.model_dump(exclude_unset=True)
    
    # The folder being edited is tenant-checked above, but the *new* parent was
    # not. Re-parenting under another tenant's folder was accepted by the FK,
    # and since the relationship cascades on delete, that tenant deleting their
    # own folder would silently destroy this one.
    if 'parent_id' in update_data and update_data['parent_id']:
        if update_data['parent_id'] == folder.id:
            raise HTTPException(status_code=400, detail="Cannot set folder as its own parent")

        parent = db.execute(
            select(FolderModel).where(
                FolderModel.id == update_data['parent_id'],
                FolderModel.bot_id == folder.bot_id,  # same bot ⇒ same tenant
            )
        ).scalar_one_or_none()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent folder not found")

        # Walk the ancestor chain so a cycle cannot be created.
        seen = {folder.id}
        cursor = parent
        while cursor is not None:
            if cursor.id in seen:
                raise HTTPException(status_code=400, detail="Circular folder hierarchy")
            seen.add(cursor.id)
            cursor = cursor.parent

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

    folder = db.execute(
        select(FolderModel).join(BotModel).where(
            FolderModel.id == folder_uuid,
            BotModel.tenant_id == current_user.tenant_id,
        )
    ).scalar_one_or_none()
    
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    # DB cascade handles deletion, but we might want to check for documents
    # Current behavior: Documents set to NULL folder_id (ondelete="SET NULL" in model)
    # If we want to delete documents inside, we need to change model or do it manually
    # Let's keep documents and move them to root (or trash)
    
    db.delete(folder)
    db.commit()
    return None
