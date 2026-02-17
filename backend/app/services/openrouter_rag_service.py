"""
OpenRouter-Enhanced RAG Service
Integrates OpenRouter for both LLM and embeddings in RAG pipeline.
Provides seamless migration path from existing services.
"""

import os
import logging

# --- ENABLE WRITABLE CACHE FOR DOCKER ---
model_cache_dir = os.getenv('HF_HOME', '/tmp/huggingface_cache')
try:
    # Try to create and check if writable
    os.makedirs(model_cache_dir, exist_ok=True)
    # Test writability by creating a temp file
    test_file = os.path.join(model_cache_dir, '.write_test')
    with open(test_file, 'w') as f:
        f.write('test')
    os.remove(test_file)
except (Exception, OSError) as e:
    # Fallback to /tmp if primary fails (usually due to Docker volume permissions)
    print(f"Warning: Primary cache {model_cache_dir} not writable ({e}). Falling back to /tmp/huggingface_cache")
    model_cache_dir = '/tmp/huggingface_cache'
    os.makedirs(model_cache_dir, exist_ok=True)

# Set all possible cache variables
os.environ['HF_HOME'] = model_cache_dir
os.environ['SENTENCE_TRANSFORMERS_HOME'] = model_cache_dir
os.environ['TRANSFORMERS_CACHE'] = model_cache_dir
os.environ['XDG_CACHE_HOME'] = model_cache_dir

try:
    # Clean up stale lock files if they exist
    if os.path.exists(model_cache_dir):
        for root, dirs, files in os.walk(model_cache_dir):
            for file in files:
                if file.endswith(".lock"):
                    try: os.remove(os.path.join(root, file))
                    except: pass
except Exception as e:
    print(f"Warning: Stale lock cleanup failed: {e}")

import time
import uuid
import asyncio
from typing import List, Dict, Any, Optional, AsyncGenerator, Union
from datetime import datetime
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import httpx

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

import json
import re

logger = logging.getLogger(__name__)


class OpenRouterAPIError(Exception):
    """Custom exception for OpenRouter API errors"""
    pass



# from sentence_transformers import CrossEncoder # Moved to lazy loading in _get_reranker

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
        
        # Initialize Redis client for caching
        try:
            import redis
            self.redis_client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            # Test connection
            self.redis_client.ping()
            logger.info("Redis connection established successfully")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}. Caching will be disabled.")
            self.redis_client = None
        
        # Get embedding dimensions (typically 1536 for text-embedding-3-small)
        self.embedding_dim = 1536  # Will be auto-detected on first embedding
        
        self._ensure_collection()
        
        # Deferred reranker initialization (lazy load)
        self.reranker = None
        self._reranker_attempted = False

        logger.info("OpenRouterRAGService initialized (Reranker will be loaded on demand)")

        logger.info("OpenRouterRAGService initialized successfully")
    
    def _ensure_collection(self):
        """Ensure Qdrant collection exists with proper configuration (Quantization + Indexing)."""
        try:
            self.qdrant_client.get_collection(self.collection_name)
            logger.info(f"Collection '{self.collection_name}' already exists")
        except Exception:
            logger.info(f"Creating collection '{self.collection_name}' with Scalar Quantization")
            
            # Create collection with Scalar Quantization (like notebook step 3)
            self.qdrant_client.create_collection(
                collection_name=self.collection_name,
                vectors_config=rest.VectorParams(
                    size=self.embedding_dim,
                    distance=rest.Distance.COSINE
                ),
                quantization_config=rest.ScalarQuantization(
                    scalar=rest.ScalarQuantizationConfig(
                        type=rest.ScalarType.INT8,
                        quantile=0.99,
                        always_ram=True
                    )
                )
            )
            
            # Create payload indexes for speed and keyword search
            logger.info("Creating payload indexes...")
            self.qdrant_client.create_payload_index(
                collection_name=self.collection_name,
                field_name="bot_id",
                field_schema=rest.PayloadSchemaType.KEYWORD
            )
            
            # Enable Full Text Search on the content field (Keyword search capability)
            self.qdrant_client.create_payload_index(
                collection_name=self.collection_name,
                field_name="text",
                field_schema=rest.TextIndexParams(
                    type="text",
                    tokenizer=rest.TokenizerType.MULTILINGUAL,
                    lowercase=True,
                    min_token_len=2,
                    max_token_len=20
                )
            )
            logger.info(f"Collection '{self.collection_name}' created successfully with indexes")
    
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
        chunking_strategy: str = "recursive",
        chunk_size: int = 1000,
        chunk_overlap: int = 200
    ) -> List[LangChainDocument]:
        """Split documents into chunks using specified strategy."""
        
        if chunking_strategy == "semantic":
            # Semantic chunking: split at sentence boundaries
            try:
                from langchain.text_splitter import SpacyTextSplitter
                text_splitter = SpacyTextSplitter(
                    chunk_size=chunk_size,
                    chunk_overlap=chunk_overlap,
                    pipeline="en_core_web_sm"
                )
                logger.info("Using semantic chunking with spacy")
            except Exception as e:
                logger.warning(f"Spacy not available ({e}), falling back to recursive")
                text_splitter = RecursiveCharacterTextSplitter(
                    chunk_size=chunk_size,
                    chunk_overlap=chunk_overlap,
                    separators=["\n\n", "\n", ". ", " ", ""]
                )
        else:  # recursive (default)
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                separators=["\n\n", "\n", ". ", " ", ""]
            )
        
        chunks = text_splitter.split_documents(documents)
        logger.info(f"Created {len(chunks)} chunks using {chunking_strategy} strategy")
        return chunks
    
    @retry(
        retry=retry_if_exception_type((httpx.HTTPError, OpenRouterAPIError, Exception)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True
    )
    def _embed_with_retry(self, text: str) -> List[float]:
        """Embed single text with retry logic"""
        try:
            return self.openrouter.embed_single(text)
        except Exception as e:
            logger.warning(f"Embedding attempt failed: {e}")
            raise OpenRouterAPIError(f"Embedding failed: {str(e)}")
    
    @retry(
        retry=retry_if_exception_type((httpx.HTTPError, OpenRouterAPIError, Exception)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True
    )
    def _chat_with_retry(self, messages: List[Dict], **kwargs) -> Dict:
        """Chat completion with retry logic"""
        try:
            return self.openrouter.chat_completion(messages=messages, **kwargs)
        except Exception as e:
            logger.warning(f"Chat completion attempt failed: {e}")
            raise OpenRouterAPIError(f"Chat completion failed: {str(e)}")
    
    def _get_reranker(self):
        """Lazy loader for the reranker model to speed up startup."""
        if self._reranker_attempted:
            return self.reranker
            
        self._reranker_attempted = True
        try:
            # Import here to avoid slow startup
            from sentence_transformers import CrossEncoder
            
            # Model cache directory (respects environment variable)
            model_cache_dir = os.getenv('HF_HOME', '/tmp/huggingface_cache')
            os.makedirs(model_cache_dir, exist_ok=True)
            
            logger.info(f"Loading Reranker Model (cross-encoder/ms-marco-MiniLM-L-6-v2) on demand (cache: {model_cache_dir})...")
            
            # Force both model and tokenizer to use the specified cache directory
            self.reranker = CrossEncoder(
                'cross-encoder/ms-marco-MiniLM-L-6-v2',
                automodel_args={'cache_dir': model_cache_dir},
                tokenizer_args={'cache_dir': model_cache_dir}
            )
            logger.info("Reranker model loaded successfully on demand")
        except Exception as e:
            logger.warning(f"Failed to load Reranker model on demand: {e}")
            self.reranker = None
            
        return self.reranker

    def _hybrid_search(
        self,
        bot_id: str,
        query: str,
        query_embedding: List[float],
        top_k: int = 5
    ) -> List[Dict]:
        """
        Hybrid retrieval with Re-ranking (Cross-Encoder).
        """
        # Fetch more candidates if reranker is active
        reranker = self._get_reranker()
        initial_limit = top_k * 5 if reranker else top_k * 2
        
        # 1. Vector search (Semantic retrieval)
        vector_results = self.qdrant_client.search(
            collection_name=self.collection_name,
            query_vector=query_embedding,
            query_filter=Filter(
                must=[FieldCondition(key="bot_id", match=MatchValue(value=bot_id))]
            ),
            limit=initial_limit,
            with_payload=True
        )
        
        candidates = []
        for result in vector_results:
             candidates.append({
                "text": result.payload["text"],
                "source": result.payload.get("source", "unknown"),
                "initial_score": result.score,
                "metadata": result.payload.get("metadata", {})
            })
            
        if not candidates:
            return []

        # 2. Re-ranking (if available)
        reranker = self._get_reranker()
        if reranker:
            try:
                import numpy as np
                pairs = [[query, c["text"]] for c in candidates]
                
                # Predict scores (logits)
                rerank_scores = reranker.predict(pairs) 
                
                # Ensure it's a list even if 1 item
                if isinstance(rerank_scores, float):
                    rerank_scores = [rerank_scores]
                
                # Sigmoid Normalization: 1 / (1 + exp(-x))
                # MiniLM logits -> 0..1 probability
                def sigmoid(x):
                    return 1 / (1 + np.exp(-x))
                
                norm_scores = sigmoid(np.array(rerank_scores))
                
                for i, c in enumerate(candidates):
                    c["hybrid_score"] = float(norm_scores[i])
                    c["rerank_raw"] = float(rerank_scores[i])
                    
                # Sort by rerank score
                candidates.sort(key=lambda x: x["hybrid_score"], reverse=True)
                
                top_score = candidates[0]["hybrid_score"]
                logger.info(f"Reranked {len(candidates)} items. Top Score: {top_score:.4f}")
                
            except Exception as e:
                logger.warning(f"Reranking failed: {e}. Falling back to simple scoring.")
                # Fallback logic below
                for c in candidates:
                    c["hybrid_score"] = c["initial_score"]
                candidates.sort(key=lambda x: x["hybrid_score"], reverse=True)
        else:
            # Fallback to previous Keyword+Vector mix logic
            query_terms = set(query.lower().split())
            for c in candidates:
                text = c["text"].lower()
                text_terms = set(text.split())
                keyword_overlap = len(query_terms & text_terms) / max(len(query_terms), 1)
                
                # Combine scores (70% semantic, 30% keyword)
                c["hybrid_score"] = (0.7 * c["initial_score"]) + (0.3 * keyword_overlap)
            
            candidates.sort(key=lambda x: x["hybrid_score"], reverse=True)
        
        return candidates[:top_k]
    
    async def _generate_hyde_query(self, query: str) -> str:
        """
        Generate hypothetical document using HyDE technique.
        Creates a synthetic answer that's embedded for better retrieval.
        """
        hyde_prompt = [
            {
                "role": "system",
                "content": "You are a helpful assistant that generates detailed, factual answers."
            },
            {
                "role": "user",
                "content": f"""Write a detailed, comprehensive answer to the following question. 
Even if you don't know the exact answer, write what a good answer would look like based on the question.

Question: {query}

Answer:"""
            }
        ]
        
        try:
            response = self._chat_with_retry(
                messages=hyde_prompt,
                temperature=0.3,
                max_tokens=200
            )
            hyde_doc = response["content"]
            logger.info(f"Generated HyDE document: {hyde_doc[:100]}...")
            return hyde_doc
        except Exception as e:
            logger.warning(f"HyDE generation failed, using original query: {e}")
            return query
    
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
            logger.info(f"Chunking document with strategy={chunking_strategy}, size={chunk_size}, overlap={chunk_overlap}")
            chunks = self._chunk_documents(
                documents, 
                chunking_strategy=chunking_strategy,
                chunk_size=chunk_size, 
                chunk_overlap=chunk_overlap
            )
            
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
                        await asyncio.to_thread(
                            self.qdrant_client.delete_collection,
                            self.collection_name
                        )
                    except:
                        pass
                    await asyncio.to_thread(self._ensure_collection)
            
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
            
            await asyncio.to_thread(
                self.qdrant_client.upsert,
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
            
            # Invalidate cache for this bot since knowledge base changed
            await self.invalidate_bot_cache_async(bot_id)
            
            return result
            
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    def process_file_sync(
        self,
        file_path: str,
        bot_id: str,
        filename: str,
        chunking_strategy: str = "recursive",
        chunk_size: int = 1000,
        chunk_overlap: int = 200
    ) -> Dict[str, Any]:
        """
        Synchronous file ingestion for Celery worker.
        """
        start_time = time.time()

        logger.info(f"Loading document: {filename}")
        documents = self._load_document(file_path, filename)

        logger.info(
            f"Chunking document with strategy={chunking_strategy}, size={chunk_size}, overlap={chunk_overlap}"
        )
        chunks = self._chunk_documents(
            documents,
            chunking_strategy=chunking_strategy,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )

        for chunk in chunks:
            chunk.metadata["bot_id"] = bot_id
            chunk.metadata["source"] = filename
            chunk.metadata["ingested_at"] = datetime.utcnow().isoformat()

        logger.info(f"Generating embeddings for {len(chunks)} chunks using OpenRouter")
        texts = [chunk.page_content for chunk in chunks]
        embeddings = self.openrouter.embed_batch(texts, batch_size=100)

        if embeddings:
            detected_dim = len(embeddings[0])
            if detected_dim != self.embedding_dim:
                logger.warning(
                    f"Embedding dimension mismatch. Expected {self.embedding_dim}, "
                    f"got {detected_dim}. Recreating collection..."
                )
                self.embedding_dim = detected_dim
                try:
                    self.qdrant_client.delete_collection(self.collection_name)
                except Exception:
                    pass
                self._ensure_collection()

        logger.info(f"Inserting {len(chunks)} vectors into Qdrant")
        points = []
        for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            point_id = hashlib.md5(
                f"{bot_id}_{filename}_{idx}_{chunk.page_content[:100]}".encode()
            ).hexdigest()

            points.append(
                PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload={
                        "bot_id": bot_id,
                        "source": filename,
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
            "filename": filename,
            "chunks_created": len(chunks),
            "vectors_inserted": len(points),
            "embedding_dim": self.embedding_dim,
            "processing_time": round(elapsed_time, 2),
            "preview": chunks[0].page_content[:500] if chunks else "No content extracted",
            "model_used": self.openrouter.embedding_model
        }

        logger.info(f"File ingestion complete: {result}")
        self.invalidate_bot_cache(bot_id)

        return result
    
    async def _rewrite_query(self, query: str) -> str:
        """
        Agentic Layer: Rewrite user query to be search-engine friendly.
        Based on the notebook logic.
        """
        system_prompt = """
        Bạn là một chuyên gia tối ưu hóa tìm kiếm (SEO) cho hệ thống RAG.
        Nhiệm vụ của bạn là viết lại câu hỏi của người dùng thành một câu truy vấn tìm kiếm ngắn gọn, súc tích và chứa nhiều từ khóa quan trọng.
        Giữ nguyên ý nghĩa, chỉ thay đổi cấu trúc để dễ tìm kiếm hơn.
        KHÔNG TRẢ LỜI CÂU HỎI. CHỈ VIẾT LẠI QUERY.
        
        Ví dụ:
        - User: "cái app này đăng nhập không được, nó báo lỗi tùm lum tà la"
        - Rewrite: "lỗi không đăng nhập được ứng dụng mobile báo lỗi hệ thống"
        - User: "figure 2 là cái gì"
        - Rewrite: "chi tiết mô tả nội dung Figure 2 hình ảnh 2 trong tài liệu"
        """
        
        try:
            # Quick call to LLM
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": query}
            ]
            
            # Use asyncio.to_thread for synchronous generic call
            response = await asyncio.to_thread(
                self.openrouter.chat_completion,
                messages=messages,
                model="openai/gpt-4o-mini", 
                temperature=0.1
            )
            
            rewritten_query = response.get("content", "").strip()
            logger.info(f"Query Rewriting: '{query}' -> '{rewritten_query}'")
            return rewritten_query
            
        except Exception as e:
            logger.warning(f"Query rewriting failed: {e}. Using original query.")
            return query

    async def chat(
        self,
        bot_id: str,
        query: str,
        bot_config: Optional[Dict[str, Any]] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        session_id: Optional[str] = None,
        top_k: int = 5,
        use_cache: bool = True
    ) -> Dict[str, Any]:
        """
        Chat with bot using OpenRouter with Agentic Query Rewriting and Reranking.
        """
        start_time = time.time()
        session_id = session_id or str(uuid.uuid4())
        bot_config = bot_config or {}
        
        # 1. Check Redis cache
        if use_cache and self.redis_client:
            cache_key = f"chat:{bot_id}:{hashlib.md5(query.encode()).hexdigest()}"
            try:
                cached_str = await asyncio.to_thread(self.redis_client.get, cache_key)
                if cached_str:
                    logger.info(f"Cache HIT for query: {query[:50]}...")
                    result = json.loads(cached_str)
                    result["from_cache"] = True
                    # Recalculate response time
                    result["response_time"] = round(time.time() - start_time, 3)
                    return result
            except Exception as e:
                logger.warning(f"Redis error: {e}")
        
        # Prepare context (retrieval, reranking, agent logs)
        prep = await self._prepare_chat_context(bot_id, query, bot_config, top_k)
        search_query = prep["search_query"]
        filtered_results = prep["filtered_results"]
        agent_logs = prep["agent_logs"]
        context = prep["context"]
        sources = prep["sources"]
        
        try:
            # 7. LLM Generation
            agent_logs.append({
                "step": "Answer Synthesis",
                "description": f"Generating grounded response using {len(filtered_results)} retrieved segments.",
                "timestamp": datetime.utcnow().isoformat()
            })

            base_system_prompt = bot_config.get("system_prompt", "You are a helpful assistant.")
            model = bot_config.get("model", "openai/gpt-4o-mini")
            temperature = bot_config.get("temperature", 0.7)
            max_tokens = bot_config.get("max_tokens", 1000)

            if context:
                # Kotaemon-style grounded prompt
                effective_system_prompt = (
                    f"{base_system_prompt}\n\n"
                    "CÁCH TRẢ LỜI (QUY TẮC BẮT BUỘC):\n"
                    "1. Sử dụng DUY NHẤT ngữ cảnh được cung cấp dưới đây để trả lời.\n"
                    "2. Nếu thông tin không có trong ngữ cảnh, hãy nói rằng bạn không biết, KHÔNG tự chế câu trả lời.\n"
                    "3. TRÍCH DẪN NGUỒN: Sử dụng ký hiệu [[n]] (ví dụ [[1]], [[2]]) ngay sau câu hoặc cụm từ trích dẫn thông tin từ Segment tương ứng.\n"
                    "4. Luôn trả lời bằng ngôn ngữ của người dùng (Tiếng Việt).\n\n"
                    f"CONTEXT (TÀI LIỆU TRÍCH XUẤT):\n{context}"
                )
                user_content = query
            else:
                effective_system_prompt = base_system_prompt
                user_content = query

            messages = [
                {"role": "system", "content": effective_system_prompt},
                {"role": "user", "content": user_content}
            ]
            
            if conversation_history:
                messages[1:1] = conversation_history[-5:]

            llm_response = await asyncio.to_thread(
                self._chat_with_retry,
                messages=messages,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens
            )
            
            response_text = llm_response["content"]
            usage = llm_response["usage"]
            response_time = time.time() - start_time

            # 8. Reasoning Summary
            reasoning = prep["reasoning"]

            # 9. Prepare result
            result = {
                "response": response_text,
                "sources": sources,
                "retrieved_chunks": filtered_results,
                "agent_logs": agent_logs,
                "reasoning": reasoning,
                "model": model,
                "usage": {
                    "prompt_tokens": usage["prompt_tokens"],
                    "completion_tokens": usage["completion_tokens"],
                    "total_tokens": usage["total_tokens"]
                },
                "response_time": round(response_time, 3),
                "session_id": session_id,
                "from_cache": False,
                "message_id": str(uuid.uuid4()),
                "search_query": search_query,
                "system_prompt": effective_system_prompt
            }
            
            # 9. Cache response
            if use_cache and self.redis_client:
                try:
                    # Remove session-specific or dynamic fields before caching if desired
                    # But for simple full-response caching we can cache mostly everything.
                    # Ideally we don't cache session_id or message_id if they are unique per request.
                    cache_payload = result.copy()
                    cache_payload.pop("session_id", None)
                    cache_payload.pop("message_id", None)
                    cache_payload["from_cache"] = True
                    
                    await asyncio.to_thread(
                        self.redis_client.setex,
                        cache_key,
                        3600, # 1 hour TTL
                        json.dumps(cache_payload)
                    )
                except Exception as e:
                    logger.warning(f"Failed to write to Redis cache: {e}")

            # 10. Log conversation
            try:
                await self._log_conversation(
                    bot_id=bot_id,
                    session_id=session_id,
                    user_id=bot_config.get("user_id"),
                    user_message=query,
                    response=response_text,
                    sources=sources,
                    response_time=response_time,
                    model=model,
                    usage=usage,
                    retrieved_chunks=filtered_results,
                    reasoning=reasoning,
                    search_query=search_query,
                    agent_logs=agent_logs
                )
            except Exception as e:
                logger.error(f"Failed to log conversation: {e}")

            return result
            
        except Exception as e:
            logger.error(f"Error in chat: {str(e)}")
            raise
    
    async def _prepare_chat_context(
        self,
        bot_id: str,
        query: str,
        bot_config: Dict[str, Any],
        top_k: int = 5
    ) -> Dict[str, Any]:
        """Helper to handle retrieval, reranking, and agent logging."""
        agent_logs = []
        
        # 2. Agentic Query Rewriting
        agent_logs.append({
            "step": "Analyzing Query",
            "description": f"Rewriting question for optimal search: '{query[:40]}...'",
            "timestamp": datetime.utcnow().isoformat()
        })
        search_query = await self._rewrite_query(query)
        
        # 3. Generate embeddings
        agent_logs.append({
            "step": "Vectorization",
            "description": "Generating embeddings for the optimized search query.",
            "timestamp": datetime.utcnow().isoformat()
        })
        query_embedding = self._embed_with_retry(search_query)
        
        # 4. Search & Rerank
        agent_logs.append({
            "step": "Knowledge Retrieval",
            "description": "Searching knowledge base for relevant context.",
            "timestamp": datetime.utcnow().isoformat()
        })
        search_results = await asyncio.to_thread(
            self._hybrid_search,
            bot_id=bot_id,
            query=search_query,
            query_embedding=query_embedding,
            top_k=top_k
        )
        
        if self.reranker:
            agent_logs.append({
                "step": "Cross-Encoder Reranking",
                "description": f"Refining {len(search_results)} candidates for maximum relevance.",
                "status": "done",
                "timestamp": datetime.utcnow().isoformat()
            })

        similarity_threshold = bot_config.get("similarity_threshold", 0.15)
        filtered_results = [
            r for r in search_results 
            if r.get("hybrid_score", 0) >= similarity_threshold
        ]
        
        if not filtered_results and search_results:
            filtered_results = search_results

        context_docs = []
        sources = []
        context_docs = []
        sources = []
        
        # Smart highlights from Backend
        for idx, result in enumerate(filtered_results):
            doc_id = idx + 1
            # Add highlights to each result chunk
            result["highlights"] = self._extract_smart_highlights(search_query, result.get("text", ""))
            
            context_docs.append(f"[[{doc_id}]] Source: {result.get('source', 'Unknown')}\n{result['text']}")
            source_name = result.get("source", "Unknown")
            if source_name not in sources:
                sources.append(source_name)
        
        context = "\n---\n".join(context_docs)
        
        # Reasoning Summary
        reasoning = f"I've analyzed {len(filtered_results)} segments from {len(sources)} documents. "
        if filtered_results:
            top_score = filtered_results[0].get('hybrid_score', 0)
            reasoning += f"The most relevant source is '{filtered_results[0].get('source')}' with a confidence score of {top_score:.2f}."

        return {
            "search_query": search_query,
            "filtered_results": filtered_results,
            "agent_logs": agent_logs,
            "context": context,
            "sources": sources,
            "reasoning": reasoning
        }

    def _extract_smart_highlights(self, query: str, text: str) -> List[str]:
        """Backend smart highlight logic: filters noise and identifies key terms."""
        if not query or not text:
            return []
            
        # 1. Clean query and extract candidates
        # Remove common punctuation and split
        words = re.findall(r'\w+', query.lower())
        
        # 2. Vietnamese stop words + common conversational filler
        stop_words = {
            'tàu', 'xe', 'chạy', 'cho', 'của', 'là', 'có', 'không', 'trong', 'về', 'nhé', 
            'em', 'được', 'tại', 'vào', 'ngày', 'lúc', 'để', 'đến', 'với', 'cần', 'hỏi'
        }
        
        candidates = [w for w in words if len(w) > 1 and w not in stop_words]
        
        # 3. Look for "High Value" patterns (Mã hiệu, số hiệu like SNT1, SE4, 24/11)
        # We can use regex to find codes in the text that are also partially in the query
        highlights = []
        for cand in candidates:
            # Simple match for now, could be improved with fuzzy match or NER
            if cand in text.lower():
                # Try to find the original casing from the text
                matches = re.findall(re.escape(cand), text, re.IGNORECASE)
                if matches:
                    highlights.extend(list(set(matches)))
        
        # Unique and sorted by length
        return sorted(list(set(highlights)), key=len, reverse=True)[:10]

    async def chat_stream(
        self,
        bot_id: str,
        query: str,
        bot_config: Optional[Dict[str, Any]] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        session_id: Optional[str] = None,
        top_k: int = 5,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Streaming version of chat using AsyncGenerator."""
        start_time = time.time()
        session_id = session_id or str(uuid.uuid4())
        bot_config = bot_config or {}
        
        # --- STREAMING THINKING PROCESS START ---
        agent_logs = []
        
        # 1. Analyzing Query
        log_analyzing = {
            "step": "Analyzing Query",
            "description": f"Rewriting question for optimal search: '{query[:40]}...'",
            "timestamp": datetime.utcnow().isoformat()
        }
        agent_logs.append(log_analyzing)
        yield {"type": "log", "log": log_analyzing}
        
        search_query = await self._rewrite_query(query)
        
        # 2. Vectorization
        log_vectorizing = {
            "step": "Vectorization",
            "description": "Generating embeddings for the optimized search query.",
            "timestamp": datetime.utcnow().isoformat()
        }
        agent_logs.append(log_vectorizing)
        yield {"type": "log", "log": log_vectorizing}
        
        query_embedding = self._embed_with_retry(search_query)
        
        # 3. Knowledge Retrieval
        log_retrieval = {
            "step": "Knowledge Retrieval",
            "description": "Searching knowledge base for relevant context.",
            "timestamp": datetime.utcnow().isoformat()
        }
        agent_logs.append(log_retrieval)
        yield {"type": "log", "log": log_retrieval}
        
        search_results = await asyncio.to_thread(
            self._hybrid_search,
            bot_id=bot_id,
            query=search_query,
            query_embedding=query_embedding,
            top_k=top_k
        )
        
        # 4. Filter & Rerank (Internal logic, yield log if significant)
        similarity_threshold = bot_config.get("similarity_threshold", 0.15)
        filtered_results = [
            r for r in search_results 
            if r.get("hybrid_score", 0) >= similarity_threshold
        ]
        if not filtered_results and search_results:
            filtered_results = search_results

        # Prepare context and sources
        sources = []
        context_docs = []
        for idx, result in enumerate(filtered_results):
            doc_id = idx + 1
            result["highlights"] = self._extract_smart_highlights(search_query, result.get("text", ""))
            context_docs.append(f"[[{doc_id}]] Source: {result.get('source', 'Unknown')}\n{result['text']}")
            source_name = result.get("source", "Unknown")
            if source_name not in sources:
                sources.append(source_name)
        
        context = "\n---\n".join(context_docs)
        reasoning = f"I've analyzed {len(filtered_results)} segments from {len(sources)} documents."
        if filtered_results:
            top_score = filtered_results[0].get('hybrid_score', 0)
            reasoning += f" Top relevance: {top_score:.2f}."

        # Yield metadata (FINAL context results)
        yield {
            "type": "metadata",
            "sources": sources,
            "retrieved_chunks": filtered_results,
            "agent_logs": agent_logs, # Full list for final state
            "reasoning": reasoning,
            "search_query": search_query,
            "session_id": session_id
        }

        # 5. Answer Synthesis Log
        log_synthesis = {
            "step": "Answer Synthesis",
            "description": f"Generating grounded response using {len(filtered_results)} retrieved segments.",
            "timestamp": datetime.utcnow().isoformat()
        }
        agent_logs.append(log_synthesis)
        yield {"type": "log", "log": log_synthesis}
        # --- STREAMING THINKING PROCESS END ---

        # Setup LLM Generation
        base_system_prompt = bot_config.get("system_prompt", "You are a helpful assistant.")
        model = bot_config.get("model", "openai/gpt-4o-mini")
        temperature = bot_config.get("temperature", 0.7)
        max_tokens = bot_config.get("max_tokens", 1000)

        if context:
            effective_system_prompt = (
                f"{base_system_prompt}\n\n"
                "CÁCH TRẢ LỜI (QUY TẮC BẮT BUỘC):\n"
                "1. Sử dụng DUY NHẤT ngữ cảnh được cung cấp dưới đây để trả lời.\n"
                "2. Nếu thông tin không có trong ngữ cảnh, hãy nói rằng bạn không biết, KHÔNG tự chế câu trả lời.\n"
                "3. TRÍCH DẪN NGUỒN: Sử dụng ký hiệu [[n]] (ví dụ [[1]], [[2]]) ngay sau câu hoặc cụm từ trích dẫn thông tin từ Segment tương ứng.\n"
                "4. Luôn trả lời bằng ngôn ngữ của người dùng (Tiếng Việt).\n\n"
                f"CONTEXT (TÀI LIỆU TRÍCH XUẤT):\n{context}"
            )
            user_content = query
        else:
            effective_system_prompt = base_system_prompt
            user_content = query

        messages = [
            {"role": "system", "content": effective_system_prompt},
            {"role": "user", "content": user_content}
        ]
        if conversation_history:
            messages[1:1] = conversation_history[-5:]

        # Streaming from OpenRouter
        full_response = ""
        try:
            # We use asyncio.to_thread for the sync generator from OpenAI SDK
            stream = await asyncio.to_thread(
                self.openrouter.chat_completion,
                messages=messages,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True
            )
            
            for chunk in stream:
                if hasattr(chunk.choices[0], 'delta') and hasattr(chunk.choices[0].delta, 'content'):
                    content = chunk.choices[0].delta.content
                    if content:
                        full_response += content
                        yield {"type": "content", "content": content}
            
            # Log final conversation
            # Log the final state correctly using local variables
            await self._log_conversation(
                bot_id=bot_id,
                session_id=session_id or "default",
                user_id=bot_config.get("user_id"),
                user_message=query,
                response=full_response,
                sources=sources,
                response_time=time.time() - start_time,
                model=model,
                usage={"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                retrieved_chunks=filtered_results,
                reasoning=reasoning,
                search_query=search_query,
                agent_logs=agent_logs
            )
            
            yield {"type": "done"}
            
        except Exception as e:
            logger.error(f"Error in chat_stream: {e}")
            yield {"type": "error", "message": str(e)}

    async def _log_conversation(
        self,
        bot_id: str,
        session_id: str,
        user_id: Optional[str],
        user_message: str,
        response: str,
        sources: List[str],
        response_time: float,
        model: str,
        usage: Dict[str, int],
        retrieved_chunks: Optional[List[Dict]] = None,
        reasoning: Optional[str] = None,
        search_query: Optional[str] = None,
        agent_logs: Optional[List[Dict]] = None
    ):
        """Log conversation to MongoDB and maintain session list."""
        try:
            mongo_db = await get_mongodb()
            conversations_collection = mongo_db.conversations
            sessions_collection = mongo_db.sessions
            
            now = datetime.utcnow()
            
            # 1. Log the individual message
            conversation_doc = {
                "bot_id": bot_id,
                "session_id": session_id,
                "user_id": user_id,
                "user_message": user_message,
                "response": response,
                "sources": sources,
                "response_time": round(response_time, 2),
                "model": model,
                "usage": usage,
                "retrieved_chunks": retrieved_chunks,
                "reasoning": reasoning,
                "search_query": search_query,
                "agent_logs": agent_logs,
                "timestamp": now,
                "provider": "openrouter"
            }
            
            await conversations_collection.insert_one(conversation_doc)
            
            # 2. Update or Create session
            # We want to create the session record if it doesn't exist
            # And potentially update the title if it's the first message
            session = await sessions_collection.find_one({"session_id": session_id})
            
            if not session:
                # First message in this session!
                title = user_message[:50] + ("..." if len(user_message) > 50 else "")
                
                await sessions_collection.insert_one({
                    "session_id": session_id,
                    "bot_id": bot_id,
                    "user_id": user_id,
                    "title": title,
                    "created_at": now,
                    "updated_at": now
                })
                logger.info(f"Created new session: {session_id} with title: {title}")
                
                # Async: Try to generate a better title using LLM
                asyncio.create_task(self._summarize_session_title(session_id, user_message))
            else:
                # Existing session, just update last activity
                await sessions_collection.update_one(
                    {"session_id": session_id},
                    {"$set": {"updated_at": now}}
                )
            
            logger.debug(f"Conversation logged: session_id={session_id}")
            
        except Exception as e:
            logger.error(f"Error logging conversation: {e}")

    async def _summarize_session_title(self, session_id: str, first_message: str):
        """Generate a short (3-5 words) title from the first message."""
        try:
            prompt = [
                {"role": "system", "content": "You are a helpful assistant. Create a very short title (max 5 words) for a chat conversation starting with the user message below. Output ONLY the title, no quotes or prefix. Language should match the user message."},
                {"role": "user", "content": first_message}
            ]
            response = await asyncio.to_thread(
                self.openrouter.chat_completion,
                messages=prompt,
                model="openai/gpt-4o-mini",
                temperature=0.3,
                max_tokens=20
            )
            title = response.get("content", "").strip().strip('"').strip("'")
            if title:
                mongo_db = await get_mongodb()
                await mongo_db.sessions.update_one(
                    {"session_id": session_id},
                    {"$set": {"title": title}}
                )
                logger.debug(f"Updated session {session_id} title to: {title}")
        except Exception as e:
            logger.warning(f"Failed to summarize session title: {e}")

    async def get_sessions(
        self,
        bot_id: str,
        user_id: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """List all chat sessions for a bot and user."""
        try:
            mongo_db = await get_mongodb()
            sessions_collection = mongo_db.sessions
            
            query = {"bot_id": bot_id}
            if user_id:
                query["user_id"] = user_id
            
            cursor = sessions_collection.find(query).sort("updated_at", -1).limit(limit)
            sessions = await cursor.to_list(length=limit)
            
            # Format for frontend
            return [{
                "id": s["session_id"],
                "title": s["title"],
                "updated_at": s["updated_at"].isoformat() if isinstance(s["updated_at"], datetime) else s.get("updated_at"),
                "created_at": s["created_at"].isoformat() if isinstance(s["created_at"], datetime) else s.get("created_at")
            } for s in sessions]
        except Exception as e:
            logger.error(f"Error retrieving sessions: {e}")
            return []

    async def get_chat_history(
        self,
        bot_id: str,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Retrieve recent chat history for a bot, specific session preferred."""
        try:
            mongo_db = await get_mongodb()
            conversations_collection = mongo_db.conversations
            
            query = {"bot_id": bot_id}
            if session_id:
                query["session_id"] = session_id
            elif user_id:
                query["user_id"] = user_id
            
            cursor = conversations_collection.find(query).sort("timestamp", -1).limit(limit)
            conversations = await cursor.to_list(length=limit)
            
            history = []
            for conv in reversed(conversations):
                history.append({
                    "id": f"{conv['_id']}_u",
                    "role": "user",
                    "content": conv["user_message"],
                    "timestamp": conv["timestamp"].isoformat() if isinstance(conv["timestamp"], datetime) else conv.get("timestamp")
                })
                history.append({
                    "id": f"{conv['_id']}_a",
                    "message_id": str(conv["_id"]),
                    "role": "assistant",
                    "content": conv["response"],
                    "timestamp": conv["timestamp"].isoformat() if isinstance(conv["timestamp"], datetime) else conv.get("timestamp"),
                    "sources": conv.get("sources", []),
                    "retrieved_chunks": conv.get("retrieved_chunks", []),
                    "reasoning": conv.get("reasoning", ""),
                    "agent_logs": conv.get("agent_logs", []),
                    "search_query": conv.get("search_query", "")
                })
            
            return history
        except Exception as e:
            logger.error(f"Error retrieving chat history: {e}")
            return []

    async def delete_session(
        self,
        bot_id: str,
        session_id: str,
        user_id: Optional[str] = None
    ) -> bool:
        """Delete a specific chat session and all its messages."""
        try:
            mongo_db = await get_mongodb()
            conversations_collection = mongo_db.conversations
            sessions_collection = mongo_db.sessions
            
            # Build query
            query = {"bot_id": bot_id, "session_id": session_id}
            if user_id:
                query["user_id"] = user_id
            
            # Delete messages
            conv_result = await conversations_collection.delete_many(query)
            
            # Delete session
            session_result = await sessions_collection.delete_one(query)
            
            logger.info(f"Deleted session {session_id} and {conv_result.deleted_count} messages")
            return session_result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error deleting session: {e}")
            return False

    async def clear_all_history(
        self,
        bot_id: str,
        user_id: Optional[str] = None
    ) -> bool:
        """Delete all chat sessions and messages for a bot and user."""
        try:
            mongo_db = await get_mongodb()
            conversations_collection = mongo_db.conversations
            sessions_collection = mongo_db.sessions
            
            query = {"bot_id": bot_id}
            if user_id:
                query["user_id"] = user_id
            
            # Delete all messages
            conv_result = await conversations_collection.delete_many(query)
            
            # Delete all sessions
            session_result = await sessions_collection.delete_many(query)
            
            logger.info(f"Cleared all history for bot {bot_id}: {session_result.deleted_count} sessions, {conv_result.deleted_count} messages")
            return True
        except Exception as e:
            logger.error(f"Error clearing history: {e}")
            return False
    
    def invalidate_bot_cache(self, bot_id: str):
        """Invalidate all cached queries for a specific bot."""
        if not self.redis_client:
            return
        
        try:
            pattern = f"rag:chat:{bot_id}:*"
            cursor = 0
            deleted_count = 0
            
            while True:
                cursor, keys = self.redis_client.scan(
                    cursor=cursor,
                    match=pattern,
                    count=100
                )
                if keys:
                    self.redis_client.delete(*keys)
                    deleted_count += len(keys)
                if cursor == 0:
                    break
            
            logger.info(f"Invalidated {deleted_count} cached queries for bot {bot_id}")
        except Exception as e:
            logger.error(f"Cache invalidation failed for bot {bot_id}: {e}")

    async def invalidate_bot_cache_async(self, bot_id: str):
        """Async wrapper to avoid blocking event loop."""
        if not self.redis_client:
            return
        await asyncio.to_thread(self.invalidate_bot_cache, bot_id)


# Singleton instance
_openrouter_rag_service = None


def get_openrouter_rag_service() -> OpenRouterRAGService:
    """Get singleton instance of OpenRouterRAGService."""
    global _openrouter_rag_service
    if _openrouter_rag_service is None:
        _openrouter_rag_service = OpenRouterRAGService()
    return _openrouter_rag_service
