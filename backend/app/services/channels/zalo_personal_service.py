"""
Zalo Personal Account Service — backend facade over the isolated zca-js worker.

Supports both legacy single-account (bot.config.zalo_personal) and new
multi-account (channel_accounts table) modes.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Any, Optional
from uuid import UUID, uuid4

import httpx
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.bot import Bot as BotModel
from app.models.channel_account import ChannelAccount, ChannelAccountAccess
from app.services.openrouter_rag_service import get_openrouter_rag_service

logger = logging.getLogger(__name__)

CHANNEL_TYPE = "zalo_personal"


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

    # ── NEW: Account-based operations (multi-account) ──────────────────────

    async def create_and_start_login(
        self,
        bot_id: str,
        tenant_id: UUID,
        reply_policy: str = "mention_only",
        thread_whitelist: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        db = SessionLocal()
        try:
            account_id = uuid4()
            account = ChannelAccount(
                id=account_id,
                bot_id=UUID(bot_id),
                tenant_id=tenant_id,
                channel_type=CHANNEL_TYPE,
                status="connecting",
                reply_policy=reply_policy,
                thread_whitelist=thread_whitelist or [],
            )
            db.add(account)
            db.commit()
            db.refresh(account)
        finally:
            db.close()

        result = await self._post(
            f"/accounts/{account_id}/login/start",
            {
                "bot_id": bot_id,
                "reply_policy": reply_policy,
                "thread_whitelist": thread_whitelist or [],
            },
            timeout=30.0,
        )
        return self._account_from_worker_status(str(account_id), result.get("status") or {})

    async def account_login_status(self, account_id: str) -> dict[str, Any]:
        result = await self._get(f"/accounts/{account_id}/login/status")
        worker_status = result.get("status") or {}

        db = SessionLocal()
        try:
            account = db.execute(
                select(ChannelAccount).where(ChannelAccount.id == UUID(account_id))
            ).scalar_one_or_none()
            if account and worker_status:
                self._sync_account_from_worker(account, worker_status)
                db.commit()
        finally:
            db.close()

        return worker_status

    async def account_status(self, account_id: str) -> dict[str, Any]:
        result = await self._get(f"/accounts/{account_id}/status")
        return result.get("status") or {}

    async def account_send_message(
        self, account_id: str, thread_id: str, text: str, thread_type: str = "user"
    ) -> dict[str, Any]:
        last_exception = None
        for attempt in range(2):
            try:
                return await self._post(
                    f"/accounts/{account_id}/send",
                    {"thread_id": thread_id, "text": text, "thread_type": thread_type},
                )
            except Exception as e:
                last_exception = e
                if attempt == 0:
                    logger.warning("zalo_personal_send_retry account=%s attempt=%d", account_id, attempt)
                    await asyncio.sleep(1.0)
        raise last_exception

    async def account_disconnect(self, account_id: str) -> dict[str, Any]:
        result = await self._post(f"/accounts/{account_id}/unload", {})
        db = SessionLocal()
        try:
            account = db.execute(
                select(ChannelAccount).where(ChannelAccount.id == UUID(account_id))
            ).scalar_one_or_none()
            if account:
                account.status = "disconnected"
                account.is_active = False
                db.commit()
        finally:
            db.close()
        return result

    async def list_accounts(self, bot_id: str) -> list[dict[str, Any]]:
        db = SessionLocal()
        try:
            accounts = db.execute(
                select(ChannelAccount)
                .where(
                    ChannelAccount.bot_id == UUID(bot_id),
                    ChannelAccount.channel_type == CHANNEL_TYPE,
                )
                .order_by(ChannelAccount.created_at.desc())
            ).scalars().all()
            return [self._account_to_dict(a) for a in accounts]
        finally:
            db.close()

    async def get_account(self, account_id: str) -> Optional[dict[str, Any]]:
        db = SessionLocal()
        try:
            account = db.execute(
                select(ChannelAccount).where(ChannelAccount.id == UUID(account_id))
            ).scalar_one_or_none()
            return self._account_to_dict(account) if account else None
        finally:
            db.close()

    async def update_account(self, account_id: str, reply_policy: Optional[str], thread_whitelist: Optional[list[str]]) -> Optional[dict[str, Any]]:
        db = SessionLocal()
        try:
            account = db.execute(
                select(ChannelAccount).where(ChannelAccount.id == UUID(account_id))
            ).scalar_one_or_none()
            if not account:
                return None
            if reply_policy is not None:
                account.reply_policy = reply_policy
            if thread_whitelist is not None:
                account.thread_whitelist = thread_whitelist
            db.commit()
            db.refresh(account)
            return self._account_to_dict(account)
        finally:
            db.close()

    async def delete_account(self, account_id: str) -> bool:
        try:
            await self._post(f"/accounts/{account_id}/unload", {})
        except Exception:
            logger.warning("zalo_personal_worker_unload_failed account=%s", account_id)

        db = SessionLocal()
        try:
            account = db.execute(
                select(ChannelAccount).where(ChannelAccount.id == UUID(account_id))
            ).scalar_one_or_none()
            if not account:
                return False
            db.delete(account)
            db.commit()
            return True
        finally:
            db.close()

    # ── ACL ────────────────────────────────────────────────────────────────

    async def grant_access(self, account_id: str, user_id: UUID, permission: str) -> dict[str, Any]:
        db = SessionLocal()
        try:
            access = ChannelAccountAccess(
                account_id=UUID(account_id),
                user_id=user_id,
                permission=permission,
            )
            db.add(access)
            db.commit()
            db.refresh(access)
            return {
                "id": str(access.id),
                "account_id": str(access.account_id),
                "user_id": str(access.user_id),
                "permission": access.permission,
            }
        finally:
            db.close()

    async def revoke_access(self, access_id: str) -> bool:
        db = SessionLocal()
        try:
            access = db.execute(
                select(ChannelAccountAccess).where(ChannelAccountAccess.id == UUID(access_id))
            ).scalar_one_or_none()
            if not access:
                return False
            db.delete(access)
            db.commit()
            return True
        finally:
            db.close()

    async def list_access(self, account_id: str) -> list[dict[str, Any]]:
        db = SessionLocal()
        try:
            entries = db.execute(
                select(ChannelAccountAccess).where(
                    ChannelAccountAccess.account_id == UUID(account_id)
                )
            ).scalars().all()
            return [
                {
                    "id": str(e.id),
                    "account_id": str(e.account_id),
                    "user_id": str(e.user_id),
                    "permission": e.permission,
                }
                for e in entries
            ]
        finally:
            db.close()

    # ── Helpers ────────────────────────────────────────────────────────────

    @staticmethod
    def _sync_account_from_worker(account: ChannelAccount, status_data: dict[str, Any]) -> None:
        account.status = status_data.get("status") or account.status
        if status_data.get("uid"):
            account.channel_uid = str(status_data["uid"])
        if status_data.get("name"):
            account.display_name = str(status_data["name"])
        if status_data.get("status") == "connected":
            account.connected_at = datetime.utcnow()
        account.last_event_at = datetime.utcnow() if status_data.get("last_event_at") else account.last_event_at
        account.last_error = status_data.get("last_error")

    @staticmethod
    def _account_from_worker_status(account_id: str, status_data: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": account_id,
            "status": status_data.get("status", "disconnected"),
            "channel_uid": status_data.get("uid", ""),
            "display_name": status_data.get("name", ""),
            "reply_policy": status_data.get("reply_policy", "mention_only"),
            "thread_whitelist": status_data.get("thread_whitelist", []),
            "connected_at": status_data.get("connected_at"),
            "last_event_at": status_data.get("last_event_at"),
            "last_error": status_data.get("last_error"),
            "rate_limit": status_data.get("rate_limit"),
            "circuit_breaker": status_data.get("circuit_breaker"),
        }

    @staticmethod
    def _account_to_dict(account: ChannelAccount) -> dict[str, Any]:
        return {
            "id": str(account.id),
            "bot_id": str(account.bot_id),
            "tenant_id": str(account.tenant_id),
            "channel_type": account.channel_type,
            "display_name": account.display_name,
            "channel_uid": account.channel_uid,
            "avatar_url": account.avatar_url,
            "status": account.status,
            "reply_policy": account.reply_policy,
            "thread_whitelist": account.thread_whitelist,
            "connected_at": account.connected_at.isoformat() if account.connected_at else None,
            "last_event_at": account.last_event_at.isoformat() if account.last_event_at else None,
            "last_error": account.last_error,
            "error_count": account.error_count,
            "is_active": account.is_active,
            "created_at": account.created_at.isoformat() if account.created_at else None,
            "updated_at": account.updated_at.isoformat() if account.updated_at else None,
        }

    # ── LEGACY: backward-compatible single-account operations ──────────────

    async def start_login(
        self,
        bot_id: str,
        reply_policy: str = "mention_only",
        thread_whitelist: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        # Map to legacy worker route
        result = await self._post(
            f"/bots/{bot_id}/login/start",
            {"reply_policy": reply_policy, "thread_whitelist": thread_whitelist or []},
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
        last_exception = None
        for attempt in range(2):
            try:
                return await self._post(
                    f"/bots/{bot_id}/send",
                    {"thread_id": thread_id, "text": text, "thread_type": thread_type},
                )
            except Exception as e:
                last_exception = e
                if attempt == 0:
                    logger.warning("zalo_personal_send_retry bot=%s attempt=%d", bot_id, attempt)
                    await asyncio.sleep(1.0)
        raise last_exception

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

    # ── Inbound handler ───────────────────────────────────────────────────

    async def handle_inbound(self, bot_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        data = payload.get("data") or {}
        text = (data.get("text") or "").strip()
        thread_id = str(data.get("thread_id") or "")
        thread_type = str(data.get("thread_type") or "user")
        sender_id = str(data.get("sender_id") or "")
        account_id = payload.get("account_id") or None

        kind = payload.get("kind")
        if kind == "status_change":
            return await self._handle_status_change(bot_id, payload, account_id)
        if kind != "message":
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

            # Resolve account: prefer account_id from payload, fall back to legacy config
            if account_id:
                account = db.execute(
                    select(ChannelAccount).where(ChannelAccount.id == UUID(account_id))
                ).scalar_one_or_none()
                if not account:
                    return {"status": "account_not_found"}
                if account.status not in {"connected", "connecting"}:
                    return {"status": "inactive"}
                account.last_event_at = datetime.utcnow()
                session_id = f"zalo_personal_{account_id}_{thread_id}"
                user_id = f"zalo_personal_{account_id}_{sender_id}_{thread_id}"
                send_id = str(account.id)
            else:
                # Legacy: use bot.config.zalo_personal
                zp_config = (bot.config or {}).get("zalo_personal") or {}
                if zp_config.get("status") not in {"connected", "connecting"} and not zp_config.get("is_active"):
                    return {"status": "inactive"}
                config = dict(bot.config or {})
                channel_config = dict(config.get("zalo_personal") or {})
                channel_config["last_event_at"] = datetime.utcnow().isoformat()
                config["zalo_personal"] = channel_config
                bot.config = config
                flag_modified(bot, "config")
                session_id = f"zalo_personal_{thread_id}"
                user_id = f"zalo_personal_{sender_id}_{thread_id}"
                send_id = bot_id

            db.commit()

            logger.info(
                "zalo_personal_processing bot=%s account=%s thread=%s sender=%s text=%r",
                bot_id, account_id or "legacy", thread_id, sender_id, text[:80],
            )
            result = await self.rag_service.chat(
                bot_id=str(bot.id),
                query=text,
                bot_config={
                    **(bot.config or {}),
                    "user_id": user_id,
                    "enable_memory": True,
                    "sender_name": data.get("sender_name") or None,
                },
                session_id=session_id,
            )
            answer = (result or {}).get("response") or ""
            if not answer:
                return {"status": "no_answer"}

            try:
                if account_id:
                    await self.account_send_message(send_id, thread_id, answer, thread_type)
                else:
                    await self.send_message(send_id, thread_id, answer, thread_type)
            except Exception:
                logger.exception("zalo_personal_send_failed bot=%s thread=%s", bot_id, thread_id)
                return {"status": "rag_ok_send_failed"}

            return {"status": "ok"}
        except Exception as e:
            logger.exception("zalo_personal_inbound_failed bot=%s", bot_id)
            return {"status": "error", "message": str(e)}
        finally:
            db.close()

    async def _handle_status_change(
        self, bot_id: str, payload: dict[str, Any], account_id: Optional[str] = None
    ) -> dict[str, Any]:
        data = payload.get("data") or {}
        new_status = data.get("status")
        reason = data.get("reason", "")
        logger.info(
            "zalo_personal_status_change bot=%s account=%s status=%s reason=%s",
            bot_id, account_id, new_status, reason,
        )

        db = SessionLocal()
        try:
            if account_id:
                account = db.execute(
                    select(ChannelAccount).where(ChannelAccount.id == UUID(account_id))
                ).scalar_one_or_none()
                if not account:
                    return {"status": "not_found"}
                account.status = new_status or account.status
                account.last_error = reason or account.last_error
                if new_status == "relogin_required":
                    account.is_active = False
                if new_status == "backend_down":
                    account.status = "backend_down"
                db.commit()
                return {"status": "updated"}

            # Legacy: update bot.config
            bot_uuid = UUID(bot_id)
            bot = db.execute(
                select(BotModel).where(BotModel.id == bot_uuid, BotModel.is_active == True)
            ).scalar_one_or_none()
            if not bot:
                return {"status": "not_found"}
            config = dict(bot.config or {})
            channel_config = dict(config.get("zalo_personal") or {})
            channel_config["status"] = new_status or channel_config.get("status", "disconnected")
            channel_config["last_error"] = reason or channel_config.get("last_error")
            if new_status == "relogin_required":
                channel_config["is_active"] = False
            config["zalo_personal"] = channel_config
            bot.config = config
            flag_modified(bot, "config")
            db.commit()
            return {"status": "updated"}
        except Exception as e:
            logger.exception("zalo_personal_status_change_failed bot=%s", bot_id)
            return {"status": "error", "message": str(e)}
        finally:
            db.close()


_zalo_personal_service: ZaloPersonalService | None = None


def get_zalo_personal_service() -> ZaloPersonalService:
    global _zalo_personal_service
    if _zalo_personal_service is None:
        _zalo_personal_service = ZaloPersonalService()
    return _zalo_personal_service
