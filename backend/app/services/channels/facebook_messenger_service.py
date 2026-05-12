"""
Facebook Messenger Service — talks to the isolated fb-channel-worker (GPL v3) over HTTP.
Mirrors the structure of zalo_bot_service.py but never imports fbchat_muqit itself,
keeping the OmniRAG backend free of GPL v3 entanglement.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional

import httpx
from sqlalchemy import select

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.bot import Bot as BotModel
from app.services.openrouter_rag_service import get_openrouter_rag_service

logger = logging.getLogger(__name__)


class FacebookMessengerService:
    """Backend-side facade over the fb-channel-worker REST API."""

    def __init__(self) -> None:
        self.rag_service = get_openrouter_rag_service()

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

    async def get_status(self, bot_id: str) -> dict[str, Any]:
        return await self._get(f"/bots/{bot_id}/status")

    async def send_message(
        self,
        bot_id: str,
        thread_id: str,
        text: str,
        reply_to_id: Optional[str] = None,
    ) -> dict[str, Any]:
        return await self._post(
            f"/bots/{bot_id}/send",
            {"thread_id": thread_id, "text": text, "reply_to_id": reply_to_id},
        )

    # ─── Inbound handler (called from /inbound endpoint) ───────────────

    @staticmethod
    def _strip_bot_mention(text: str, bot_name: str | None) -> str:
        """Remove the leading "@<bot_name>" so the LLM doesn't think the bot's own
        name is the addressee. Without this strip the model tends to greet itself
        ("Chào Ang Nguyễn!" when Ang Nguyễn IS the bot)."""
        if not bot_name:
            return text
        stripped = text.strip()
        prefix = f"@{bot_name.strip()}"
        if stripped.lower().startswith(prefix.lower()):
            return stripped[len(prefix):].lstrip(" \t,;:.")
        return stripped

    async def handle_inbound(self, bot_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        """
        Process an inbound Messenger event from the worker.
        Expected payload: {"kind": "message", "bot_id": "...", "data": {<Message dict>}}
        """
        data = payload.get("data", {}) or {}
        raw_text = (data.get("text") or "").strip()
        thread_id = data.get("thread_id")
        sender_id = data.get("sender_id")
        reply_to_id = data.get("id")

        if not raw_text or not thread_id:
            logger.info("fb_inbound_skip_empty bot=%s", bot_id)
            return {"status": "ignored", "reason": "no_text_or_thread"}

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

            # Strip "@<bot_name>" prefix so the LLM doesn't address itself.
            text = self._strip_bot_mention(raw_text, fb_config.get("display_name"))
            if not text:
                logger.info("fb_inbound_skip_only_mention bot=%s", bot_id)
                return {"status": "ignored", "reason": "only_mention"}

            try:
                logger.info("fb_inbound_processing bot=%s thread=%s raw=%r cleaned=%r",
                            bot_id, thread_id, raw_text[:60], text[:60])
                result = await self.rag_service.chat(
                    bot_id=str(bot.id),
                    query=text,
                    bot_config={
                        **(bot.config or {}),
                        "user_id": f"fb_{sender_id}",
                        "enable_memory": True,
                    },
                    session_id=f"fb_{thread_id}",
                )
                answer = (result or {}).get("response") or ""
            except Exception as e:
                logger.exception("fb_inbound_rag_failed bot=%s", bot_id)
                answer = f"Xin lỗi, hiện tôi đang gặp lỗi và chưa thể trả lời. ({type(e).__name__})"

            if answer:
                try:
                    await self.send_message(
                        bot_id=str(bot.id),
                        thread_id=thread_id,
                        text=answer,
                        reply_to_id=reply_to_id,
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
