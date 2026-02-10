"""
OpenRouter API Endpoints
Endpoints for testing and using OpenRouter services.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging

from app.services.openrouter_service import get_openrouter_service
from app.services.openrouter_rag_service import get_openrouter_rag_service

logger = logging.getLogger(__name__)

router = APIRouter()


# Request/Response Models
class ChatRequest(BaseModel):
    messages: List[Dict[str, str]]
    model: Optional[str] = None
    temperature: float = 0.7
    max_tokens: Optional[int] = None
    stream: bool = False


class EmbeddingRequest(BaseModel):
    texts: List[str]
    model: Optional[str] = None


class RAGChatRequest(BaseModel):
    bot_id: str
    query: str
    bot_config: Optional[Dict[str, Any]] = None
    conversation_history: Optional[List[Dict[str, str]]] = None
    session_id: Optional[str] = None
    top_k: int = 3


# Endpoints
@router.get("/test")
async def test_openrouter_connection():
    """Test OpenRouter API connection."""
    try:
        service = get_openrouter_service()
        success = service.test_connection()
        
        if success:
            return {
                "status": "success",
                "message": "OpenRouter connection successful",
                "chat_model": service.chat_model,
                "embedding_model": service.embedding_model
            }
        else:
            raise HTTPException(status_code=500, detail="OpenRouter connection failed")
            
    except Exception as e:
        logger.error(f"OpenRouter test failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat")
async def chat_completion(request: ChatRequest):
    """Generate chat completion using OpenRouter."""
    try:
        service = get_openrouter_service()
        
        response = service.chat_completion(
            messages=request.messages,
            model=request.model,
            stream=request.stream,
            temperature=request.temperature,
            max_tokens=request.max_tokens
        )
        
        return {
            "status": "success",
            "data": response
        }
        
    except Exception as e:
        logger.error(f"Chat completion error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/embeddings")
async def generate_embeddings(request: EmbeddingRequest):
    """Generate embeddings using OpenRouter."""
    try:
        service = get_openrouter_service()
        
        embeddings = service.generate_embeddings(
            texts=request.texts,
            model=request.model
        )
        
        return {
            "status": "success",
            "data": {
                "embeddings": embeddings,
                "count": len(embeddings),
                "dimensions": len(embeddings[0]) if embeddings else 0
            }
        }
        
    except Exception as e:
        logger.error(f"Embeddings generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rag/ingest")
async def ingest_document(
    bot_id: str,
    file: UploadFile = File(...),
    chunk_size: int = 1000,
    chunk_overlap: int = 200
):
    """Ingest document into RAG system using OpenRouter embeddings."""
    try:
        service = get_openrouter_rag_service()
        
        result = await service.ingest_file(
            file=file,
            bot_id=bot_id,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )
        
        return {
            "status": "success",
            "data": result
        }
        
    except Exception as e:
        logger.error(f"Document ingestion error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rag/chat")
async def rag_chat(request: RAGChatRequest):
    """Chat with RAG system using OpenRouter for both retrieval and generation."""
    try:
        service = get_openrouter_rag_service()
        
        result = await service.chat(
            bot_id=request.bot_id,
            query=request.query,
            bot_config=request.bot_config,
            conversation_history=request.conversation_history,
            session_id=request.session_id,
            top_k=request.top_k
        )
        
        return {
            "status": "success",
            "data": result
        }
        
    except Exception as e:
        logger.error(f"RAG chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models/chat")
async def list_chat_models():
    """Get recommended chat models for OpenRouter."""
    return {
        "status": "success",
        "models": [
            {
                "id": "openai/gpt-4o",
                "name": "GPT-4o",
                "description": "High quality, multimodal",
                "context_length": 128000
            },
            {
                "id": "openai/gpt-4o-mini",
                "name": "GPT-4o Mini",
                "description": "Fast and affordable",
                "context_length": 128000
            },
            {
                "id": "anthropic/claude-3.5-sonnet",
                "name": "Claude 3.5 Sonnet",
                "description": "Excellent reasoning",
                "context_length": 200000
            },
            {
                "id": "google/gemini-2.0-flash-exp:free",
                "name": "Gemini 2.0 Flash (Free)",
                "description": "Free tier available",
                "context_length": 1000000
            },
            {
                "id": "meta-llama/llama-3.3-70b-instruct",
                "name": "Llama 3.3 70B",
                "description": "Open source, high quality",
                "context_length": 128000
            }
        ]
    }


@router.get("/models/embeddings")
async def list_embedding_models():
    """Get recommended embedding models for OpenRouter."""
    return {
        "status": "success",
        "models": [
            {
                "id": "openai/text-embedding-3-small",
                "name": "Text Embedding 3 Small",
                "description": "Fast, affordable, 1536 dimensions",
                "dimensions": 1536
            },
            {
                "id": "openai/text-embedding-3-large",
                "name": "Text Embedding 3 Large",
                "description": "High quality, 3072 dimensions",
                "dimensions": 3072
            },
            {
                "id": "openai/text-embedding-ada-002",
                "name": "Text Embedding Ada 002",
                "description": "Legacy, 1536 dimensions",
                "dimensions": 1536
            }
        ]
    }
