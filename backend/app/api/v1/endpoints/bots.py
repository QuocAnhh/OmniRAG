from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import uuid
from uuid import UUID
import secrets
from pathlib import Path
import logging
import json

from pydantic import BaseModel
from app.api import deps
from app.models.bot import Bot as BotModel
from app.models.document import Document as DocumentModel
from app.models.user import User
from app.schemas.bot import Bot, BotCreate, BotUpdate
from app.schemas.document import Document
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.openrouter_rag_service import get_openrouter_rag_service
from app.services.storage_service import storage_service
from app.tasks.document_tasks import process_document_task

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

    # Upload file to MinIO
    try:
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)
        file_path = storage_service.upload_file(
            file.file,
            file.filename,
            content_type=file.content_type or "application/octet-stream"
        )
    except Exception as e:
        logger.error(f"Failed to upload document {file.filename} to storage: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to upload document: {str(e)}")

    # Save to DB (processing)
    doc = DocumentModel(
        id=uuid.uuid4(),
        bot_id=bot_uuid,
        filename=file.filename,
        file_type=file.content_type or "text/plain",
        file_size=file_size,
        file_path=file_path,
        status="processing",
        doc_metadata={"chunking_strategy": chunking_strategy}
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Enqueue background processing
    process_document_task.delay(
        str(doc.id),
        str(bot_id),
        file_path,
        file.filename,
        chunking_strategy
    )
    
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
    """Delete a document and its vectors from both DB and Qdrant"""
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
    
    # DELETE VECTORS FROM QDRANT FIRST (Critical fix!)
    try:
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        
        rag_service.qdrant_client.delete(
            collection_name=rag_service.collection_name,
            points_selector=Filter(
                must=[
                    FieldCondition(
                        key="bot_id",
                        match=MatchValue(value=str(bot_id))
                    ),
                    FieldCondition(
                        key="source",
                        match=MatchValue(value=doc.filename)
                    )
                ]
            )
        )
        logger.info(f"Deleted vectors for document {doc.filename} from Qdrant")
    except Exception as e:
        logger.error(f"Failed to delete vectors from Qdrant: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete document vectors: {str(e)}"
        )
    
    # Then delete from PostgreSQL
    # Also delete file from storage if present
    if doc.file_path:
        try:
            storage_service.delete_file(doc.file_path)
        except Exception as e:
            logger.warning(f"Failed to delete file from storage for doc {doc.id}: {e}")

    db.delete(doc)
    db.commit()
    
    # Invalidate cache for this bot
    try:
        rag_service.invalidate_bot_cache(str(bot_id))
    except Exception as e:
        logger.warning(f"Cache invalidation failed: {e}")
    
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
    conversation_history = [m.model_dump() for m in chat_in.history] if chat_in.history else []
    session_id = chat_in.session_id if hasattr(chat_in, 'session_id') else None
    
    # Pass current user ID to bot_config for logging
    bot_config = bot.config or {}
    bot_config["user_id"] = str(current_user.id)
    
    result = await rag_service.chat(
        bot_id=str(bot_id),
        query=chat_in.message,
        bot_config=bot_config,
        conversation_history=conversation_history,
        session_id=session_id
    )
    
    
    return ChatResponse(
        message_id=str(uuid.uuid4()),
        response=result["response"],
        sources=list(set(result.get("sources", []))), # deduplicate sources
        retrieved_chunks=result.get("retrieved_chunks", []),
        session_id=session_id,
        system_prompt=result.get("system_prompt")
    )

@router.post("/{bot_id}/chat-stream")
async def chat_with_bot_stream(
    bot_id: str,
    chat_in: ChatRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Chat with bot using streaming advanced RAG"""
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

    conversation_history = [m.model_dump() for m in chat_in.history] if chat_in.history else []
    session_id = chat_in.session_id if hasattr(chat_in, 'session_id') else None
    
    # Pass current user ID to bot_config for logging
    bot_config = bot.config or {}
    bot_config["user_id"] = str(current_user.id)
    
    async def event_generator():
        try:
            async for chunk in rag_service.chat_stream(
                bot_id=str(bot_id),
                query=chat_in.message,
                bot_config=bot_config,
                conversation_history=conversation_history,
                session_id=session_id
            ):
                yield f"data: {json.dumps(chunk)}\n\n"
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/{bot_id}/history", response_model=List[Dict[str, Any]])
async def get_bot_chat_history(
    bot_id: str,
    session_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Get chat history for a specific bot and optional session"""
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
        
    history = await rag_service.get_chat_history(
        bot_id=str(bot_id),
        user_id=str(current_user.id),
        session_id=session_id,
        limit=limit
    )
    return history


@router.get("/{bot_id}/sessions", response_model=List[Dict[str, Any]])
async def get_bot_sessions(
    bot_id: str,
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Get all chat sessions for a specific bot and current user"""
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
        
    sessions = await rag_service.get_sessions(
        bot_id=str(bot_id),
        user_id=str(current_user.id),
        limit=limit
    )
    return sessions


@router.delete("/{bot_id}/sessions/{session_id}", status_code=204)
async def delete_bot_session(
    bot_id: str,
    session_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Delete a specific chat session for a bot"""
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
        
    success = await rag_service.delete_session(
        bot_id=str(bot_id),
        session_id=session_id,
        user_id=str(current_user.id)
    )
    if not success:
        raise HTTPException(status_code=404, detail="Session not found or could not be deleted")
        
    return None


@router.delete("/{bot_id}/history", status_code=204)
async def clear_bot_history(
    bot_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Clear all chat history/sessions for a bot"""
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
        
    await rag_service.clear_all_history(
        bot_id=str(bot_id),
        user_id=str(current_user.id)
    )
    
    return None

class PromptGenerationRequest(BaseModel):
    name: str
    description: str
    bot_id: Optional[str] = None

@router.post("/generate-prompt", response_model=Dict[str, str])
async def generate_bot_prompt(
    request: PromptGenerationRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Generate a high-quality system prompt based on bot name, description, and available documents"""
    
    # Context gathering
    doc_context = ""
    if request.bot_id:
        try:
            bot_uuid = UUID(request.bot_id)
            documents = db.query(DocumentModel).filter(
                DocumentModel.bot_id == bot_uuid,
                DocumentModel.tenant_id == current_user.tenant_id if hasattr(DocumentModel, 'tenant_id') else True # Safety check if tenant_id exists on Doc
            ).all()
            
            if documents:
                file_types = list(set([Path(doc.filename).suffix for doc in documents]))
                doc_context = f"\n\nContextual Information:\nThe agent has access to a Knowledge Base containing files with types: {', '.join(file_types)}."
                doc_context += "\nInstruction: The generated prompt must be generic and refer to 'the provided knowledge base' or 'retrieved context' rather than listing specific filenames."
        except Exception as e:
            logger.warning(f"Could not fetch documents for context: {e}")

    meta_prompt = f"""You are an expert Prompt Engineer. Your goal is to write a professional, effective System Prompt for an AI Agent.
    
    Agent Name: {request.name}
    Agent Description: {request.description}{doc_context}
    
    Task: Write a concise but comprehensive System Prompt (max 200 words) that defines this agent's persona, role, and constraints.
    - Use clear instructions.
    - Define the tone (professional yet helpful).
    - IMPORTANT: DO NOT mention specific filenames or titles in the prompt. 
    - Use generic terms like "the provided knowledge base", "contextual information", or "attached documents".
    - Explicitly instruct the agent to PRIORITIZE using its knowledge base to answer user queries.
    - Ensure the prompt remains valid even if the user uploads new, different documents to the knowledge base later.
    - The output should contain THE SYSTEM PROMPT ONLY. Do not add explanations."""

    try:
        # We use a lightweight model for this utility task to be fast and cheap
        messages = [{"role": "user", "content": meta_prompt}]
        
        # Accessing the internal openrouter service directly for valid lightweight generation
        # We can reuse rag_service.openrouter.chat_completion
        response = rag_service.openrouter.chat_completion(
            messages=messages,
            model="openai/gpt-4o-mini", # Fast and capable enough
            temperature=0.7
        )
        
        return {"system_prompt": response["content"]}
    except Exception as e:
        logger.error(f"Failed to generate prompt: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate prompt")

