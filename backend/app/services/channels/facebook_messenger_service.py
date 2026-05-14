"""
Facebook Messenger Service — talks to the isolated fb-channel-worker (GPL v3) over HTTP.
Mirrors the structure of zalo_bot_service.py but never imports fbchat_muqit itself,
keeping the OmniRAG backend free of GPL v3 entanglement.
"""
from __future__ import annotations

import asyncio
import logging
import re
import time
import unicodedata
from typing import Any, Optional

import httpx
from sqlalchemy import select

from app.core.config import settings
from app.db.mongodb import get_mongodb
from app.db.session import SessionLocal
from app.models.bot import Bot as BotModel
from app.services.openrouter_rag_service import get_openrouter_rag_service

_PARTICIPANTS_CACHE_TTL = 120  # seconds (2 min)
_HISTORY_LIMIT = 10           # last N conversation docs to load from MongoDB
_CONV_HISTORY_INJECT = 20     # how many entries to inject into LLM (10 exchanges)

logger = logging.getLogger(__name__)

# Keywords that hint the user wants live/web information
_WEB_SEARCH_RE = re.compile(
    r"\b(thời tiết|tin tức|giá (cổ phiếu|bitcoin|vàng|đô|usd|btc|vnd)|"
    r"mới nhất|hiện tại|hôm nay|ngày hôm nay|bây giờ|"
    r"web search|search web|tìm trên mạng|tra google|"
    r"tỉ giá|tỷ giá|chứng khoán|lãi suất)\b",
    re.IGNORECASE,
)
_LEAVE_GROUP_COMMAND_RE = re.compile(
    r"^((out|leave|roi|thoat|cut)(\s+khoi)?|ra khoi)\s+(nhom|group)"
    r"(\s+(di|nhe|nha|please|giup\s+(tao|t|minh)|ho\s+(tao|t|minh)|dum\s+(tao|t|minh)))*[.!?]*$",
    re.IGNORECASE,
)
_LEAVE_GROUP_PREFIX_RE = re.compile(
    r"^(may|m|ban|bot|mi|cau|ong|ba|anh|chi|em|no|nay|ey|e|hey|ê)\s+",
    re.IGNORECASE,
)


class FacebookMessengerService:
    """Backend-side facade over the fb-channel-worker REST API."""

    def __init__(self) -> None:
        self.rag_service = get_openrouter_rag_service()
        # {bot_id:thread_id → (ctx_dict, expires_at)}
        self._participants_cache: dict[str, tuple[dict, float]] = {}

    # ─── HTTP helpers ──────────────────────────────────────────────────

    @property
    def _base_url(self) -> str:
        return settings.FB_WORKER_URL.rstrip("/")

    @property
    def _auth_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {settings.FB_WORKER_API_TOKEN}"}

    async def _post(self, path: str, json: dict[str, Any], timeout: float = 15.0) -> dict[str, Any]:
        url = f"{self._base_url}{path}"
        last_err: Exception | None = None
        backoff = 0.5
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    r = await client.post(url, json=json, headers=self._auth_headers)
                if r.status_code >= 500:
                    raise RuntimeError(f"worker {r.status_code}: {r.text[:200]}")
                if r.status_code >= 400:
                    raise RuntimeError(f"worker {r.status_code}: {r.text[:200]}")
                return r.json()
            except Exception as e:
                last_err = e
                logger.warning("fb worker POST %s failed (attempt %d): %s", path, attempt + 1, e)
                await asyncio.sleep(backoff)
                backoff *= 2
        raise RuntimeError(f"fb worker POST {path} failed after retries: {last_err}")

    async def _get(self, path: str, timeout: float = 10.0) -> dict[str, Any]:
        url = f"{self._base_url}{path}"
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.get(url, headers=self._auth_headers)
        if r.status_code >= 400:
            raise RuntimeError(f"worker {r.status_code}: {r.text[:200]}")
        return r.json()

    # ─── Connect / Disconnect ──────────────────────────────────────────

    async def connect(
        self,
        bot_id: str,
        cookies_payload: Any,
        reply_policy: str = "mention_only",
        thread_whitelist: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        body = {
            "cookies": cookies_payload,
            "reply_policy": reply_policy,
            "thread_whitelist": thread_whitelist,
        }
        result = await self._post(f"/bots/{bot_id}/load", body, timeout=30.0)
        return result.get("status") or {}

    async def disconnect(self, bot_id: str) -> dict[str, Any]:
        return await self._post(f"/bots/{bot_id}/unload", {})

    async def leave_thread(self, bot_id: str, thread_id: str) -> dict[str, Any]:
        return await self._post(f"/bots/{bot_id}/threads/leave", {"thread_id": thread_id})

    async def get_status(self, bot_id: str) -> dict[str, Any]:
        return await self._get(f"/bots/{bot_id}/status")

    async def send_message(
        self,
        bot_id: str,
        thread_id: str,
        text: str,
        reply_to_id: Optional[str] = None,
        mentions: Optional[list[dict]] = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"thread_id": thread_id, "text": text, "reply_to_id": reply_to_id}
        if mentions:
            body["mentions"] = mentions
        return await self._post(f"/bots/{bot_id}/send", body)

    async def react_to_message(
        self,
        bot_id: str,
        thread_id: str,
        message_id: str,
        emoji: str = "👍",
    ) -> None:
        """Best-effort emoji reaction — never raises so callers can fire-and-forget."""
        try:
            await self._post(
                f"/bots/{bot_id}/react",
                {"message_id": message_id, "thread_id": thread_id, "emoji": emoji},
                timeout=8.0,
            )
        except Exception as e:
            logger.debug("fb_react_failed bot=%s msg=%s: %s", bot_id, message_id, e)

    async def get_thread_participants(self, bot_id: str, thread_id: str) -> list[dict]:
        ctx = await self.get_thread_context(bot_id, thread_id)
        return ctx.get("participants", [])

    async def get_thread_context(
        self,
        bot_id: str,
        thread_id: str,
        message_limit: int = 30,
    ) -> dict[str, Any]:
        """Full thread context (metadata + members + recent messages) with 2-min cache."""
        cache_key = f"{bot_id}:{thread_id}"
        cached = self._participants_cache.get(cache_key)
        if cached and time.time() < cached[1]:
            return cached[0]
        data = await self._get(
            f"/bots/{bot_id}/threads/{thread_id}/context?message_limit={message_limit}",
            timeout=30.0,
        )
        ctx: dict[str, Any] = {
            "group_name": data.get("group_name", ""),
            "description": data.get("description", ""),
            "participants": data.get("participants") or [],
            "recent_messages": data.get("recent_messages") or [],
        }
        self._participants_cache[cache_key] = (ctx, time.time() + _PARTICIPANTS_CACHE_TTL)
        return ctx

    # ─── Image description via OpenRouter vision ───────────────────────

    @staticmethod
    async def _describe_images(image_urls: list[str]) -> str:
        """
        Call OpenRouter vision (gpt-4o-mini) to describe one or more images.
        Returns a single description string, or "" on failure.
        """
        if not image_urls or not settings.OPENROUTER_API_KEY:
            return ""
        try:
            content: list[dict] = [{"type": "text", "text": "Mô tả chi tiết nội dung của hình ảnh này bằng tiếng Việt (ngắn gọn 1-3 câu):"}]
            for url in image_urls[:3]:  # cap at 3 images
                content.append({"type": "image_url", "image_url": {"url": url}})

            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "openai/gpt-4o-mini",
                        "messages": [{"role": "user", "content": content}],
                        "max_tokens": 200,
                        "temperature": 0.3,
                    },
                )
            if resp.status_code == 200:
                result = resp.json()
                desc = result["choices"][0]["message"]["content"]
                return desc.strip()
        except Exception as e:
            logger.warning("fb_image_describe_failed: %s", e)
        return ""

    # ─── Web search via DuckDuckGo ─────────────────────────────────────

    @staticmethod
    async def _web_search(query: str, max_results: int = 3) -> str:
        """
        Run a DuckDuckGo text search and return a formatted context block.
        Returns "" if duckduckgo-search is not installed or search fails.
        """
        try:
            from duckduckgo_search import DDGS

            def _search():
                with DDGS() as ddgs:
                    return list(ddgs.text(query, max_results=max_results))

            results = await asyncio.to_thread(_search)
            if not results:
                return ""
            lines = ["[KẾT QUẢ TÌM KIẾM WEB]"]
            for i, r in enumerate(results, 1):
                title = r.get("title", "")
                body = r.get("body", "")
                href = r.get("href", "")
                lines.append(f"{i}. {title}: {body} ({href})")
            return "\n".join(lines)
        except ImportError:
            logger.debug("duckduckgo-search not installed — web search disabled")
            return ""
        except Exception as e:
            logger.warning("fb_web_search_failed query=%r err=%s", query[:60], e)
            return ""

    # ─── Image URL extraction from serialized message ──────────────────

    @staticmethod
    def _extract_image_urls(data: dict[str, Any]) -> list[str]:
        """Extract usable image URLs from a serialized FB message payload."""
        urls: list[str] = []

        def add_url(value: Any) -> None:
            if isinstance(value, str) and value.startswith("http") and value not in urls:
                urls.append(value)

        normalized_attachments = data.get("normalized_attachments")
        if isinstance(normalized_attachments, list):
            for att in normalized_attachments:
                if not isinstance(att, dict):
                    continue
                att_type = str(att.get("type") or "").lower()
                mime_type = str(att.get("mime_type") or "").lower()
                if att_type in {"image", "gif"} or mime_type.startswith("image/"):
                    add_url(att.get("url") or att.get("preview_url"))
            return urls

        attachments = data.get("attachments") or []

        def walk(value: Any) -> None:
            if isinstance(value, dict):
                for key in (
                    "url",
                    "uri",
                    "src",
                    "preview_url",
                    "thumbnail_url",
                    "large_preview_url",
                    "animated_image_url",
                    "image_url",
                ):
                    add_url(value.get(key))
                for nested in value.values():
                    walk(nested)
            elif isinstance(value, list):
                for item in value:
                    walk(item)

        for att in attachments:
            if not isinstance(att, dict):
                continue
            # Try best-quality image first: large_preview > thumbnail > preview
            for key in ("large_preview", "thumbnail", "preview"):
                img = att.get(key)
                if isinstance(img, dict):
                    url = img.get("url") or img.get("uri") or ""
                    if url and url.startswith("http"):
                        urls.append(url)
                        break
            walk(att)
        return urls

    # ─── Session history ───────────────────────────────────────────────

    @staticmethod
    async def _load_session_history(session_id: str, bot_id: str, limit: int = _HISTORY_LIMIT) -> list[dict]:
        """Load the N most recent conversation turns from MongoDB for the given FB thread session."""
        try:
            mongo_db = await get_mongodb()
            docs = await mongo_db.conversations.find(
                {"session_id": session_id, "bot_id": bot_id},
                {"user_message": 1, "response": 1, "_id": 0},
            ).sort("timestamp", -1).limit(limit).to_list(length=limit)
            docs = list(reversed(docs))  # restore chronological order for the LLM

            history: list[dict] = []
            for doc in docs:
                if doc.get("user_message"):
                    history.append({"role": "user", "content": doc["user_message"]})
                if doc.get("response"):
                    history.append({"role": "assistant", "content": doc["response"]})
            return history
        except Exception:
            logger.warning("fb_load_history_failed session=%s", session_id)
            return []

    # ─── Text helpers ──────────────────────────────────────────────────

    @staticmethod
    def _strip_bot_mention(text: str, bot_name: str | None) -> str:
        if not bot_name:
            return text
        stripped = text.strip()
        prefix = f"@{bot_name.strip()}"
        if stripped.lower().startswith(prefix.lower()):
            return stripped[len(prefix):].lstrip(" \t,;:.")
        return stripped

    @staticmethod
    def _is_leave_group_command(text: str) -> bool:
        normalized = unicodedata.normalize("NFD", text.strip().lower())
        normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
        normalized = normalized.replace("đ", "d")
        normalized = re.sub(r"\s+", " ", normalized)
        normalized = _LEAVE_GROUP_PREFIX_RE.sub("", normalized)
        normalized = re.sub(r"^(hay|lam on|please)\s+", "", normalized)
        return bool(_LEAVE_GROUP_COMMAND_RE.match(normalized))

    @staticmethod
    def _build_mentions(text: str, participants: list[dict]) -> list[dict]:
        """Scan text for @Name patterns matching group participants.
        Returns [{user_id, offset, length}] sorted by offset."""
        if not participants or not text:
            return []
        sorted_p = sorted(participants, key=lambda p: len(p.get("name", "")), reverse=True)
        found: list[dict] = []
        consumed: set[int] = set()
        for p in sorted_p:
            name = (p.get("name") or "").strip()
            if not name:
                continue
            start = 0
            while True:
                idx = text.find(name, start)
                if idx == -1:
                    break
                if idx > 0 and text[idx - 1] == "@":
                    positions = set(range(idx, idx + len(name)))
                    if not positions & consumed:
                        found.append({"user_id": p["user_id"], "offset": idx, "length": len(name)})
                        consumed |= positions
                start = idx + 1
        return sorted(found, key=lambda m: m["offset"])

    # ─── Inbound handler (called from /inbound endpoint) ───────────────

    async def handle_inbound(self, bot_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        """
        Process an inbound Messenger event from the worker.
        Expected payload: {"kind": "message", "bot_id": "...", "data": {<Message dict>}}
        """
        data = payload.get("data", {}) or {}
        raw_text = (data.get("text") or "").strip()
        thread_id = data.get("thread_id")
        sender_id = str(data.get("sender_id") or "")
        sender_name = str(data.get("sender_name") or "")
        reply_to_id = data.get("id")
        thread_type = str(data.get("thread_type") or "")
        is_group = (
            "GROUP" in thread_type.upper()
            or "COMMUNITY" in thread_type.upper()
            or bool(thread_id and sender_id and str(thread_id) != str(sender_id))
        )
        replied_msg = data.get("replied_to_message") or {}
        replied_text = (replied_msg.get("text") or "").strip() if replied_msg else ""
        replied_sender_id = str(replied_msg.get("sender_id") or "") if replied_msg else ""

        # Extract image URLs from attachments (before text check — images alone are valid)
        image_urls = self._extract_image_urls(data)

        if not raw_text and not image_urls:
            logger.info("fb_inbound_skip_empty bot=%s", bot_id)
            return {"status": "ignored", "reason": "no_text_or_thread"}

        if not thread_id:
            return {"status": "ignored", "reason": "no_thread_id"}

        db = SessionLocal()
        try:
            bot = db.execute(
                select(BotModel).where(BotModel.id == bot_id, BotModel.is_active == True)
            ).scalar_one_or_none()
            if not bot:
                logger.warning("fb_inbound_bot_not_found bot=%s", bot_id)
                return {"status": "not_found"}

            fb_config = (bot.config or {}).get("facebook", {})
            if fb_config.get("status") != "connected":
                logger.info("fb_inbound_inactive bot=%s status=%s",
                            bot_id, fb_config.get("status"))
                return {"status": "inactive"}

            # React 👀 immediately to acknowledge receipt (best-effort, non-blocking)
            if reply_to_id:
                asyncio.create_task(
                    self.react_to_message(str(bot.id), thread_id, reply_to_id, "👀")
                )

            text = self._strip_bot_mention(raw_text, fb_config.get("display_name"))
            if not text and not image_urls:
                logger.info("fb_inbound_skip_only_mention bot=%s", bot_id)
                return {"status": "ignored", "reason": "only_mention"}

            if self._is_leave_group_command(text):
                if not is_group:
                    await self.send_message(
                        bot_id=str(bot.id),
                        thread_id=thread_id,
                        text="Lệnh này chỉ dùng trong group.",
                        reply_to_id=reply_to_id,
                    )
                    return {"status": "ignored", "reason": "leave_command_not_group"}

                logger.info(
                    "fb_leave_group_command bot=%s thread=%s sender=%s",
                    bot_id, thread_id, sender_id,
                )
                try:
                    await self.send_message(
                        bot_id=str(bot.id),
                        thread_id=thread_id,
                        text="Ok, mình rời nhóm đây.",
                        reply_to_id=reply_to_id,
                    )
                    await self.leave_thread(str(bot.id), thread_id)
                    return {"status": "left_group"}
                except Exception:
                    logger.exception("fb_leave_group_failed bot=%s thread=%s", bot_id, thread_id)
                    try:
                        await self.send_message(
                            bot_id=str(bot.id),
                            thread_id=thread_id,
                            text="Mình chưa rời nhóm được. Có thể Facebook không cho tài khoản này tự remove qua API.",
                            reply_to_id=reply_to_id,
                        )
                    except Exception:
                        logger.exception("fb_leave_group_error_reply_failed bot=%s thread=%s", bot_id, thread_id)
                    return {"status": "leave_failed"}

            # For group threads, fetch full context (members + recent messages + metadata)
            thread_ctx: dict[str, Any] = {}
            participants: list[dict] = []
            if is_group and thread_id:
                try:
                    thread_ctx = await self.get_thread_context(str(bot.id), thread_id)
                    participants = thread_ctx.get("participants") or []
                except Exception:
                    logger.warning("fb_inbound_context_failed bot=%s thread=%s", bot_id, thread_id)

            # Prepend quoted message so LLM knows what's being replied to
            if replied_text:
                replied_sender_name = next(
                    (p["name"] for p in participants if p["user_id"] == replied_sender_id),
                    replied_sender_id or "someone",
                )
                text = f'[Đang rep tin nhắn của {replied_sender_name}: "{replied_text}"]\n{text}'

            # Describe images via OpenRouter vision (if any)
            if image_urls:
                img_desc = await self._describe_images(image_urls)
                if img_desc:
                    img_prefix = f"[Người dùng gửi hình ảnh. Mô tả: {img_desc}]"
                    text = f"{img_prefix}\n{text}".strip() if text else img_prefix

            # Web search if query has real-time-data keywords
            web_ctx = ""
            if text and _WEB_SEARCH_RE.search(text):
                web_ctx = await self._web_search(text)

            # If there's web context, prepend it to the query
            effective_query = text
            if web_ctx:
                effective_query = f"{web_ctx}\n\n[Câu hỏi người dùng]: {text}"

            session_id = f"fb_{thread_id}"
            conversation_history = await self._load_session_history(session_id, str(bot.id))

            try:
                logger.info(
                    "fb_inbound_processing bot=%s thread=%s is_group=%s history=%d "
                    "has_images=%d has_web=%s raw=%r cleaned=%r",
                    bot_id, thread_id, is_group, len(conversation_history),
                    len(image_urls), bool(web_ctx), raw_text[:60], text[:60],
                )
                result = await self.rag_service.chat(
                    bot_id=str(bot.id),
                    query=effective_query,
                    conversation_history=conversation_history or None,
                    bot_config={
                        **(bot.config or {}),
                        "user_id": f"fb_{sender_id}_{thread_id}",
                        "enable_memory": True,
                        "conversation_history_limit": _CONV_HISTORY_INJECT,
                        "group_name": thread_ctx.get("group_name") or None,
                        "group_description": thread_ctx.get("description") or None,
                        "group_participants": participants if participants else None,
                        "group_recent_messages": thread_ctx.get("recent_messages") or None,
                        "sender_name": sender_name or None,
                    },
                    session_id=session_id,
                )
                answer = (result or {}).get("response") or ""
            except Exception as e:
                logger.exception("fb_inbound_rag_failed bot=%s", bot_id)
                answer = f"Xin lỗi, hiện tôi đang gặp lỗi và chưa thể trả lời. ({type(e).__name__})"

            # Build @mention objects from whoever the LLM chose to tag
            mentions: list[dict] = []
            if is_group and answer:
                mentions = self._build_mentions(answer, participants)

            if answer:
                try:
                    await self.send_message(
                        bot_id=str(bot.id),
                        thread_id=thread_id,
                        text=answer,
                        reply_to_id=reply_to_id,
                        mentions=mentions or None,
                    )
                    # React ❤️ after successful reply (best-effort)
                    if reply_to_id:
                        asyncio.create_task(
                            self.react_to_message(str(bot.id), thread_id, reply_to_id, "❤️")
                        )
                except Exception:
                    logger.exception("fb_inbound_send_failed bot=%s thread=%s", bot_id, thread_id)
                    return {"status": "rag_ok_send_failed"}

            return {"status": "ok"}
        finally:
            db.close()


_facebook_messenger_service: FacebookMessengerService | None = None


def get_facebook_messenger_service() -> FacebookMessengerService:
    global _facebook_messenger_service
    if _facebook_messenger_service is None:
        _facebook_messenger_service = FacebookMessengerService()
    return _facebook_messenger_service
