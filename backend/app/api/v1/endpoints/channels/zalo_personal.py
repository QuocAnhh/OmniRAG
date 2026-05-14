"""
Zalo Personal Account Channel — connect/status/disconnect + worker inbound.
"""
import asyncio
import hashlib
import hmac
import json
import logging
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.models.bot import Bot as BotModel
from app.models.user import User
from app.services.channels.zalo_personal_service import get_zalo_personal_service

logger = logging.getLogger(__name__)
router = APIRouter()


class ZaloPersonalConnectStartRequest(BaseModel):
    bot_id: str
    reply_policy: str = Field("mention_only", pattern="^(mention_only|all)$")
    thread_whitelist: Optional[list[str]] = None


def _ensure_enabled() -> None:
    if not settings.ZALO_PERSONAL_ENABLED:
        raise HTTPException(status_code=503, detail="Zalo Personal channel is disabled")
    if not settings.ZALO_PERSONAL_WORKER_API_TOKEN or not settings.ZALO_PERSONAL_INBOUND_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Zalo Personal channel is not configured on the server",
        )


def _verify_inbound_signature(body: bytes, signature_header: str | None) -> bool:
    if not signature_header or not settings.ZALO_PERSONAL_INBOUND_SECRET:
        return False
    expected = hmac.new(
        settings.ZALO_PERSONAL_INBOUND_SECRET.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)


def _parse_bot_uuid(bot_id: str):
    try:
        return UUID(bot_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid bot ID format")


@router.post("/connect/start")
async def start_zalo_personal_login(
    data: ZaloPersonalConnectStartRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Start QR login for a Zalo Personal Account worker session."""
    _ensure_enabled()
    bot_uuid = _parse_bot_uuid(data.bot_id)
    bot = db.execute(
        select(BotModel).where(
            BotModel.id == bot_uuid,
            BotModel.tenant_id == current_user.tenant_id,
        )
    ).scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    service = get_zalo_personal_service()
    try:
        status_data = await service.start_login(
            bot_id=str(bot.id),
            reply_policy=data.reply_policy,
            thread_whitelist=data.thread_whitelist or [],
        )
    except Exception as e:
        logger.error("zalo_personal_start_failed bot=%s err=%s", bot.id, e, exc_info=True)
        raise HTTPException(status_code=400, detail=f"Connect failed: {e}")

    config = dict(bot.config or {})
    config["zalo_personal"] = {
        **service.config_from_status(status_data, config.get("zalo_personal")),
        "reply_policy": data.reply_policy,
        "thread_whitelist": data.thread_whitelist or [],
        "connected_at": config.get("zalo_personal", {}).get("connected_at"),
        "login_started_at": datetime.utcnow().isoformat(),
    }
    bot.config = config
    flag_modified(bot, "config")
    db.commit()

    return {"status": status_data.get("status"), "worker": status_data}


@router.get("/login-status/{bot_id}")
async def zalo_personal_login_status(
    bot_id: str,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Poll QR login status and persist public metadata when connected."""
    _ensure_enabled()
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"

    bot_uuid = _parse_bot_uuid(bot_id)
    bot = db.execute(
        select(BotModel).where(BotModel.id == bot_uuid, BotModel.tenant_id == current_user.tenant_id)
    ).scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    try:
        status_data = await get_zalo_personal_service().login_status(str(bot.id))
    except Exception as e:
        logger.warning("zalo_personal_login_status_failed bot=%s err=%s", bot.id, e)
        raise HTTPException(status_code=502, detail=f"Worker status failed: {e}")

    config = dict(bot.config or {})
    config["zalo_personal"] = get_zalo_personal_service().config_from_status(
        status_data,
        config.get("zalo_personal"),
    )
    bot.config = config
    flag_modified(bot, "config")
    db.commit()

    return {"connected": status_data.get("status") == "connected", "worker": status_data}


@router.get("/status/{bot_id}")
async def zalo_personal_status(
    bot_id: str,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return saved config plus live worker status for a Zalo Personal session."""
    _ensure_enabled()
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"

    bot_uuid = _parse_bot_uuid(bot_id)
    bot = db.execute(
        select(BotModel).where(BotModel.id == bot_uuid, BotModel.tenant_id == current_user.tenant_id)
    ).scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    zp_config = (bot.config or {}).get("zalo_personal") or {}
    worker_status: dict[str, Any] | None = None
    try:
        worker_status = await get_zalo_personal_service().status(str(bot.id))
    except Exception as e:
        logger.warning("zalo_personal_status_worker_unreachable bot=%s err=%s", bot.id, e)

    return {
        "connected": (worker_status or {}).get("status") == "connected" or zp_config.get("status") == "connected",
        "config": zp_config or None,
        "worker": worker_status,
    }


@router.post("/disconnect/{bot_id}")
async def disconnect_zalo_personal(
    bot_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Disconnect and remove the worker-side saved session."""
    _ensure_enabled()
    bot_uuid = _parse_bot_uuid(bot_id)
    bot = db.execute(
        select(BotModel).where(BotModel.id == bot_uuid, BotModel.tenant_id == current_user.tenant_id)
    ).scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    try:
        await get_zalo_personal_service().disconnect(str(bot.id))
    except Exception as e:
        logger.warning("zalo_personal_worker_unload_failed bot=%s err=%s (clearing config anyway)", bot.id, e)

    config = dict(bot.config or {})
    config.pop("zalo_personal", None)
    bot.config = config
    flag_modified(bot, "config")
    db.commit()

    return {"status": "disconnected"}


@router.post("/inbound/{bot_id}")
async def zalo_personal_inbound(bot_id: str, request: Request):
    """Worker-to-backend inbound route, protected by HMAC over raw body."""
    _ensure_enabled()
    raw = await request.body()
    signature = request.headers.get("x-zalo-personal-signature")
    if not _verify_inbound_signature(raw, signature):
        logger.warning("zalo_personal_bad_signature bot=%s", bot_id)
        raise HTTPException(status_code=403, detail="invalid signature")

    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="invalid json body")

    service = get_zalo_personal_service()
    asyncio.create_task(service.handle_inbound(bot_id, payload))
    return {"status": "received"}
