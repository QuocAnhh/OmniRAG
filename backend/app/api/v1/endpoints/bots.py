from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import uuid
from uuid import UUID
import secrets
from pathlib import Path
import logging
import json
from datetime import datetime, timezone

# ─── File upload constants ────────────────────────────────────────────────────
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".pptx", ".ppt", ".xlsx", ".xls", ".csv", ".md"}
MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB

# Map allowed extensions → expected MIME type prefixes (loose check, no magic library needed)
EXTENSION_MIME_MAP = {
    ".pdf":  "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml",
    ".doc":  "application/msword",
    ".txt":  "text/",
    ".md":   "text/",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml",
    ".ppt":  "application/vnd.ms-powerpoint",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml",
    ".xls":  "application/vnd.ms-excel",
    ".csv":  "text/",
}

from pydantic import BaseModel
from app.api import deps
from app.models.bot import Bot as BotModel
from app.models.document import Document as DocumentModel
from app.models.user import User
from app.schemas.bot import Bot, BotCreate, BotUpdate
from app.schemas.document import Document
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.openrouter_rag_service import get_openrouter_rag_service
from app.services.memory_service import memory_service
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
    bot: BotModel = Depends(deps.get_current_bot),
):
    """Get a specific bot"""
    return bot

@router.put("/{bot_id}", response_model=Bot)
def update_bot(
    bot_in: BotUpdate,
    bot: BotModel = Depends(deps.get_current_bot),
    db: Session = Depends(deps.get_db),
):
    """Update a bot"""
    update_data = bot_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(bot, field, value)

    db.add(bot)
    db.commit()
    db.refresh(bot)
    return bot

@router.delete("/{bot_id}", status_code=204)
def delete_bot(
    bot: BotModel = Depends(deps.get_current_bot),
    db: Session = Depends(deps.get_db),
):
    """Delete a bot"""
    db.delete(bot)
    db.commit()
    return None

@router.post("/{bot_id}/documents", response_model=Document)
async def upload_document(
    bot_id: str,
    file: UploadFile = File(...),
    chunking_strategy: str = Form("recursive"),  # or "semantic"
    enable_knowledge_graph: bool = Form(False),
    bot: BotModel = Depends(deps.get_current_bot),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Upload a document to a bot's knowledge base with advanced processing"""

    # ── Validate file ──────────────────────────────────────────────────────────
    original_filename = file.filename or ""
    if not original_filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    suffix = Path(original_filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise HTTPException(
            status_code=400,
            detail=f"File type '{suffix}' is not allowed. Allowed types: {allowed}"
        )

    # Cross-check content_type against extension (client-supplied, but acts as a sanity check)
    declared_mime = (file.content_type or "").lower()
    expected_mime_prefix = EXTENSION_MIME_MAP.get(suffix, "")
    if declared_mime and expected_mime_prefix and not declared_mime.startswith(expected_mime_prefix):
        logger.warning(
            f"MIME mismatch on upload: extension={suffix}, content_type={declared_mime}, "
            f"user_id={current_user.id}"
        )
        raise HTTPException(
            status_code=400,
            detail="File content type does not match its extension"
        )

    # Enforce file size at the application layer
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    if file_size > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum allowed size is {MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB"
        )

    # Use a UUID-based storage key to prevent path traversal; keep original name in DB
    safe_storage_name = f"{uuid.uuid4()}{suffix}"

    # ── Deduplication Check: prevent re-processing same file ─────────────
    existing_doc = db.query(DocumentModel).filter(
        DocumentModel.bot_id == bot.id,
        DocumentModel.filename == original_filename
    ).first()

    if existing_doc:
        # If already processing or completed, return existing doc (idempotent)
        if existing_doc.status in ["processing", "completed", "queued"]:
            logger.info(f"Document {original_filename} already {existing_doc.status} for bot {bot_id}. Returning existing document.")
            return existing_doc
        # If failed, allow retry but log warning
        else:
            logger.warning(f"Document {original_filename} previously failed for bot {bot_id}. Re-processing...")
    # ──────────────────────────────────────────────────────────────────────

    # Upload file to MinIO
    try:
        file_path = storage_service.upload_file(
            file.file,
            safe_storage_name,
            content_type=file.content_type or "application/octet-stream"
        )
    except Exception as e:
        logger.error(f"Failed to upload document to storage: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to upload file. Please try again.")

    # Save to DB (processing)
    doc = DocumentModel(
        id=uuid.uuid4(),
        bot_id=bot.id,  # Use bot.id from the dependency injection
        filename=original_filename,
        file_type=file.content_type or "text/plain",
        file_size=file_size,
        file_path=file_path,
        status="processing",
        doc_metadata={"chunking_strategy": chunking_strategy, "enable_knowledge_graph": enable_knowledge_graph}
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Resolve chunk params: explicit form values override domain profile defaults
    from app.services.domain_config import get_domain_profile
    bot_domain = (bot.config or {}).get("domain", "general")
    domain_profile = get_domain_profile(bot_domain)
    bot_cfg = bot.config or {}
    effective_strategy = chunking_strategy if chunking_strategy != "recursive" else (
        bot_cfg.get("chunking_strategy") or domain_profile.chunk_strategy
    )
    effective_chunk_size = bot_cfg.get("chunk_size") or domain_profile.chunk_size
    effective_chunk_overlap = bot_cfg.get("chunk_overlap") or domain_profile.chunk_overlap

    # Enqueue background processing
    process_document_task.delay(
        str(doc.id),
        str(bot_id),
        file_path,
        file.filename,
        effective_strategy,
        enable_knowledge_graph,
        effective_chunk_size,
        effective_chunk_overlap,
    )
    
    return doc

@router.get("/{bot_id}/documents", response_model=List[Document])
def list_documents(
    bot: BotModel = Depends(deps.get_current_bot),
    db: Session = Depends(deps.get_db),
):
    """List all documents for a bot"""
    documents = db.query(DocumentModel).filter(
        DocumentModel.bot_id == bot.id
    ).all()
    return documents

@router.delete("/{bot_id}/documents/{doc_id}", status_code=204)
def delete_document(
    bot_id: str,
    doc_id: str,
    bot: BotModel = Depends(deps.get_current_bot),
    db: Session = Depends(deps.get_db),
):
    """Delete a document and its vectors from both DB and Qdrant"""
    try:
        doc_uuid = UUID(doc_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid document ID format")

    doc = db.query(DocumentModel).filter(
        DocumentModel.id == doc_uuid,
        DocumentModel.bot_id == bot.id,
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

@router.get("/{bot_id}/knowledge-graph")
async def get_bot_knowledge_graph(
    bot_id: str,
    bot: BotModel = Depends(deps.get_current_bot),
):
    """Get knowledge graph data for a specific bot for the 3D UI"""
        
    from app.services.lightrag_service import get_lightrag_service
    try:
        lightrag_service = get_lightrag_service(bot_id=bot_id)
        # Call synchronous method in asyncio to avoid blocking
        import asyncio
        graph_data = await asyncio.to_thread(lightrag_service.get_graph_data_for_ui)
        return graph_data
    except Exception as e:
        logger.error(f"Failed to load knowledge graph: {e}")
        return {"nodes": [], "links": []}

@router.post("/{bot_id}/chat", response_model=ChatResponse)
async def chat_with_bot(
    bot_id: str,
    chat_in: ChatRequest,
    bot: BotModel = Depends(deps.get_current_bot),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Chat with bot using advanced RAG with caching and optimizations"""

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
        sources=list(set(result.get("sources", []))),
        retrieved_chunks=result.get("retrieved_chunks", []),
        session_id=session_id,
        system_prompt=result.get("system_prompt"),
        memories_used=result.get("memories_used", []),
    )

@router.post("/{bot_id}/chat-stream")
async def chat_with_bot_stream(
    bot_id: str,
    chat_in: ChatRequest,
    bot: BotModel = Depends(deps.get_current_bot),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Chat with bot using streaming advanced RAG"""

    conversation_history = [m.model_dump() for m in chat_in.history] if chat_in.history else []
    session_id = chat_in.session_id if hasattr(chat_in, 'session_id') else None
    
    # Pass current user ID to bot_config for logging
    bot_config = bot.config or {}
    bot_config["user_id"] = str(current_user.id)
    
    async def event_generator():
        try:
            logger.info(f"[STREAM] Starting stream for bot={bot_id}")
            async for chunk in rag_service.chat_stream(
                bot_id=str(bot_id),
                query=chat_in.message,
                bot_config=bot_config,
                conversation_history=conversation_history,
                session_id=session_id
            ):
                yield f"data: {json.dumps(chunk)}\n\n"
        except Exception as e:
            logger.error(f"[STREAM] Streaming error: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/{bot_id}/history", response_model=List[Dict[str, Any]])
async def get_bot_chat_history(
    bot_id: str,
    session_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    bot: BotModel = Depends(deps.get_current_bot),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Get chat history for a specific bot and optional session"""
        
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
    bot: BotModel = Depends(deps.get_current_bot),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Get all chat sessions for a specific bot and current user"""
        
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
    bot: BotModel = Depends(deps.get_current_bot),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Delete a specific chat session for a bot"""
        
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
    bot: BotModel = Depends(deps.get_current_bot),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Clear all chat history/sessions for a bot"""
        
    await rag_service.clear_all_history(
        bot_id=str(bot_id),
        user_id=str(current_user.id)
    )
    
    return None

class PromptGenerationRequest(BaseModel):
    name: str
    description: str
    bot_id: Optional[str] = None


# ─── Memory Management Endpoints ────────────────────────────────────────────

@router.get("/{bot_id}/memory", response_model=Dict[str, Any])
async def get_user_memories(
    bot_id: str,
    bot: BotModel = Depends(deps.get_current_bot),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Get all stored Mem0 memories for the current user+bot pair."""
    user_id = str(current_user.id)
    memories = await memory_service.get_all(user_id=user_id, bot_id=bot_id)
    return {
        "user_id": user_id,
        "bot_id": bot_id,
        "count": len(memories),
        "memories": memories,
        "memory_enabled": memory_service.is_enabled,
    }


@router.delete("/{bot_id}/memory", response_model=Dict[str, Any])
async def delete_user_memories(
    bot_id: str,
    bot: BotModel = Depends(deps.get_current_bot),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Delete ALL stored memories for the current user+bot pair (GDPR compliance)."""
    user_id = str(current_user.id)
    deleted_count = await memory_service.delete_all(user_id=user_id, bot_id=bot_id)
    return {
        "status": "deleted",
        "user_id": user_id,
        "bot_id": bot_id,
        "deleted_count": deleted_count,
    }

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


class FeedbackRequest(BaseModel):
    score: int  # 1 = thumbs up, -1 = thumbs down


class RetrieveRequest(BaseModel):
    query: str
    top_k: int = 5


@router.post("/{bot_id}/retrieve")
async def test_retrieval(
    bot_id: str,
    request: RetrieveRequest,
    bot: BotModel = Depends(deps.get_current_bot),
):
    """Debug: run hybrid search and return scored chunks for a query."""

    try:
        import asyncio
        query_embedding = await asyncio.to_thread(rag_service._embed_with_retry, request.query)
        candidates = await asyncio.to_thread(
            rag_service._hybrid_search,
            bot_id, request.query, query_embedding, request.top_k
        )
        results = [
            {
                "text": c["text"],
                "source": c.get("source", "unknown"),
                "score": round(c.get("hybrid_score", c.get("rrf_score", 0.0)), 6),
                "metadata": c.get("metadata", {}),
            }
            for c in candidates
        ]
        return {"results": results, "hyde_document": None}
    except Exception as e:
        logger.error(f"Retrieval test failed: {e}")
        raise HTTPException(status_code=500, detail="Retrieval failed. Please try again.")


@router.get("/{bot_id}/debug-retrieval")
async def debug_retrieval(
    bot_id: str,
    query: str = Query(..., description="Query to debug"),
    top_k: int = Query(5, description="Number of chunks to retrieve"),
    bot: BotModel = Depends(deps.get_current_bot),
):
    """
    Retrieval Debugger — Returns full intermediate RAG pipeline results.

    Response includes:
    - query_rewritten: Query after rewriting
    - hyde_hypothesis: Hypothetical document passage
    - multi_query_variants: Alternative query reformulations
    - retrieved_chunks: Full chunks with all scores (vector, bm25, rrf, reranker, hybrid)
    - crag_verdict: CRAG relevance classification
    - lightrag_context: Knowledge graph results
    - agent_logs: Step-by-step pipeline logs
    - total_latency_ms: Total processing time
    """
    import time
    start_time = time.time()

    try:
        # Get bot config
        bot_config = bot.config or {}
        bot_config["user_id"] = str(bot.tenant_id)  # For logging

        # Use the existing _prepare_chat_context with debug mode
        prep = await rag_service._prepare_chat_context(
            bot_id=str(bot_id),
            query=query,
            bot_config=bot_config,
            top_k=top_k,
            debug_mode=True  # Enable detailed scoring
        )

        # Extract intermediate results
        search_query = prep.get("search_query", query)
        filtered_results = prep.get("filtered_results", [])
        agent_logs = prep.get("agent_logs", [])
        crag_status = prep.get("crag_status", "relevant")
        lightrag_entities = prep.get("lightrag_entities", [])

        # Build response with full scoring details
        chunks_with_scores = []
        for idx, chunk in enumerate(filtered_results):
            chunks_with_scores.append({
                "rank": idx + 1,
                "text": chunk.get("text", ""),
                "source": chunk.get("source", "unknown"),
                "parent_text": chunk.get("parent_text"),
                "context_prefix": chunk.get("context_prefix"),
                "metadata": chunk.get("metadata", {}),
                # Individual scores
                "vector_score": chunk.get("initial_score", 0),  # From semantic search
                "bm25_score": chunk.get("rrf_score", 0),  # Approximate from FTS
                "rrf_score": chunk.get("rrf_score", 0),  # Reciprocal Rank Fusion
                "reranker_score": chunk.get("rerank_raw", 0),  # Cross-Encoder raw
                "hybrid_score": chunk.get("hybrid_score", 0),  # Final blended score
                "highlights": chunk.get("highlights", [])
            })

        latency_ms = round((time.time() - start_time) * 1000, 2)

        return {
            "query_original": query,
            "query_rewritten": search_query,
            "hyde_hypothesis": prep.get("hyde_hypothesis", ""),
            "multi_query_variants": prep.get("multi_query_variants", []),
            "retrieved_chunks": chunks_with_scores,
            "crag_verdict": crag_status,
            "lightrag_entities": lightrag_entities,
            "agent_logs": agent_logs,
            "total_latency_ms": latency_ms,
            "bot_config": {
                "domain": bot_config.get("domain", "general"),
                "top_k": top_k,
                "enable_multi_query": bot_config.get("enable_multi_query", True),
                "enable_knowledge_graph": bot_config.get("enable_knowledge_graph", False),
            }
        }

    except Exception as e:
        logger.error(f"Debug retrieval failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Debug retrieval failed: {str(e)}")


@router.post("/{bot_id}/chat/{message_id}/feedback", status_code=200)
async def submit_message_feedback(
    bot_id: str,
    message_id: str,
    feedback_in: FeedbackRequest,
    current_user: User = Depends(deps.get_current_active_user),
):
    """Store thumbs-up / thumbs-down feedback for a specific AI message."""
    try:
        from app.db.mongodb import get_mongodb
        mongo_db = await get_mongodb()
        await mongo_db.message_feedback.update_one(
            {"message_id": message_id},
            {
                "$set": {
                    "message_id": message_id,
                    "bot_id": bot_id,
                    "user_id": str(current_user.id),
                    "tenant_id": str(current_user.tenant_id),
                    "score": feedback_in.score,
                    "updated_at": datetime.now(timezone.utc),
                },
                "$setOnInsert": {"created_at": datetime.now(timezone.utc)},
            },
            upsert=True,
        )
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Failed to store feedback: {e}")
        raise HTTPException(status_code=500, detail="Failed to save feedback. Please try again.")

