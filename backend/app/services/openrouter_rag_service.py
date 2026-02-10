"""
OpenRouter-Enhanced RAG Service
Integrates OpenRouter for both LLM and embeddings in RAG pipeline.
Provides seamless migration path from existing services.
"""

import os
import logging
import time
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime

from fastapi import UploadFile
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document as LangChainDocument
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from qdrant_client import QdrantClient
from qdrant_client.http import models as rest
from qdrant_client.models import PointStruct, Filter, FieldCondition, MatchValue

from app.core.config import settings
from app.db.mongodb import get_mongodb
from app.services.openrouter_service import get_openrouter_service
import tempfile
import shutil
import hashlib
import json

logger = logging.getLogger(__name__)


class OpenRouterRAGService:
    """
    RAG Service powered by OpenRouter for both LLM and embeddings.
    Drop-in replacement for existing RAG services with enhanced capabilities.
    """
    
    def __init__(self):
        """Initialize OpenRouter RAG service with all dependencies."""
        self.openrouter = get_openrouter_service()
        self.qdrant_client = QdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT)
        self.collection_name = "omnirag_openrouter_collection"
        
        # Get embedding dimensions (typically 1536 for text-embedding-3-small)
        self.embedding_dim = 1536  # Will be auto-detected on first embedding
        
        self._ensure_collection()
        
        logger.info("OpenRouterRAGService initialized successfully")
    
    def _ensure_collection(self):
        """Ensure Qdrant collection exists with proper configuration."""
        try:
            self.qdrant_client.get_collection(self.collection_name)
            logger.info(f"Collection '{self.collection_name}' already exists")
        except Exception:
            logger.info(f"Creating collection '{self.collection_name}'")
            self.qdrant_client.create_collection(
                collection_name=self.collection_name,
                vectors_config=rest.VectorParams(
                    size=self.embedding_dim,
                    distance=rest.Distance.COSINE
                ),
            )
            logger.info(f"Collection '{self.collection_name}' created successfully")
    
    def _load_document(self, file_path: str, filename: str) -> List[LangChainDocument]:
        """Load document based on file type."""
        if filename.endswith(".pdf"):
            loader = PyPDFLoader(file_path)
        elif filename.endswith(".txt"):
            loader = TextLoader(file_path)
        else:
            raise ValueError(f"Unsupported file type: {filename}")
        
        return loader.load()
    
    def _chunk_documents(
        self,
        documents: List[LangChainDocument],
        chunk_size: int = 1000,
        chunk_overlap: int = 200
    ) -> List[LangChainDocument]:
        """Split documents into chunks."""
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", ". ", " ", ""]
        )
        return text_splitter.split_documents(documents)
    
    async def ingest_file(
        self,
        file: UploadFile,
        bot_id: str,
        chunking_strategy: str = "recursive",
        chunk_size: int = 1000,
        chunk_overlap: int = 200
    ) -> Dict[str, Any]:
        """
        Ingest file into vector database using OpenRouter embeddings.
        
        Args:
            file: Uploaded file
            bot_id: Bot ID for filtering
            chunking_strategy: Chunking strategy to use
            chunk_size: Size of each chunk
            chunk_overlap: Overlap between chunks
            
        Returns:
            Dict with ingestion stats
        """
        # Save temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
        
        try:
            start_time = time.time()
            
            # Load document
            logger.info(f"Loading document: {file.filename}")
            documents = self._load_document(tmp_path, file.filename)
            
            # Chunk documents
            logger.info(f"Chunking document with size={chunk_size}, overlap={chunk_overlap}")
            chunks = self._chunk_documents(documents, chunk_size, chunk_overlap)
            
            # Add metadata
            for chunk in chunks:
                chunk.metadata["bot_id"] = bot_id
                chunk.metadata["source"] = file.filename
                chunk.metadata["ingested_at"] = datetime.utcnow().isoformat()
            
            # Generate embeddings for all chunks
            logger.info(f"Generating embeddings for {len(chunks)} chunks using OpenRouter")
            texts = [chunk.page_content for chunk in chunks]
            embeddings = self.openrouter.embed_batch(texts, batch_size=100)
            
            # Auto-detect embedding dimensions
            if embeddings:
                detected_dim = len(embeddings[0])
                if detected_dim != self.embedding_dim:
                    logger.warning(
                        f"Embedding dimension mismatch. Expected {self.embedding_dim}, "
                        f"got {detected_dim}. Recreating collection..."
                    )
                    self.embedding_dim = detected_dim
                    # Recreate collection with correct dimensions
                    try:
                        self.qdrant_client.delete_collection(self.collection_name)
                    except:
                        pass
                    self._ensure_collection()
            
            # Insert into Qdrant
            logger.info(f"Inserting {len(chunks)} vectors into Qdrant")
            points = []
            for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                point_id = hashlib.md5(
                    f"{bot_id}_{file.filename}_{idx}_{chunk.page_content[:100]}".encode()
                ).hexdigest()
                
                points.append(
                    PointStruct(
                        id=point_id,
                        vector=embedding,
                        payload={
                            "bot_id": bot_id,
                            "source": file.filename,
                            "text": chunk.page_content,
                            "metadata": chunk.metadata,
                        }
                    )
                )
            
            self.qdrant_client.upsert(
                collection_name=self.collection_name,
                points=points
            )
            
            elapsed_time = time.time() - start_time
            
            result = {
                "filename": file.filename,
                "chunks_created": len(chunks),
                "vectors_inserted": len(points),
                "embedding_dim": self.embedding_dim,
                "processing_time": round(elapsed_time, 2)
            }
            
            logger.info(f"File ingestion complete: {result}")
            return result
            
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    
    async def chat(
        self,
        bot_id: str,
        query: str,
        bot_config: Optional[Dict[str, Any]] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        session_id: Optional[str] = None,
        top_k: int = 3,
        use_cache: bool = True
    ) -> Dict[str, Any]:
        """
        Chat with bot using OpenRouter for both retrieval and generation.
        
        Args:
            bot_id: Bot ID for filtering
            query: User query
            bot_config: Bot configuration (model, temperature, etc.)
            conversation_history: Previous conversation messages
            session_id: Session ID for logging
            top_k: Number of documents to retrieve
            use_cache: Whether to use caching
            
        Returns:
            Response dict with answer and sources
        """
        start_time = time.time()
        session_id = session_id or str(uuid.uuid4())
        bot_config = bot_config or {}
        
        # Check cache
        if use_cache:
            cache_key = hashlib.md5(f"{bot_id}_{query}".encode()).hexdigest()
            # TODO: Implement Redis caching
        
        try:
            # Generate query embedding
            logger.info(f"Generating query embedding for: {query[:100]}...")
            query_embedding = self.openrouter.embed_single(query)
            
            # Search Qdrant
            logger.info(f"Searching Qdrant for bot_id={bot_id}, top_k={top_k}")
            search_results = self.qdrant_client.search(
                collection_name=self.collection_name,
                query_vector=query_embedding,
                query_filter=Filter(
                    must=[
                        FieldCondition(
                            key="bot_id",
                            match=MatchValue(value=bot_id)
                        )
                    ]
                ),
                limit=top_k,
                with_payload=True
            )
            
            # Extract context from search results
            context_docs = []
            sources = []
            for result in search_results:
                context_docs.append(result.payload["text"])
                source = result.payload.get("source", "unknown")
                if source not in sources:
                    sources.append(source)
            
            context = "\n\n".join(context_docs)
            
            logger.info(f"Retrieved {len(context_docs)} relevant documents from {len(sources)} sources")
            
            # Build prompt
            system_prompt = bot_config.get(
                "system_prompt",
                "You are a helpful AI assistant. Answer questions based on the provided context."
            )
            
            # Prepare messages
            messages = [{"role": "system", "content": system_prompt}]
            
            # Add conversation history if provided
            if conversation_history:
                messages.extend(conversation_history[-5:])  # Last 5 messages for context
            
            # Add current query with context
            user_message = f"""Context information:
{context}

User question: {query}

Please answer the question based on the context provided. If the context doesn't contain relevant information, say so."""
            
            messages.append({"role": "user", "content": user_message})
            
            # Generate response using OpenRouter
            logger.info("Generating response with OpenRouter")
            llm_response = self.openrouter.chat_completion(
                messages=messages,
                model=bot_config.get("model"),  # Will use default if None
                temperature=bot_config.get("temperature", 0.7),
                max_tokens=bot_config.get("max_tokens", 1000)
            )
            
            response_time = time.time() - start_time
            
            result = {
                "response": llm_response["content"],
                "sources": sources,
                "model": llm_response["model"],
                "usage": llm_response["usage"],
                "response_time": round(response_time, 2),
                "session_id": session_id
            }
            
            # Log conversation
            try:
                await self._log_conversation(
                    bot_id=bot_id,
                    session_id=session_id,
                    user_message=query,
                    response=llm_response["content"],
                    sources=sources,
                    response_time=response_time,
                    model=llm_response["model"],
                    usage=llm_response["usage"]
                )
            except Exception as e:
                logger.error(f"Failed to log conversation: {e}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error in chat: {str(e)}")
            raise
    
    async def _log_conversation(
        self,
        bot_id: str,
        session_id: str,
        user_message: str,
        response: str,
        sources: List[str],
        response_time: float,
        model: str,
        usage: Dict[str, int]
    ):
        """Log conversation to MongoDB for analytics."""
        try:
            mongo_db = await get_mongodb()
            conversations_collection = mongo_db.conversations
            
            conversation_doc = {
                "bot_id": bot_id,
                "session_id": session_id,
                "user_message": user_message,
                "response": response,
                "sources": sources,
                "response_time": round(response_time, 2),
                "model": model,
                "usage": usage,
                "timestamp": datetime.utcnow(),
                "provider": "openrouter"
            }
            
            await conversations_collection.insert_one(conversation_doc)
            logger.debug(f"Conversation logged to MongoDB: session_id={session_id}")
            
        except Exception as e:
            logger.error(f"Error logging conversation to MongoDB: {e}")


# Singleton instance
_openrouter_rag_service = None


def get_openrouter_rag_service() -> OpenRouterRAGService:
    """Get singleton instance of OpenRouterRAGService."""
    global _openrouter_rag_service
    if _openrouter_rag_service is None:
        _openrouter_rag_service = OpenRouterRAGService()
    return _openrouter_rag_service
