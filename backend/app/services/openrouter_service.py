"""
OpenRouter Service
Unified client for accessing LLMs and embeddings through OpenRouter API.
Supports:
- Chat completions with multiple models
- Embeddings generation  
- Provider routing and fallbacks
- Caching and error handling
"""

import asyncio
import logging
import hashlib
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Optional, Union
from openai import AsyncOpenAI, OpenAI, OpenAIError
from app.core.config import settings
import time
import json

logger = logging.getLogger(__name__)


class OpenRouterService:
    """
    Service for interacting with OpenRouter API for both LLM and embeddings.
    Compatible with OpenAI SDK by using base_url override.
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        chat_model: Optional[str] = None,
        embedding_model: Optional[str] = None,
        site_url: Optional[str] = None,
        site_name: Optional[str] = None,
        enable_fallbacks: bool = True
    ):
        """
        Initialize OpenRouter client.
        
        Args:
            api_key: OpenRouter API key (defaults to settings)
            chat_model: Default chat model to use
            embedding_model: Default embedding model to use
            site_url: Your site URL for OpenRouter rankings
            site_name: Your site name for OpenRouter rankings
            enable_fallbacks: Enable automatic fallback to other providers
        """
        self.api_key = api_key or settings.OPENROUTER_API_KEY
        self.chat_model = chat_model or settings.OPENROUTER_CHAT_MODEL
        self.embedding_model = embedding_model or settings.OPENROUTER_EMBEDDING_MODEL
        self.enable_fallbacks = enable_fallbacks
        
        # Prepare headers
        headers = {"Content-Type": "application/json"}
        if site_url:
            headers["HTTP-Referer"] = site_url
        if site_name:
            headers["X-Title"] = site_name

        # Stored for AsyncOpenAI client reconstruction inside embed_batch_async
        self._default_headers = headers if len(headers) > 1 else None

        # Initialize OpenAI client with OpenRouter base URL
        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=self.api_key,
            default_headers=self._default_headers
        )
        
        logger.info(
            f"OpenRouter service initialized with chat_model={self.chat_model}, "
            f"embedding_model={self.embedding_model}"
        )
    
    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        stream: bool = False,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        response_format: Optional[Dict[str, str]] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
        provider_preferences: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate chat completion using OpenRouter.
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            model: Model to use (defaults to self.chat_model)
            stream: Enable streaming
            temperature: Sampling temperature [0, 2]
            max_tokens: Maximum tokens to generate
            response_format: Structured output format (e.g., {"type": "json_object"})
            tools: Tool definitions for function calling
            provider_preferences: Provider routing config
            **kwargs: Additional parameters passed to API
            
        Returns:
            Response dict with 'content', 'usage', 'model' etc.
        """
        model = model or self.chat_model
        
        try:
            start_time = time.time()
            
            # Build request parameters

            # Build request parameters
            params = {
                "model": model,
                "messages": messages,
                "stream": stream,
                "temperature": temperature,
                **kwargs
            }
            
            # Additional params go either directly or into extra_body for OpenAI client compatibility
            extra_body = {}
            if max_tokens:
                params["max_tokens"] = max_tokens
            if response_format:
                params["response_format"] = response_format
            if tools:
                params["tools"] = tools
                
            # Handle provider routing via extra_body
            if provider_preferences:
                extra_body["provider"] = provider_preferences
            elif self.enable_fallbacks:
                # Enable automatic fallbacks by default
                extra_body["provider"] = {"allow_fallbacks": True}
            
            if extra_body:
                params["extra_body"] = extra_body
            
            # Make API call
            response = self.client.chat.completions.create(**params)
            
            elapsed_time = time.time() - start_time
            
            # Parse response
            if stream:
                return response  # Return generator for streaming
            else:
                result = {
                    "content": response.choices[0].message.content,
                    "model": response.model,
                    "finish_reason": response.choices[0].finish_reason,
                    "usage": {
                        "prompt_tokens": response.usage.prompt_tokens,
                        "completion_tokens": response.usage.completion_tokens,
                        "total_tokens": response.usage.total_tokens,
                    },
                    "response_time": round(elapsed_time, 2)
                }
                
                # Add tool calls if present
                if hasattr(response.choices[0].message, 'tool_calls') and response.choices[0].message.tool_calls:
                    result["tool_calls"] = response.choices[0].message.tool_calls
                
                logger.info(f"Chat completion successful: model={response.model}, tokens={response.usage.total_tokens}, time={elapsed_time:.2f}s")
                return result
                
        except OpenAIError as e:
            logger.error(f"OpenRouter API error: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error in chat_completion: {str(e)}")
            raise
    
    def generate_embeddings(
        self,
        texts: Union[str, List[str]],
        model: Optional[str] = None,
        provider_preferences: Optional[Dict[str, Any]] = None
    ) -> List[List[float]]:
        """
        Generate embeddings for text(s) using OpenRouter.
        
        Args:
            texts: Single text string or list of texts
            model: Embedding model to use (defaults to self.embedding_model)
            provider_preferences: Provider routing config
            
        Returns:
            List of embedding vectors (one per input text)
        """
        model = model or self.embedding_model
        
        # Normalize input to list
        if isinstance(texts, str):
            texts = [texts]
            single_input = True
        else:
            single_input = False
        
        try:
            start_time = time.time()
            
            # Build request parameters

            # Build request parameters
            params = {
                "model": model,
                "input": texts
            }
            
            # Handle provider routing via extra_body for OpenAI client compatibility
            extra_body = {}
            if provider_preferences:
                extra_body["provider"] = provider_preferences
            elif self.enable_fallbacks:
                extra_body["provider"] = {"allow_fallbacks": True}
            
            if extra_body:
                params["extra_body"] = extra_body
            
            # Make API call
            response = self.client.embeddings.create(**params)
            elapsed_time = time.time() - start_time
            
            # Extract embeddings
            embeddings = [item.embedding for item in response.data]
            
            logger.info(
                f"Embeddings generated: model={model}, "
                f"texts={len(texts)}, dimensions={len(embeddings[0])}, "
                f"time={elapsed_time:.2f}s"
            )
            
            # Return single embedding if single input
            if single_input:
                return embeddings[0]
            return embeddings
            
        except OpenAIError as e:
            logger.error(f"OpenRouter embeddings API error: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error in generate_embeddings: {str(e)}")
            raise
    
    def embed_single(self, text: str, model: Optional[str] = None) -> List[float]:
        """
        Convenience method to generate embedding for a single text.
        
        Args:
            text: Text to embed
            model: Embedding model to use
            
        Returns:
            Embedding vector
        """
        return self.generate_embeddings(text, model=model)
    
    def _embed_single_batch_with_retry(
        self,
        batch: List[str],
        model: Optional[str],
        max_retries: int = 3
    ) -> List[List[float]]:
        """Wrap generate_embeddings with exponential backoff on RateLimitError (429)."""
        from openai import RateLimitError
        for attempt in range(max_retries):
            try:
                return self.generate_embeddings(batch, model=model)
            except RateLimitError:
                if attempt == max_retries - 1:
                    raise
                wait = 2 ** attempt  # 1s, 2s, 4s
                logger.warning(f"OpenRouter rate limit hit, retrying in {wait}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(wait)

    def embed_batch(
        self,
        texts: List[str],
        model: Optional[str] = None,
        batch_size: int = 100,
        max_workers: int = 3
    ) -> List[List[float]]:
        """
        Generate embeddings for large batches with parallel API calls.
        Uses ThreadPoolExecutor because generate_embeddings is I/O-bound (HTTP),
        so the GIL is released during network wait — threads run truly in parallel.
        max_workers=3 by default to avoid hitting OpenRouter rate limits when
        multiple Celery workers run simultaneously (4 workers × 3 threads = 12 calls).
        """
        batches = [texts[i:i + batch_size] for i in range(0, len(texts), batch_size)]
        all_embeddings: List[List[float]] = [None] * len(batches)

        with ThreadPoolExecutor(max_workers=min(max_workers, len(batches))) as executor:
            futures = {
                executor.submit(self._embed_single_batch_with_retry, batch, model): idx
                for idx, batch in enumerate(batches)
            }
            for future in as_completed(futures):
                idx = futures[future]
                all_embeddings[idx] = future.result()
                logger.debug(f"Embedding batch {idx + 1}/{len(batches)} completed")

        return [emb for batch_result in all_embeddings for emb in batch_result]

    async def embed_batch_async(
        self,
        texts: List[str],
        model: Optional[str] = None,
        batch_size: int = 100,
        concurrency: int = 3,
        max_retries: int = 3
    ) -> List[List[float]]:
        """
        Async version of embed_batch using asyncio.gather() + Semaphore.

        Tất cả batches được fired gần như cùng lúc. Semaphore giới hạn số batch
        đang active → thời gian tổng ≈ thời gian của batch chậm nhất (+ overhead nhỏ).

        NOTE: AsyncOpenAI client được tạo bên trong function (không phải __init__)
        vì mỗi asyncio.run() tạo event loop mới — client phải cùng loop với caller.
        """
        from openai import RateLimitError as AsyncRateLimitError

        batches = [texts[i:i + batch_size] for i in range(0, len(texts), batch_size)]
        all_embeddings: List[Optional[List[List[float]]]] = [None] * len(batches)
        sem = asyncio.Semaphore(concurrency)
        embed_model = model or self.embedding_model

        async def _fetch_one(idx: int, batch: List[str], client: AsyncOpenAI) -> None:
            async with sem:
                for attempt in range(max_retries):
                    try:
                        response = await client.embeddings.create(
                            model=embed_model,
                            input=batch
                        )
                        all_embeddings[idx] = [item.embedding for item in response.data]
                        logger.debug(f"Async embedding batch {idx + 1}/{len(batches)} done")
                        return
                    except AsyncRateLimitError:
                        if attempt == max_retries - 1:
                            raise
                        wait = 2 ** attempt  # 1s, 2s, 4s
                        logger.warning(
                            f"Rate limit hit on batch {idx + 1}, retry in {wait}s "
                            f"(attempt {attempt + 1}/{max_retries})"
                        )
                        await asyncio.sleep(wait)

        # AsyncOpenAI tạo ở đây — cùng event loop với asyncio.gather()
        async with AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=self.api_key,
            default_headers=self._default_headers
        ) as async_client:
            await asyncio.gather(*[
                _fetch_one(idx, batch, async_client)
                for idx, batch in enumerate(batches)
            ])

        return [emb for batch_result in all_embeddings for emb in batch_result]

    def test_connection(self) -> bool:
        """
        Test if OpenRouter API is accessible with current credentials.

        Returns:
            True if connection successful, False otherwise
        """
        try:
            # Simple test with minimal tokens
            response = self.chat_completion(
                messages=[{"role": "user", "content": "Hi"}],
                max_tokens=5
            )
            logger.info("OpenRouter connection test successful")
            return True
        except Exception as e:
            logger.error(f"OpenRouter connection test failed: {str(e)}")
            return False


# Singleton instance
_openrouter_service = None


def get_openrouter_service() -> OpenRouterService:
    """
    Get singleton instance of OpenRouterService.
    
    Returns:
        OpenRouterService instance
    """
    global _openrouter_service
    if _openrouter_service is None:
        _openrouter_service = OpenRouterService(
            site_url=getattr(settings, 'OPENROUTER_SITE_URL', None),
            site_name=getattr(settings, 'OPENROUTER_SITE_NAME', None),
            enable_fallbacks=getattr(settings, 'OPENROUTER_ENABLE_FALLBACKS', True)
        )
    return _openrouter_service
