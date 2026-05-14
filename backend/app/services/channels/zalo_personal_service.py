"""
Zalo Personal Account Service — backend facade over the isolated zca-js worker.

The FastAPI backend does not import zca-js or store Zalo personal-account
cookies. It stores only operational metadata in bot.config.zalo_personal and
talks to the worker over authenticated internal HTTP.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.bot import Bot as BotModel
from app.services.openrouter_rag_service import get_openrouter_rag_service

logger = logging.getLogger(__name__)


class ZaloPersonalService:
    def __init__(self) -> None:
        self.rag_service = get_openrouter_rag_service()

    @property
    def _base_url(self) -> str:
        return settings.ZALO_PERSONAL_WORKER_URL.rstrip("/")

    @property
    def _auth_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {settings.ZALO_PERSONAL_WORKER_API_TOKEN}"}

    def _ensure_configured(self) -> None:
        if not settings.ZALO_PERSONAL_ENABLED:
            raise RuntimeError("Zalo Personal channel is disabled")
        if not settings.ZALO_PERSONAL_WORKER_API_TOKEN or not settings.ZALO_PERSONAL_INBOUND_SECRET:
            raise RuntimeError(
                "Zalo Personal channel is not configured "
                "(ZALO_PERSONAL_WORKER_API_TOKEN / ZALO_PERSONAL_INBOUND_SECRET)"
            )

    async def _post(self, path: str, json: dict[str, Any], timeout: float = 20.0) -> dict[str, Any]:
        self._ensure_configured()
        url = f"{self._base_url}{path}"
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=json, headers=self._auth_headers)
        if response.status_code >= 400:
            raise RuntimeError(f"zalo personal worker {response.status_code}: {response.text[:240]}")
        return response.json()

    async def _get(self, path: str, timeout: float = 10.0) -> dict[str, Any]:
        self._ensure_configured()
        url = f"{self._base_url}{path}"
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(url, headers=self._auth_headers)
        if response.status_code >= 400:
            raise RuntimeError(f"zalo personal worker {response.status_code}: {response.text[:240]}")
        return response.json()

    async def start_login(
        self,
        bot_id: str,
        reply_policy: str = "mention_only",
        thread_whitelist: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        result = await self._post(
            f"/bots/{bot_id}/login/start",
            {
                "reply_policy": reply_policy,
                "thread_whitelist": thread_whitelist or [],
            },
            timeout=30.0,
        )
        return result.get("status") or {}

    async def login_status(self, bot_id: str) -> dict[str, Any]:
        result = await self._get(f"/bots/{bot_id}/login/status")
        return result.get("status") or {}

    async def status(self, bot_id: str) -> dict[str, Any]:
        result = await self._get(f"/bots/{bot_id}/status")
        return result.get("status") or {}

    async def disconnect(self, bot_id: str) -> dict[str, Any]:
        return await self._post(f"/bots/{bot_id}/unload", {})

    async def send_message(self, bot_id: str, thread_id: str, text: str, thread_type: str = "user") -> dict[str, Any]:
        return await self._post(
            f"/bots/{bot_id}/send",
            {
                "thread_id": thread_id,
                "text": text,
                "thread_type": thread_type,
            },
        )

    @staticmethod
    def config_from_status(status_data: dict[str, Any], existing: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        existing = dict(existing or {})
        return {
            **existing,
            "status": status_data.get("status") or existing.get("status") or "disconnected",
            "uid": status_data.get("uid") or existing.get("uid"),
            "display_name": status_data.get("name") or existing.get("display_name"),
            "reply_policy": status_data.get("reply_policy") or existing.get("reply_policy") or "mention_only",
            "thread_whitelist": status_data.get("thread_whitelist") or existing.get("thread_whitelist") or [],
            "connected_at": status_data.get("connected_at") or existing.get("connected_at"),
            "last_event_at": status_data.get("last_event_at") or existing.get("last_event_at"),
            "last_error": status_data.get("last_error"),
            "is_active": status_data.get("status") == "connected",
        }

    async def handle_inbound(self, bot_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        data = payload.get("data") or {}
        text = (data.get("text") or "").strip()
        thread_id = str(data.get("thread_id") or "")
        thread_type = str(data.get("thread_type") or "user")
        sender_id = str(data.get("sender_id") or "")

        if payload.get("kind") != "message":
            return {"status": "ignored", "reason": "unsupported_kind"}
        if not text or not thread_id:
            return {"status": "ignored", "reason": "no_text_or_thread"}

        db = SessionLocal()
        try:
            bot_uuid = UUID(bot_id)
            bot = db.execute(
                select(BotModel).where(BotModel.id == bot_uuid, BotModel.is_active == True)
            ).scalar_one_or_none()
            if not bot:
                logger.warning("zalo_personal_bot_not_found bot=%s", bot_id)
                return {"status": "not_found"}

            zp_config = (bot.config or {}).get("zalo_personal") or {}
            if zp_config.get("status") not in {"connected", "connecting"} and not zp_config.get("is_active"):
                logger.info("zalo_personal_inactive bot=%s status=%s", bot_id, zp_config.get("status"))
                return {"status": "inactive"}

            config = dict(bot.config or {})
            channel_config = dict(config.get("zalo_personal") or {})
            channel_config["last_event_at"] = datetime.utcnow().isoformat()
            config["zalo_personal"] = channel_config
            bot.config = config
            flag_modified(bot, "config")
            db.commit()

            session_id = f"zalo_personal_{thread_id}"
            logger.info(
                "zalo_personal_processing bot=%s thread=%s sender=%s text=%r",
                bot_id,
                thread_id,
                sender_id,
                text[:80],
            )
            result = await self.rag_service.chat(
                bot_id=str(bot.id),
                query=text,
                bot_config={
                    **(bot.config or {}),
                    "user_id": f"zalo_personal_{sender_id}_{thread_id}",
                    "enable_memory": True,
                    "sender_name": data.get("sender_name") or None,
                },
                session_id=session_id,
            )
            answer = (result or {}).get("response") or ""
            if not answer:
                return {"status": "no_answer"}

            try:
                await self.send_message(str(bot.id), thread_id, answer, thread_type)
            except Exception:
                logger.exception("zalo_personal_send_failed bot=%s thread=%s", bot_id, thread_id)
                return {"status": "rag_ok_send_failed"}

            return {"status": "ok"}
        except Exception as e:
            logger.exception("zalo_personal_inbound_failed bot=%s", bot_id)
            return {"status": "error", "message": str(e)}
        finally:
            db.close()


_zalo_personal_service: ZaloPersonalService | None = None


def get_zalo_personal_service() -> ZaloPersonalService:
    global _zalo_personal_service
    if _zalo_personal_service is None:
        _zalo_personal_service = ZaloPersonalService()
    return _zalo_personal_service
