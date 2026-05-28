"""
Zalo Personal Account Channel — connect/status/disconnect + worker inbound.
Supports both legacy single-account (bot.config) and multi-account (channel_accounts table).
"""
import asyncio
import hashlib
import hmac
import json
import logging
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.models.bot import Bot as BotModel
from app.models.channel_account import ChannelAccount
from app.models.user import User
from app.schemas.channel_account import (
    ChannelAccountCreate,
    ChannelAccountUpdate,
    ChannelAccountResponse,
    ChannelAccountAccessCreate,
    ChannelAccountAccessUpdate,
    ChannelAccountAccessResponse,
)
from app.services.channels.zalo_personal_service import get_zalo_personal_service

logger = logging.getLogger(__name__)
router = APIRouter()

CHANNEL_TYPE = "zalo_personal"


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


def _parse_uuid(id_str: str, label: str = "ID") -> UUID:
    try:
        return UUID(id_str)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid {label} format")


# ═══════════════════════════════════════════════════════════════════════════
# NEW: Multi-Account Endpoints
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/bots/{bot_id}/accounts")
async def list_accounts(
    bot_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_enabled()
    bot_uuid = _parse_uuid(bot_id, "bot ID")
    bot = db.execute(
        select(BotModel).where(
            BotModel.id == bot_uuid,
            BotModel.tenant_id == current_user.tenant_id,
        )
    ).scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    return await get_zalo_personal_service().list_accounts(bot_id)


@router.post("/bots/{bot_id}/accounts", status_code=201)
async def create_account(
    bot_id: str,
    data: ChannelAccountCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_enabled()
    bot_uuid = _parse_uuid(bot_id, "bot ID")
    bot = db.execute(
        select(BotModel).where(
            BotModel.id == bot_uuid,
            BotModel.tenant_id == current_user.tenant_id,
        )
    ).scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    if data.channel_type != CHANNEL_TYPE:
        raise HTTPException(status_code=400, detail="channel_type must be zalo_personal")

    try:
        return await get_zalo_personal_service().create_and_start_login(
            bot_id=str(bot.id),
            tenant_id=current_user.tenant_id,
            reply_policy=data.reply_policy,
            thread_whitelist=data.thread_whitelist,
        )
    except Exception as e:
        logger.error("zalo_personal_create_account_failed bot=%s err=%s", bot.id, e, exc_info=True)
        raise HTTPException(status_code=400, detail=f"Create account failed: {e}")


@router.get("/accounts/{account_id}")
async def get_account(
    account_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_enabled()
    account_uuid = _parse_uuid(account_id, "account ID")
    account = db.execute(
        select(ChannelAccount).where(ChannelAccount.id == account_uuid)
    ).scalar_one_or_none()
    if not account or account.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Account not found")

    result = await get_zalo_personal_service().get_account(account_id)
    if not result:
        raise HTTPException(status_code=404, detail="Account not found")
    return result


@router.delete("/accounts/{account_id}")
async def delete_account(
    account_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_enabled()
    account_uuid = _parse_uuid(account_id, "account ID")
    account = db.execute(
        select(ChannelAccount).where(ChannelAccount.id == account_uuid)
    ).scalar_one_or_none()
    if not account or account.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Account not found")

    deleted = await get_zalo_personal_service().delete_account(account_id)
    if not deleted:
        raise HTTPException(status_code=500, detail="Failed to delete account")
    return {"status": "deleted"}


@router.put("/accounts/{account_id}")
async def update_account(
    account_id: str,
    data: ChannelAccountUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_enabled()
    account_uuid = _parse_uuid(account_id, "account ID")
    account = db.execute(
        select(ChannelAccount).where(ChannelAccount.id == account_uuid)
    ).scalar_one_or_none()
    if not account or account.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Account not found")

    result = await get_zalo_personal_service().update_account(
        account_id,
        reply_policy=data.reply_policy,
        thread_whitelist=data.thread_whitelist,
    )
    if not result:
        raise HTTPException(status_code=500, detail="Failed to update account")
    return result


@router.get("/accounts/{account_id}/login-status")
async def account_login_status(
    account_id: str,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_enabled()
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    account_uuid = _parse_uuid(account_id, "account ID")
    account = db.execute(
        select(ChannelAccount).where(ChannelAccount.id == account_uuid)
    ).scalar_one_or_none()
    if not account or account.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Account not found")

    try:
        status_data = await get_zalo_personal_service().account_login_status(account_id)
    except Exception as e:
        logger.warning("zalo_personal_account_login_status_failed account=%s err=%s", account_id, e)
        raise HTTPException(status_code=502, detail=f"Worker status failed: {e}")

    return {"connected": status_data.get("status") == "connected", "worker": status_data}


@router.get("/accounts/{account_id}/status")
async def account_status(
    account_id: str,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_enabled()
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    account_uuid = _parse_uuid(account_id, "account ID")
    account = db.execute(
        select(ChannelAccount).where(ChannelAccount.id == account_uuid)
    ).scalar_one_or_none()
    if not account or account.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Account not found")

    worker_status = None
    try:
        worker_status = await get_zalo_personal_service().account_status(account_id)
    except Exception as e:
        logger.warning("zalo_personal_account_status_worker_unreachable account=%s err=%s", account_id, e)

    return {
        "connected": (worker_status or {}).get("status") == "connected" or account.status == "connected",
        "config": await get_zalo_personal_service().get_account(account_id),
        "worker": worker_status,
    }


# ── ACL endpoints ────────────────────────────────────────────────────────

@router.get("/accounts/{account_id}/access")
async def list_account_access(
    account_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_enabled()
    account_uuid = _parse_uuid(account_id, "account ID")
    account = db.execute(
        select(ChannelAccount).where(ChannelAccount.id == account_uuid)
    ).scalar_one_or_none()
    if not account or account.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Account not found")
    return await get_zalo_personal_service().list_access(account_id)


@router.post("/accounts/{account_id}/access", status_code=201)
async def grant_account_access(
    account_id: str,
    data: ChannelAccountAccessCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_enabled()
    account_uuid = _parse_uuid(account_id, "account ID")
    account = db.execute(
        select(ChannelAccount).where(ChannelAccount.id == account_uuid)
    ).scalar_one_or_none()
    if not account or account.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Account not found")

    # Verify target user belongs to same tenant
    target_user = db.execute(
        select(User).where(User.id == data.user_id, User.tenant_id == current_user.tenant_id)
    ).scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found in this tenant")

    return await get_zalo_personal_service().grant_access(account_id, data.user_id, data.permission)


@router.delete("/accounts/{account_id}/access/{access_id}")
async def revoke_account_access(
    account_id: str,
    access_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_enabled()
    account_uuid = _parse_uuid(account_id, "account ID")
    account = db.execute(
        select(ChannelAccount).where(ChannelAccount.id == account_uuid)
    ).scalar_one_or_none()
    if not account or account.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Account not found")

    deleted = await get_zalo_personal_service().revoke_access(account_id, access_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Access entry not found")
    return {"status": "revoked"}


# ═══════════════════════════════════════════════════════════════════════════
# LEGACY: Backward-compatible single-account endpoints
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/connect/start")
async def start_zalo_personal_login(
    data: ZaloPersonalConnectStartRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Start QR login for a Zalo Personal Account worker session (legacy)."""
    _ensure_enabled()
    bot_uuid = _parse_uuid(data.bot_id, "bot ID")
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
    """Poll QR login status and persist public metadata when connected (legacy)."""
    _ensure_enabled()
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"

    bot_uuid = _parse_uuid(bot_id, "bot ID")
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
    """Return saved config plus live worker status for a Zalo Personal session (legacy)."""
    _ensure_enabled()
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"

    bot_uuid = _parse_uuid(bot_id, "bot ID")
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
    """Disconnect and remove the worker-side saved session (legacy)."""
    _ensure_enabled()
    bot_uuid = _parse_uuid(bot_id, "bot ID")
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
