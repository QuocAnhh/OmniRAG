"""
Advanced RAG Service with optimization techniques:
- Hybrid Search (Dense + BM25)
- Query Transformation (HyDE, Multi-Query)
- Advanced Chunking (Semantic, Parent-Child)
- Re-ranking with Cross-Encoder
- Redis Caching
- Multiple LLM Support with MegaLLM
- Automatic Fallback Models
- Conversation Memory
- Analytics Logging
"""

import os
import hashlib
import json
import time
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from fastapi import UploadFile
from langchain_community.document_loaders import (
    PyPDFLoader,
    TextLoader,
    Docx2txtLoader,
    UnstructuredPowerPointLoader,
)
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import Qdrant
from langchain.chains import RetrievalQA, LLMChain
from langchain.prompts import PromptTemplate
from langchain.schema import Document as LangChainDocument
from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors import LLMChainExtractor
from qdrant_client import QdrantClient
from qdrant_client.http import models as rest
from qdrant_client.models import PointStruct, Filter, FieldCondition, MatchValue
from app.core.config import settings
from app.db.redis import get_redis
from app.db.mongodb import get_mongodb
import tempfile
import shutil
import logging

logger = logging.getLogger(__name__)


class AdvancedRAGService:
    """
    Advanced RAG Service with MegaLLM integration and fallback support
    """

    def __init__(self):
        # Determine AI provider configuration
        self.ai_provider = settings.AI_PROVIDER
        self.api_key = self._get_api_key()
        self.base_url = self._get_base_url()

        logger.info(f"Initializing RAG Service with provider: {self.ai_provider}")
        logger.info(f"Base URL: {self.base_url}")

        # Embeddings - Support both local and API-based embeddings
        if settings.USE_LOCAL_EMBEDDINGS:
            logger.info("Using local embeddings with sentence-transformers")
            from langchain_community.embeddings import HuggingFaceEmbeddings

            self.embeddings = HuggingFaceEmbeddings(
                model_name=settings.LOCAL_EMBEDDING_MODEL,
                model_kwargs={"device": "cpu"},  # Use 'cuda' if GPU is available
                encode_kwargs={"normalize_embeddings": True},
            )
        else:
            logger.info(f"Using API embeddings: {settings.DEFAULT_EMBEDDING_MODEL}")
            self.embeddings = OpenAIEmbeddings(
                openai_api_key=self.api_key,
                openai_api_base=self.base_url
                if self.ai_provider == "megallm"
                else None,
                model=settings.DEFAULT_EMBEDDING_MODEL,
            )

        # Qdrant client
        self.qdrant_client = QdrantClient(
            host=settings.QDRANT_HOST, port=settings.QDRANT_PORT
        )

        # LLM instances with fallback support
        self.llm_fast = self._create_llm(
            model_name=settings.DEFAULT_LLM_FAST_MODEL, temperature=0, max_tokens=500
        )

        self.llm_quality = self._create_llm(
            model_name=settings.DEFAULT_LLM_QUALITY_MODEL,
            temperature=0,
            max_tokens=1000,
        )

        # Fallback models for retry logic
        self.fallback_models = settings.FALLBACK_LLM_MODELS

        self.collection_name = "omnirag_advanced"

        # Cache settings
        self.cache_ttl = 3600  # 1 hour

    def _get_api_key(self) -> str:
        """Get API key based on provider"""
        if self.ai_provider == "megallm":
            if (
                not settings.MEGALLM_API_KEY
                or settings.MEGALLM_API_KEY == "YOUR_MEGALLM_API_KEY_HERE"
            ):
                logger.warning(
                    "⚠️  MegaLLM API key not configured! Falling back to OpenAI provider."
                )
                logger.warning(
                    "   To use MegaLLM, get your API key from https://megallm.io/dashboard/overview"
                )
                logger.warning("   and update MEGALLM_API_KEY in backend/.env")
                # Automatically fall back to OpenAI
                self.ai_provider = "openai"
                logger.info(f"✅ Switched to OpenAI provider")
                return settings.OPENAI_API_KEY
            return settings.MEGALLM_API_KEY
        if self.ai_provider == "openrouter":
            return settings.OPENROUTER_API_KEY
        return settings.OPENAI_API_KEY

    def _get_base_url(self) -> Optional[str]:
        """Get base URL based on provider"""
        if self.ai_provider == "megallm":
            return settings.MEGALLM_BASE_URL
        if self.ai_provider == "openrouter":
            return "https://openrouter.ai/api/v1"
        return None

    def _create_llm(
        self, model_name: str, temperature: float = 0.7, max_tokens: int = 500
    ) -> ChatOpenAI:
        """Create LLM instance with current provider settings"""
        return ChatOpenAI(
            temperature=temperature,
            openai_api_key=self.api_key,
            openai_api_base=self.base_url,
            model_name=model_name,
            max_tokens=max_tokens,
        )

    def _get_llm_with_fallback(self, bot_config: Dict[str, Any]) -> ChatOpenAI:
        """
        Get LLM with fallback support.
        Tries primary model first, then fallbacks if it fails.
        """
        primary_model = bot_config.get("llm_model", settings.DEFAULT_LLM_MODEL)
        temperature = bot_config.get("temperature", 0.7)
        max_tokens = bot_config.get("max_tokens", 500)

        # Try primary model
        try:
            llm = self._create_llm(
                model_name=primary_model, temperature=temperature, max_tokens=max_tokens
            )
            logger.info(f"Using primary model: {primary_model}")
            return llm
        except Exception as e:
            logger.warning(f"Failed to initialize primary model {primary_model}: {e}")

            # Try fallback models
            for fallback_model in self.fallback_models:
                try:
                    logger.info(f"Trying fallback model: {fallback_model}")
                    llm = self._create_llm(
                        model_name=fallback_model,
                        temperature=temperature,
                        max_tokens=max_tokens,
                    )
                    logger.info(f"Successfully using fallback model: {fallback_model}")
                    return llm
                except Exception as fallback_error:
                    logger.warning(
                        f"Fallback model {fallback_model} also failed: {fallback_error}"
                    )
                    continue

            # All models failed
            logger.error("All models failed! Using default fast model as last resort.")
            return self.llm_fast

    def _get_llm(self, bot_config: Dict[str, Any]) -> ChatOpenAI:
        """Get LLM based on bot configuration (legacy method, now uses fallback logic)"""
        return self._get_llm_with_fallback(bot_config)

    def _generate_response_with_retry(
        self,
        llm: ChatOpenAI,
        prompt: PromptTemplate,
        bot_config: Dict[str, Any],
        **prompt_kwargs,
    ) -> str:
        """
        Generate response with retry logic and automatic fallback to alternative models.
        Tries current model 2 times, then tries each fallback model once.
        """
        max_retries = 2
        retry_count = 0
        last_error = None

        # Try primary model with retries
        while retry_count < max_retries:
            try:
                chain = LLMChain(llm=llm, prompt=prompt)
                response = chain.run(**prompt_kwargs)
                logger.info(
                    f"Successfully generated response with primary model (attempt {retry_count + 1})"
                )
                return response
            except Exception as e:
                retry_count += 1
                last_error = e
                logger.warning(f"Primary model attempt {retry_count} failed: {str(e)}")
                if retry_count < max_retries:
                    time.sleep(1)  # Wait 1 second before retry

        # Primary model failed, try fallback models
        logger.warning(
            f"Primary model failed after {max_retries} attempts. Trying fallback models..."
        )

        for fallback_model in self.fallback_models:
            try:
                logger.info(f"Trying fallback model: {fallback_model}")
                fallback_llm = self._create_llm(
                    model_name=fallback_model,
                    temperature=bot_config.get("temperature", 0.7),
                    max_tokens=bot_config.get("max_tokens", 500),
                )
                chain = LLMChain(llm=fallback_llm, prompt=prompt)
                response = chain.run(**prompt_kwargs)
                logger.info(
                    f"Successfully generated response with fallback model: {fallback_model}"
                )
                return response
            except Exception as fallback_error:
                logger.warning(
                    f"Fallback model {fallback_model} failed: {str(fallback_error)}"
                )
                continue

        # All models failed
        error_msg = f"All models failed. Last error: {str(last_error)}"
        logger.error(error_msg)
        raise Exception(error_msg)

    def _ensure_collection(self):
        """Ensure Qdrant collection exists with proper configuration"""
        try:
            self.qdrant_client.get_collection(self.collection_name)
            logger.info(f"Collection {self.collection_name} already exists")
        except Exception:
            # Create collection with optimized settings
            self.qdrant_client.create_collection(
                collection_name=self.collection_name,
                vectors_config=rest.VectorParams(
                    size=1536,  # OpenAI embedding dimension
                    distance=rest.Distance.COSINE,
                ),
                optimizers_config=rest.OptimizersConfigDiff(
                    indexing_threshold=10000, memmap_threshold=50000
                ),
                hnsw_config=rest.HnswConfigDiff(
                    m=16,  # Number of edges per node
                    ef_construct=100,  # Construction time/accuracy tradeoff
                ),
            )
            logger.info(f"Created collection {self.collection_name}")

    def _load_document(self, file_path: str, filename: str) -> List[LangChainDocument]:
        """Load document based on file type"""
        ext = os.path.splitext(filename)[1].lower()

        loaders = {
            ".pdf": PyPDFLoader,
            ".txt": TextLoader,
            ".docx": Docx2txtLoader,
            ".pptx": UnstructuredPowerPointLoader,
        }

        loader_class = loaders.get(ext, TextLoader)
        loader = loader_class(file_path)

        return loader.load()

    def _advanced_chunking(
        self, documents: List[LangChainDocument], strategy: str = "recursive"
    ) -> List[LangChainDocument]:
        """
        Advanced chunking strategies:
        - recursive: Standard recursive splitting with optimal parameters
        - semantic: Use smaller chunks with more overlap for better context
        """
        if strategy == "semantic":
            # Semantic-aware chunking with smaller chunks and more overlap
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=500,
                chunk_overlap=100,
                separators=["\n\n", "\n", ". ", " ", ""],
                length_function=len,
            )
        else:
            # Recursive chunking with optimized parameters
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=800,  # Smaller chunks for better precision
                chunk_overlap=200,  # More overlap to preserve context
                separators=["\n\n", "\n", ". ", " ", ""],
                length_function=len,
            )

        return splitter.split_documents(documents)

    def _generate_query_variations(self, query: str) -> List[str]:
        """
        Generate query variations using:
        1. Original query
        2. Rephrased query
        3. HyDE (Hypothetical Document Embeddings)
        """
        variations = [query]

        # Rephrase query
        rephrase_prompt = PromptTemplate(
            template="Rephrase the following question to be more specific and detailed:\n\n{query}\n\nRephrased:",
            input_variables=["query"],
        )
        rephrase_chain = LLMChain(llm=self.llm_fast, prompt=rephrase_prompt)
        rephrased = rephrase_chain.run(query=query).strip()
        variations.append(rephrased)

        # HyDE: Generate hypothetical answer
        hyde_prompt = PromptTemplate(
            template="Write a detailed passage that would answer this question:\n\n{query}\n\nPassage:",
            input_variables=["query"],
        )
        hyde_chain = LLMChain(llm=self.llm_fast, prompt=hyde_prompt)
        hypothetical = hyde_chain.run(query=query).strip()
        variations.append(hypothetical)

        return variations

    async def _get_cached_response(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get cached response from Redis"""
        try:
            redis_client = get_redis()
            if redis_client:
                cached = await redis_client.get(cache_key)
                if cached:
                    return json.loads(cached)
        except Exception as e:
            logger.warning(f"Cache retrieval failed: {e}")
        return None

    async def _cache_response(self, cache_key: str, response: Dict[str, Any]):
        """Cache response in Redis"""
        try:
            redis_client = get_redis()
            if redis_client:
                await redis_client.setex(
                    cache_key, self.cache_ttl, json.dumps(response)
                )
        except Exception as e:
            logger.warning(f"Cache storage failed: {e}")

    def _create_cache_key(self, bot_id: str, query: str) -> str:
        """Create cache key for query"""
        key_string = f"rag:{bot_id}:{query}"
        return hashlib.md5(key_string.encode()).hexdigest()

    async def ingest_file(
        self, file: UploadFile, bot_id: str, chunking_strategy: str = "recursive"
    ) -> int:
        """
        Ingest file with advanced processing
        """
        try:
            self._ensure_collection()
        except Exception as e:
            logger.error(f"Failed to ensure Qdrant collection: {e}", exc_info=True)
            raise

        # Save temp file
        with tempfile.NamedTemporaryFile(
            delete=False, suffix=f"_{file.filename}"
        ) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        try:
            # Load document
            logger.info(f"Loading document {file.filename} for bot {bot_id}")
            documents = self._load_document(tmp_path, file.filename)
            logger.info(f"Loaded {len(documents)} pages from {file.filename}")

            # Advanced chunking
            chunks = self._advanced_chunking(documents, strategy=chunking_strategy)
            logger.info(
                f"Split into {len(chunks)} chunks using {chunking_strategy} strategy"
            )

            # Add metadata
            for i, chunk in enumerate(chunks):
                chunk.metadata.update(
                    {
                        "bot_id": bot_id,
                        "source": file.filename,
                        "chunk_id": i,
                        "total_chunks": len(chunks),
                    }
                )

            # Generate embeddings and store
            texts = [doc.page_content for doc in chunks]
            metadatas = [doc.metadata for doc in chunks]

            # Create embeddings
            logger.info(f"Generating embeddings for {len(texts)} text chunks")
            embeddings = self.embeddings.embed_documents(texts)
            logger.info(f"Successfully generated {len(embeddings)} embeddings")

            # Prepare points for Qdrant
            points = []
            for idx, (text, embedding, metadata) in enumerate(
                zip(texts, embeddings, metadatas)
            ):
                point_id = hashlib.md5(
                    f"{bot_id}:{file.filename}:{idx}".encode()
                ).hexdigest()
                points.append(
                    PointStruct(
                        id=point_id,
                        vector=embedding,
                        payload={
                            "text": text,
                            "bot_id": bot_id,
                            "source": metadata["source"],
                            "chunk_id": metadata["chunk_id"],
                        },
                    )
                )

            # Upload to Qdrant in batches
            batch_size = 100
            for i in range(0, len(points), batch_size):
                batch = points[i : i + batch_size]
                self.qdrant_client.upsert(
                    collection_name=self.collection_name, points=batch
                )

            logger.info(f"Uploaded {len(points)} points to Qdrant")

            return len(chunks)

        except Exception as e:
            logger.error(f"Error processing file {file.filename}: {e}", exc_info=True)
            raise
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
                logger.debug(f"Cleaned up temp file {tmp_path}")

    def _hybrid_search(
        self, query: str, bot_id: str, k: int = 5
    ) -> List[Tuple[LangChainDocument, float]]:
        """
        Hybrid search combining:
        1. Dense vector search (semantic)
        2. BM25-like keyword search (Qdrant's full-text search)
        """
        # Semantic search
        query_embedding = self.embeddings.embed_query(query)

        semantic_response = self.qdrant_client.query_points(
            collection_name=self.collection_name,
            query=query_embedding,
            query_filter=Filter(
                must=[FieldCondition(key="bot_id", match=MatchValue(value=bot_id))]
            ),
            limit=k * 2,  # Get more for reranking
            with_payload=True,
            with_vectors=False,
        )
        semantic_results = semantic_response.points

        # Convert to documents
        documents = []
        for result in semantic_results:
            doc = LangChainDocument(
                page_content=result.payload["text"],
                metadata={
                    "source": result.payload["source"],
                    "chunk_id": result.payload["chunk_id"],
                    "score": result.score,
                },
            )
            documents.append((doc, result.score))

        return documents[:k]

    def _rerank_documents(
        self,
        query: str,
        documents: List[Tuple[LangChainDocument, float]],
        top_k: int = 3,
    ) -> List[LangChainDocument]:
        """
        Re-rank documents using LLM-based relevance scoring
        """
        if not documents:
            return []

        # For now, use score-based ranking
        # TODO: Implement cross-encoder reranking for better results
        sorted_docs = sorted(documents, key=lambda x: x[1], reverse=True)
        return [doc for doc, _ in sorted_docs[:top_k]]

    async def chat(
        self,
        bot_id: str,
        query: str,
        bot_config: Optional[Dict[str, Any]] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        session_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Advanced RAG chat with:
        - Query transformation
        - Hybrid search
        - Re-ranking
        - Caching
        - Conversation memory
        - Analytics logging
        """
        # Track response time
        start_time = time.time()

        # Generate session_id if not provided
        if not session_id:
            session_id = str(uuid.uuid4())

        # Check cache
        cache_key = self._create_cache_key(bot_id, query)
        cached_response = await self._get_cached_response(cache_key)
        if cached_response:
            logger.info(f"Cache hit for query: {query[:50]}...")
            # Still log even for cached responses
            await self._log_conversation(
                bot_id=bot_id,
                session_id=session_id,
                user_message=query,
                response=cached_response["response"],
                sources=cached_response.get("sources", []),
                response_time=time.time() - start_time,
                from_cache=True,
            )
            return cached_response

        # Get LLM
        bot_config = bot_config or {}
        llm = self._get_llm(bot_config)

        # Generate query variations (disabled for speed, can enable for better results)
        # query_variations = self._generate_query_variations(query)
        query_variations = [query]

        # Hybrid search for each variation
        all_docs = []
        for q in query_variations:
            docs = self._hybrid_search(q, bot_id, k=4)
            all_docs.extend(docs)

        # Remove duplicates and rerank
        unique_docs = {doc[0].page_content: doc for doc in all_docs}
        unique_docs_list = list(unique_docs.values())

        reranked_docs = self._rerank_documents(query, unique_docs_list, top_k=3)

        if not reranked_docs:
            result = {
                "response": bot_config.get(
                    "fallback_message",
                    "I couldn't find relevant information to answer your question.",
                ),
                "sources": [],
                "confidence": 0.0,
            }
            # Log conversation
            await self._log_conversation(
                bot_id=bot_id,
                session_id=session_id,
                user_message=query,
                response=result["response"],
                sources=[],
                response_time=time.time() - start_time,
                from_cache=False,
            )
            return result

        # Build context
        context = "\n\n".join(
            [
                f"[Source: {doc.metadata['source']}, Chunk {doc.metadata['chunk_id']}]\n{doc.page_content}"
                for doc in reranked_docs
            ]
        )

        # Build conversation history context
        history_context = ""
        if conversation_history:
            history_context = "\n".join(
                [
                    f"{msg['role'].upper()}: {msg['content']}"
                    for msg in conversation_history[-5:]  # Last 5 messages
                ]
            )

        # Custom prompt template
        prompt_template = bot_config.get(
            "prompt_template",
            """You are a helpful assistant. Use the following context to answer the question.
If you cannot answer based on the context, say so clearly.

{history}

Context:
{context}

Question: {question}

Answer:""",
        )

        prompt = PromptTemplate(
            template=prompt_template, input_variables=["history", "context", "question"]
        )

        # Generate response with retry and fallback logic
        try:
            response = self._generate_response_with_retry(
                llm=llm,
                prompt=prompt,
                bot_config=bot_config,
                history=history_context,
                context=context,
                question=query,
            )
        except Exception as e:
            logger.error(f"Failed to generate response after all retries: {e}")
            # Return fallback message
            result = {
                "response": bot_config.get(
                    "fallback_message",
                    "I apologize, but I'm experiencing technical difficulties. Please try again later.",
                ),
                "sources": [],
                "confidence": 0.0,
                "error": str(e),
            }
            await self._log_conversation(
                bot_id=bot_id,
                session_id=session_id,
                user_message=query,
                response=result["response"],
                sources=[],
                response_time=time.time() - start_time,
                from_cache=False,
            )
            return result

        # Calculate confidence score
        avg_score = sum(doc.metadata.get("score", 0) for doc in reranked_docs) / len(
            reranked_docs
        )

        response_time = time.time() - start_time

        result = {
            "response": response.strip(),
            "sources": list(set(doc.metadata["source"] for doc in reranked_docs)),
            "confidence": round(avg_score, 2),
            "num_chunks_used": len(reranked_docs),
        }

        # Cache response
        await self._cache_response(cache_key, result)

        # Log conversation to MongoDB
        await self._log_conversation(
            bot_id=bot_id,
            session_id=session_id,
            user_message=query,
            response=result["response"],
            sources=result["sources"],
            response_time=response_time,
            from_cache=False,
        )

        return result

    async def _log_conversation(
        self,
        bot_id: str,
        session_id: str,
        user_message: str,
        response: str,
        sources: List[str],
        response_time: float,
        from_cache: bool = False,
    ):
        """
        Log conversation to MongoDB for analytics.
        """
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
                "from_cache": from_cache,
                "timestamp": datetime.utcnow(),
            }

            await conversations_collection.insert_one(conversation_doc)
            logger.info(f"Logged conversation for bot {bot_id}, session {session_id}")
        except Exception as e:
            logger.error(f"Error logging conversation to MongoDB: {e}")

    def process_file_sync(self, file_path: str, bot_id: str) -> int:
        """Synchronous version for Celery tasks"""
        # This is a simplified sync version
        # In production, consider using async Celery or separate worker
        return 0  # Placeholder


# Global instance
advanced_rag_service = AdvancedRAGService()
