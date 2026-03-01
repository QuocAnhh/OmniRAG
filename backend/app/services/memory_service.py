"""
OmniRAG Memory Service — Powered by Mem0 (self-hosted, open-source)

Persistent memory layer for all OmniRAG bot conversations.
Uses existing Qdrant instance for vector storage — no new infrastructure required.

Memory flow per conversation turn:
  1. BEFORE: search(query, user_id) → retrieve relevant past facts
  2. Inject facts into system prompt for personalized responses
  3. AFTER: add(messages, user_id) → extract and store new facts (async, non-blocking)

Mem0 memory types used:
  - user_id : long-lived user facts (name, preferences, history)
  - session_id: short-lived session context
  - bot_id in metadata: isolates memories per bot
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class MemoryService:
    """
    Wrapper around Mem0's Memory class with async support and graceful degradation.
    If Mem0 fails to initialize (e.g., Qdrant not ready), service degrades silently
    and the bot continues working — just without persistent memory.
    """

    def __init__(self):
        self._mem0 = None
        self._enabled = False
        self._initialize()

    def _initialize(self):
        """Initialize Mem0 with OmniRAG's existing Qdrant and OpenRouter config."""
        try:
            from mem0 import Memory
            from app.core.config import settings

            if not getattr(settings, "MEM0_ENABLED", True):
                logger.info("Mem0 disabled via MEM0_ENABLED=false")
                return

            config = {
                "vector_store": {
                    "provider": "qdrant",
                    "config": {
                        "collection_name": getattr(settings, "MEM0_COLLECTION_NAME", "omnirag_memories"),
                        "host": settings.QDRANT_HOST,
                        "port": settings.QDRANT_PORT,
                        "embedding_model_dims": 1536,
                        "on_disk": False,
                    }
                },
                "llm": {
                    "provider": "openai",
                    "config": {
                        "api_key": settings.OPENROUTER_API_KEY,
                        "openai_base_url": "https://openrouter.ai/api/v1",
                        "model": getattr(settings, "MEM0_MEMORY_MODEL", "openai/gpt-4o-mini"),
                    }
                },
                "embedder": {
                    "provider": "openai",
                    "config": {
                        "api_key": settings.OPENROUTER_API_KEY,
                        "openai_base_url": "https://openrouter.ai/api/v1",
                        "model": settings.OPENROUTER_EMBEDDING_MODEL,
                    }
                },
                # Disable graph store — requires Neo4j, not worth the complexity
                "graph_store": {
                    "provider": "none"
                }
            }

            self._mem0 = Memory.from_config(config)
            self._enabled = True
            logger.info("✅ Mem0 MemoryService initialized successfully (Qdrant backend)")

        except ImportError:
            logger.warning("⚠️ mem0ai not installed — memory disabled. Run: pip install mem0ai")
        except Exception as e:
            logger.warning(f"⚠️ Mem0 init failed — memory disabled (bot still works): {e}")

    @property
    def is_enabled(self) -> bool:
        return self._enabled and self._mem0 is not None

    # ─── Core Operations (all async via asyncio.to_thread) ───────────────

    async def search(
        self,
        query: str,
        user_id: str,
        bot_id: str,
        top_k: int = 5,
    ) -> List[str]:
        """
        Retrieve relevant memories for a user before generating a response.
        Returns a list of plain-text memory strings ready for prompt injection.

        Args:
            query: The current user message (used for semantic similarity)
            user_id: Stable user identifier (DB user ID, Zalo chat_id, etc.)
            bot_id: Bot identifier to scope memories per-bot
            top_k: Number of memories to return

        Returns:
            List of memory strings, e.g. ["Tên: Nguyễn Văn A", "Hay đặt từ Quận 1"]
        """
        if not self.is_enabled or not user_id:
            return []

        try:
            results = await asyncio.to_thread(
                self._mem0.search,
                query=query,
                user_id=user_id,
                limit=top_k,
                filters={"bot_id": bot_id},
            )
            memories = [r["memory"] for r in results.get("results", []) if r.get("memory")]
            if memories:
                logger.debug(f"[Memory] Retrieved {len(memories)} memories for user={user_id}, bot={bot_id}")
            return memories

        except Exception as e:
            logger.warning(f"[Memory] search failed (non-critical, continuing): {e}")
            return []

    async def add(
        self,
        messages: List[Dict[str, str]],
        user_id: str,
        bot_id: str,
        session_id: Optional[str] = None,
    ) -> None:
        """
        Extract key facts from the conversation turn and store them as memories.
        Mem0 uses an LLM internally to extract structured facts (not raw text).

        This should be called AFTER the response is generated, as a background task.
        It is async non-blocking — callers should use asyncio.create_task().

        Args:
            messages: [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
            user_id: Stable user identifier
            bot_id: Bot identifier (stored in metadata for filtering)
            session_id: Optional session scope for short-lived context
        """
        if not self.is_enabled or not user_id:
            return

        try:
            metadata = {"bot_id": bot_id}
            kwargs = {
                "messages": messages,
                "user_id": user_id,
                "metadata": metadata,
            }
            if session_id:
                kwargs["session_id"] = session_id

            await asyncio.to_thread(self._mem0.add, **kwargs)
            logger.debug(f"[Memory] Saved turn for user={user_id}, bot={bot_id}")

        except Exception as e:
            logger.warning(f"[Memory] add failed (non-critical, continuing): {e}")

    async def get_all(
        self,
        user_id: str,
        bot_id: str,
    ) -> List[Dict[str, Any]]:
        """
        Get all stored memories for a user (for admin UI / debug).

        Returns:
            List of memory dicts with keys: id, memory, created_at, metadata
        """
        if not self.is_enabled or not user_id:
            return []

        try:
            results = await asyncio.to_thread(
                self._mem0.get_all,
                user_id=user_id,
                filters={"bot_id": bot_id},
            )
            return results.get("results", [])
        except Exception as e:
            logger.warning(f"[Memory] get_all failed: {e}")
            return []

    async def delete_memory(self, memory_id: str) -> bool:
        """Delete a single memory by its ID."""
        if not self.is_enabled:
            return False
        try:
            await asyncio.to_thread(self._mem0.delete, memory_id=memory_id)
            return True
        except Exception as e:
            logger.warning(f"[Memory] delete failed: {e}")
            return False

    async def delete_all(
        self,
        user_id: str,
        bot_id: str,
    ) -> int:
        """
        Delete ALL memories for a user+bot pair. Used for GDPR compliance.

        Returns:
            Number of memories deleted
        """
        if not self.is_enabled or not user_id:
            return 0

        try:
            all_memories = await self.get_all(user_id, bot_id)
            delete_tasks = [
                asyncio.to_thread(self._mem0.delete, memory_id=m["id"])
                for m in all_memories
                if m.get("id")
            ]
            if delete_tasks:
                await asyncio.gather(*delete_tasks, return_exceptions=True)
            logger.info(f"[Memory] Deleted {len(all_memories)} memories for user={user_id}, bot={bot_id}")
            return len(all_memories)
        except Exception as e:
            logger.warning(f"[Memory] delete_all failed: {e}")
            return 0

    def build_memory_prompt_block(self, memories: List[str]) -> str:
        """
        Format memory list into a system prompt block.
        Called inside the RAG service to inject memories into the prompt.

        Returns:
            Formatted string block, or empty string if no memories
        """
        if not memories:
            return ""

        lines = "\n".join(f"  - {m}" for m in memories)
        return (
            "THÔNG TIN ĐÃ BIẾT VỀ NGƯỜI DÙNG (từ lịch sử trò chuyện trước):\n"
            f"{lines}\n"
            "Hãy sử dụng thông tin này để cá nhân hoá câu trả lời.\n\n"
        )


# ─── Global singleton ──────────────────────────────────────────────────────────
memory_service = MemoryService()
