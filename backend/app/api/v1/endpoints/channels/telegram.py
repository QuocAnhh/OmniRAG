"""
Telegram Bot Channel — Webhook & Management Endpoints
Handles incoming Telegram messages and connect/disconnect flows.
Pattern mirrors zalo_bot.py exactly — Telegram Bot API is nearly identical.
"""
import asyncio
import hmac
import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified
from pydantic import BaseModel

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.models.user import User
from app.models.bot import Bot as BotModel
from app.models.channel_account import ChannelAccount

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Request Schemas ─────────────────────────────────

class TelegramConnectRequest(BaseModel):
    bot_id: str
    bot_token: str


# ─── Multi-account ──────────────────────────────────────────────────────

@router.get("/bots/{bot_id}/accounts")
async def list_telegram_accounts(
    bot_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List Telegram accounts for a bot."""
    bot = db.execute(
        select(BotModel).where(
            BotModel.id == bot_id, BotModel.tenant_id == current_user.tenant_id
        )
    ).scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    from app.services.channels.telegram_service import get_telegram_bot_service
    return await get_telegram_bot_service().list_accounts(bot_id)


# ─── Webhook Endpoint (Public — called by Telegram) ──

@router.post("/webhook/{bot_id}")
async def telegram_webhook(bot_id: str, request: Request):
    """
    Receive webhook updates from Telegram Bot API.
    Each bot has its own unique webhook URL.
    Verifies the secret token from the X-Telegram-Bot-Api-Secret-Token header.
    """
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        bot = db.execute(select(BotModel).where(BotModel.id == bot_id)).scalar_one_or_none()
        if not bot:
            raise HTTPException(status_code=404, detail="Bot not found")

        tg_config = (bot.config or {}).get("telegram", {})
        expected_secret = tg_config.get("webhook_secret", "")

        logger.info("telegram_webhook_received", extra={"bot_id": bot_id})

        # Verify secret token header using constant-time comparison
        received_secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if not expected_secret or not hmac.compare_digest(
            received_secret.encode(), expected_secret.encode()
        ):
            logger.warning("telegram_webhook_secret_mismatch", extra={"bot_id": bot_id})
            raise HTTPException(status_code=403, detail="Invalid secret token")
    finally:
        db.close()

    # Parse payload and process in background (same pattern as Zalo Bot)
    payload = await request.json()
    logger.info(f"Telegram webhook received for bot {bot_id}")

    from app.services.channels.telegram_service import get_telegram_bot_service
    service = get_telegram_bot_service()
    asyncio.create_task(service.handle_webhook(bot_id, payload))

    return {"status": "received"}


# ─── Connect (Authenticated) ────────────────────────

@router.post("/connect")
async def connect_telegram(
    data: TelegramConnectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Connect a Telegram Bot to an OmniRAG bot.
    1. Verify bot_token via getMe
    2. Set webhook automatically
    3. Save config to bot.config.telegram
    """
    from app.services.channels.telegram_service import get_telegram_bot_service

    if not settings.PUBLIC_URL:
        raise HTTPException(
            status_code=500,
            detail="PUBLIC_URL is not configured on the server. Please set it in .env"
        )

    bot = db.execute(
        select(BotModel).where(
            BotModel.id == data.bot_id, BotModel.tenant_id == current_user.tenant_id
        )
    ).scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    service = get_telegram_bot_service()

    try:
        result = await service.connect(
            bot_id=str(bot.id),
            bot_token=data.bot_token,
            webhook_base_url=settings.PUBLIC_URL.rstrip("/")
        )

        bot_info = result["bot_info"]
        config = dict(bot.config or {})
        config["telegram"] = {
            "bot_token": data.bot_token,
            "bot_username": f"@{bot_info.get('username', '')}" if bot_info.get("username") else None,
            "bot_info": bot_info,
            "webhook_url": result["webhook_url"],
            "webhook_secret": result["webhook_secret"],
            "is_active": True,
            "connected_at": datetime.utcnow().isoformat(),
        }
        bot.config = config
        flag_modified(bot, "config")

        # Also save to channel_accounts table for multi-account support
        existing = db.execute(
            select(ChannelAccount).where(
                ChannelAccount.bot_id == bot.id,
                ChannelAccount.channel_type == "telegram",
                ChannelAccount.channel_uid == f"@{bot_info.get('username', '')}" if bot_info.get("username") else None,
            )
        ).scalar_one_or_none()
        if existing:
            existing.status = "connected"
            existing.display_name = bot_info.get("first_name", "")
            existing.session_data = {"bot_token": data.bot_token, "webhook_secret": result["webhook_secret"]}
            existing.connected_at = datetime.utcnow()
            existing.is_active = True
        else:
            db.add(ChannelAccount(
                id=uuid.uuid4(),
                bot_id=bot.id,
                tenant_id=bot.tenant_id,
                channel_type="telegram",
                display_name=bot_info.get("first_name", ""),
                channel_uid=f"@{bot_info.get('username', '')}" if bot_info.get("username") else None,
                status="connected",
                session_data={"bot_token": data.bot_token, "webhook_secret": result["webhook_secret"]},
                connected_at=datetime.utcnow(),
            ))
        db.commit()

        logger.info(f"Telegram Bot connected for bot '{bot.name}' (ID: {bot.id})")

        return {
            "status": "connected",
            "bot_info": bot_info,
            "webhook_url": result["webhook_url"],
        }
    except Exception as e:
        logger.error(f"Telegram connect failed: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Connection failed: {str(e)}")


# ─── Disconnect (Authenticated) ─────────────────────

@router.post("/disconnect/{bot_id}")
async def disconnect_telegram(
    bot_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Disconnect Telegram Bot from an OmniRAG bot. Removes webhook and config."""
    bot = db.execute(
        select(BotModel).where(
            BotModel.id == bot_id, BotModel.tenant_id == current_user.tenant_id
        )
    ).scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    tg_config = (bot.config or {}).get("telegram", {})
    bot_token = tg_config.get("bot_token")

    if bot_token:
        try:
            from app.services.channels.telegram_service import get_telegram_bot_service
            service = get_telegram_bot_service()
            await service.disconnect(bot_token, bot_id=bot_id)
        except Exception as e:
            logger.warning(f"Telegram disconnect cleanup failed: {e}")

    config = dict(bot.config or {})
    config.pop("telegram", None)
    bot.config = config
    flag_modified(bot, "config")
    db.commit()

    logger.info(f"Telegram Bot disconnected for bot '{bot.name}' (ID: {bot.id})")
    return {"status": "disconnected"}


# ─── Status (Authenticated) ─────────────────────────

@router.get("/status/{bot_id}")
async def telegram_status(
    bot_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check Telegram Bot connection status for a bot."""
    bot = db.execute(
        select(BotModel).where(
            BotModel.id == bot_id, BotModel.tenant_id == current_user.tenant_id
        )
    ).scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    tg_config = (bot.config or {}).get("telegram", {})

    return {
        "is_connected": bool(tg_config.get("bot_token")),
        "is_active": tg_config.get("is_active", False),
        "bot_info": tg_config.get("bot_info"),
        "bot_username": tg_config.get("bot_username"),
        "webhook_url": tg_config.get("webhook_url"),
        "connected_at": tg_config.get("connected_at"),
    }
