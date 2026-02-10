from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import uuid
from uuid import UUID
import secrets
import logging

from app.api import deps
from app.models.bot import Bot as BotModel
from app.models.document import Document as DocumentModel
from app.models.user import User
from app.schemas.bot import Bot, BotCreate, BotUpdate
from app.schemas.document import Document
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.openrouter_rag_service import get_openrouter_rag_service

logger = logging.getLogger(__name__)

# Initialize the correct RAG service
rag_service = get_openrouter_rag_service()
router = APIRouter()

@router.get("/", response_model=List[Bot])
def read_bots(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Get all bots for current user's tenant"""
    bots = db.query(BotModel).filter(
        BotModel.tenant_id == current_user.tenant_id
    ).offset(skip).limit(limit).all()
    return bots

@router.post("/", response_model=Bot, status_code=201)
def create_bot(
    bot_in: BotCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Create a new bot for current user's tenant"""
    bot = BotModel(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        **bot_in.model_dump(),
        api_key=secrets.token_urlsafe(32),  # Generate API key
    )
    db.add(bot)
    db.commit()
    db.refresh(bot)
    return bot

@router.get("/{bot_id}", response_model=Bot)
def read_bot(
    bot_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Get a specific bot"""
    try:
        bot_uuid = UUID(bot_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid bot ID format")
    
    bot = db.query(BotModel).filter(
        BotModel.id == bot_uuid,
        BotModel.tenant_id == current_user.tenant_id
    ).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    return bot

@router.put("/{bot_id}", response_model=Bot)
def update_bot(
    bot_id: str,
    bot_in: BotUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Update a bot"""
    try:
        bot_uuid = UUID(bot_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid bot ID format")
    
    bot = db.query(BotModel).filter(
        BotModel.id == bot_uuid,
        BotModel.tenant_id == current_user.tenant_id
    ).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    
    update_data = bot_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(bot, field, value)
    
    db.add(bot)
    db.commit()
    db.refresh(bot)
    return bot

@router.delete("/{bot_id}", status_code=204)
def delete_bot(
    bot_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Delete a bot"""
    try:
        bot_uuid = UUID(bot_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid bot ID format")
    
    bot = db.query(BotModel).filter(
        BotModel.id == bot_uuid,
        BotModel.tenant_id == current_user.tenant_id
    ).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    
    db.delete(bot)
    db.commit()
    return None

@router.post("/{bot_id}/documents", response_model=Document)
async def upload_document(
    bot_id: str,
    file: UploadFile = File(...),
    chunking_strategy: str = "recursive",  # or "semantic"
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Upload a document to a bot's knowledge base with advanced processing"""
    try:
        bot_uuid = UUID(bot_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid bot ID format")
    
    bot = db.query(BotModel).filter(
        BotModel.id == bot_uuid,
        BotModel.tenant_id == current_user.tenant_id
    ).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    # Use OpenRouter RAG service for ingestion
    try:
        ingest_stats = await rag_service.ingest_file(
            file, 
            str(bot_id),
            chunking_strategy=chunking_strategy
        )
        num_chunks = ingest_stats.get("chunks_created", 0)
    except Exception as e:
        logger.error(f"Failed to process document {file.filename} for bot {bot_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")

    # Save to DB
    doc = DocumentModel(
        id=uuid.uuid4(),
        bot_id=bot_uuid,
        filename=file.filename,
        file_type=file.content_type or "text/plain",
        status="completed",
        doc_metadata={"num_chunks": num_chunks, "chunking_strategy": chunking_strategy}
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    return doc

@router.get("/{bot_id}/documents", response_model=List[Document])
def list_documents(
    bot_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """List all documents for a bot"""
    try:
        bot_uuid = UUID(bot_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid bot ID format")
    
    bot = db.query(BotModel).filter(
        BotModel.id == bot_uuid,
        BotModel.tenant_id == current_user.tenant_id
    ).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    
    documents = db.query(DocumentModel).filter(
        DocumentModel.bot_id == bot_uuid
    ).all()
    return documents

@router.delete("/{bot_id}/documents/{doc_id}", status_code=204)
def delete_document(
    bot_id: str,
    doc_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Delete a document"""
    try:
        bot_uuid = UUID(bot_id)
        doc_uuid = UUID(doc_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")
    
    bot = db.query(BotModel).filter(
        BotModel.id == bot_uuid,
        BotModel.tenant_id == current_user.tenant_id
    ).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    
    doc = db.query(DocumentModel).filter(
        DocumentModel.id == doc_uuid,
        DocumentModel.bot_id == bot_uuid
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    db.delete(doc)
    db.commit()
    return None

@router.post("/{bot_id}/chat", response_model=ChatResponse)
async def chat_with_bot(
    bot_id: str,
    chat_in: ChatRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Chat with bot using advanced RAG with caching and optimizations"""
    try:
        bot_uuid = UUID(bot_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid bot ID format")
    
    bot = db.query(BotModel).filter(
        BotModel.id == bot_uuid,
        BotModel.tenant_id == current_user.tenant_id
    ).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    # Use OpenRouter RAG with conversation history
    conversation_history = chat_in.history if hasattr(chat_in, 'history') else []
    session_id = chat_in.session_id if hasattr(chat_in, 'session_id') else None
    
    result = await rag_service.chat(
        bot_id=str(bot_id),
        query=chat_in.message,
        bot_config=bot.config or {},
        conversation_history=conversation_history,
        session_id=session_id
    )
    
    return ChatResponse(
        response=result["response"],
        sources=list(set(result.get("sources", []))) # deduplicate sources
    )
