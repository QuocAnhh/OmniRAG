"""
Facebook Messenger Channel — connect / disconnect / status / inbound webhook.
Worker (fb-channel-worker, GPL v3) pushes events here over HMAC-signed HTTP.
"""
import asyncio
import hashlib
import hmac
import json
import logging
import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.models.bot import Bot as BotModel
from app.models.channel_account import ChannelAccount
from app.models.user import User
from app.services.channels.facebook_messenger_service import (
    get_facebook_messenger_service,
)

logger = logging.getLogger(__name__)
router = APIRouter()


CRITICAL_COOKIE_NAMES = {"c_user", "xs", "fr", "datr", "sb"}


# ─── Request models ────────────────────────────────────────────────────

class FacebookConnectRequest(BaseModel):
    bot_id: str
    cookies: Any = Field(..., description="Cookies payload — flat list OR Cookie-Editor dict {url, cookies:[...]}")
    thread_whitelist: Optional[list[str]] = None


# ─── Helpers ───────────────────────────────────────────────────────────

def _normalize_cookies(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, dict) and "cookies" in payload:
        cookies = payload["cookies"]
    else:
        cookies = payload
    if not isinstance(cookies, list) or not cookies:
        raise HTTPException(status_code=400, detail="cookies payload must be a non-empty list")
    return cookies


def _validate_cookies(cookies: list[dict[str, Any]]) -> None:
    names = {c.get("name") or c.get("key") for c in cookies if isinstance(c, dict)}
    missing = CRITICAL_COOKIE_NAMES - names
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"missing critical cookies: {sorted(missing)} (need all of {sorted(CRITICAL_COOKIE_NAMES)})",
        )


def _verify_inbound_signature(body: bytes, signature_header: str | None) -> bool:
    if not signature_header or not settings.FB_INBOUND_SECRET:
        return False
    expected = hmac.new(
        settings.FB_INBOUND_SECRET.encode("utf-8"), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)


# ─── Multi-account ──────────────────────────────────────────────────────

@router.get("/bots/{bot_id}/accounts")
async def list_fb_accounts(
    bot_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List Facebook Messenger accounts for a bot."""
    bot = db.execute(
        select(BotModel).where(
            BotModel.id == bot_id, BotModel.tenant_id == current_user.tenant_id
        )
    ).scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    service = get_facebook_messenger_service()
    return await service.list_accounts(bot_id)


# ─── Inbound webhook (public, HMAC-protected, called by worker) ────────

@router.post("/inbound/{bot_id}")
async def fb_inbound(bot_id: str, request: Request):
    raw = await request.body()
    sig = request.headers.get("x-fb-worker-signature")
    if not _verify_inbound_signature(raw, sig):
        logger.warning("fb_inbound_bad_signature bot=%s", bot_id)
        raise HTTPException(status_code=403, detail="invalid signature")

    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="invalid json body")

    service = get_facebook_messenger_service()
    # Run in background so the worker's HTTP call returns quickly (matches Zalo Bot pattern).
    asyncio.create_task(service.handle_inbound(bot_id, payload))
    return {"status": "received"}


# ─── Connect (authenticated) ───────────────────────────────────────────

@router.post("/connect")
async def fb_connect(
    data: FacebookConnectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cookies = _normalize_cookies(data.cookies)
    _validate_cookies(cookies)

    bot = db.execute(
        select(BotModel).where(
            BotModel.id == data.bot_id, BotModel.tenant_id == current_user.tenant_id
        )
    ).scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    if not settings.FB_WORKER_API_TOKEN or not settings.FB_INBOUND_SECRET:
        raise HTTPException(
            status_code=500,
            detail="Facebook channel not configured on the server (FB_WORKER_API_TOKEN / FB_INBOUND_SECRET)",
        )

    service = get_facebook_messenger_service()
    try:
        status_data = await service.connect(
            bot_id=str(bot.id),
            cookies_payload=cookies,
            reply_policy="mention_only",
            thread_whitelist=data.thread_whitelist,
        )
    except Exception as e:
        logger.error("fb_connect_failed bot=%s err=%s", bot.id, e, exc_info=True)
        raise HTTPException(status_code=400, detail=f"Connect failed: {e}")

    config = dict(bot.config or {})
    config["facebook"] = {
        "uid": status_data.get("uid"),
        "display_name": status_data.get("name"),
        "thread_whitelist": data.thread_whitelist,
        "reply_policy": "mention_only",
        "status": "connected",
        "connected_at": datetime.utcnow().isoformat(),
        "last_event_at": None,
    }
    bot.config = config
    flag_modified(bot, "config")

    # Also save to channel_accounts table for multi-account support
    existing = db.execute(
        select(ChannelAccount).where(
            ChannelAccount.bot_id == bot.id,
            ChannelAccount.channel_type == "facebook_messenger",
            ChannelAccount.channel_uid == status_data.get("uid"),
        )
    ).scalar_one_or_none()
    if existing:
        existing.status = "connected"
        existing.display_name = status_data.get("name")
        existing.connected_at = datetime.utcnow()
        existing.is_active = True
        existing.last_error = None
    else:
        db.add(ChannelAccount(
            id=uuid.uuid4(),
            bot_id=bot.id,
            tenant_id=bot.tenant_id,
            channel_type="facebook_messenger",
            display_name=status_data.get("name"),
            channel_uid=status_data.get("uid"),
            status="connected",
            reply_policy="mention_only",
            thread_whitelist=data.thread_whitelist or [],
            connected_at=datetime.utcnow(),
        ))
    db.commit()

    logger.info("fb_connect_ok bot=%s uid=%s", bot.id, status_data.get("uid"))
    return {"status": "connected", "uid": status_data.get("uid"), "display_name": status_data.get("name")}


# ─── Disconnect (authenticated) ────────────────────────────────────────

@router.post("/disconnect/{bot_id}")
async def fb_disconnect(
    bot_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    bot = db.execute(
        select(BotModel).where(
            BotModel.id == bot_id, BotModel.tenant_id == current_user.tenant_id
        )
    ).scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    service = get_facebook_messenger_service()
    try:
        await service.disconnect(str(bot.id))
    except Exception as e:
        logger.warning("fb_worker_unload_failed bot=%s err=%s (clearing config anyway)", bot.id, e)

    config = dict(bot.config or {})
    config.pop("facebook", None)
    bot.config = config
    flag_modified(bot, "config")
    db.commit()

    logger.info("fb_disconnect_ok bot=%s", bot.id)
    return {"status": "disconnected"}


# ─── Status (authenticated) ────────────────────────────────────────────

@router.get("/status/{bot_id}")
async def fb_status(
    bot_id: str,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # The gateway caches GET responses; mark this endpoint uncacheable so
    # status changes (connect/disconnect/expire) are visible immediately.
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"

    bot = db.execute(
        select(BotModel).where(
            BotModel.id == bot_id, BotModel.tenant_id == current_user.tenant_id
        )
    ).scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    fb_config = (bot.config or {}).get("facebook") or {}
    if not fb_config:
        return {"connected": False, "config": None, "worker": None}

    worker_status: dict[str, Any] | None = None
    try:
        worker_status = await get_facebook_messenger_service().get_status(str(bot.id))
    except Exception as e:
        logger.warning("fb_status_worker_unreachable bot=%s err=%s", bot.id, e)

    return {"connected": True, "config": fb_config, "worker": worker_status}
