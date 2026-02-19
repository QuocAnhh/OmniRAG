"""
Zalo Bot Channel — Webhook & Management Endpoints
Handles incoming Zalo Bot messages and connect/disconnect flows.
"""
import logging
from datetime import datetime
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from pydantic import BaseModel

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.models.bot import Bot as BotModel
from app.tasks.zalo_bot_tasks import process_zalo_bot_webhook_task

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Request Schemas ─────────────────────────────────

class ZaloBotConnectRequest(BaseModel):
    bot_id: str
    bot_token: str


# ─── Webhook Endpoint (Public — called by Zalo) ─────

@router.post("/webhook/{bot_id}")
async def zalo_bot_webhook(bot_id: str, request: Request):
    """
    Receive webhook events from Zalo Bot Platform.
    Each bot has its own unique webhook URL.
    Verifies the secret token from the x-bot-api-secret-token header.
    """
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        bot = db.query(BotModel).filter(BotModel.id == bot_id).first()
        if not bot:
            raise HTTPException(status_code=404, detail="Bot not found")

        zalo_config = (bot.config or {}).get("zalo_bot", {})
        expected_secret = zalo_config.get("webhook_secret", "")

        # Verify secret token header
        received_secret = request.headers.get("x-bot-api-secret-token", "")
        if not expected_secret or received_secret != expected_secret:
            logger.warning(f"Zalo Bot webhook: Invalid secret for bot {bot_id}")
            raise HTTPException(status_code=403, detail="Invalid secret token")
    finally:
        db.close()

    # Parse payload and dispatch to Celery
    payload = await request.json()
    logger.info(f"Zalo Bot webhook received for bot {bot_id}")
    process_zalo_bot_webhook_task.delay(bot_id, payload)

    return {"status": "received"}


# ─── Connect (Authenticated) ────────────────────────

@router.post("/connect")
async def connect_zalo_bot(
    data: ZaloBotConnectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Connect a Zalo Bot to an OmniRAG bot.
    1. Verify bot_token via getMe
    2. Set webhook automatically
    3. Save config to bot.config.zalo_bot
    """
    from app.services.channels.zalo_bot_service import get_zalo_bot_service
    from app.core.config import settings

    # Ensure PUBLIC_URL is configured
    if not settings.PUBLIC_URL:
        raise HTTPException(
            status_code=500,
            detail="PUBLIC_URL is not configured on the server. Please set it in .env"
        )

    # Find and authorize the bot
    bot = db.query(BotModel).filter(
        BotModel.id == data.bot_id,
        BotModel.tenant_id == current_user.tenant_id
    ).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    service = get_zalo_bot_service()

    try:
        # Connect: verify token + set webhook (using server's PUBLIC_URL)
        result = await service.connect(
            bot_id=str(bot.id),
            bot_token=data.bot_token,
            webhook_base_url=settings.PUBLIC_URL.rstrip("/")
        )

        # Save Zalo Bot config into bot.config
        config = dict(bot.config or {})
        config["zalo_bot"] = {
            "bot_token": data.bot_token,
            "bot_info": result["bot_info"],
            "webhook_url": result["webhook_url"],
            "webhook_secret": result["webhook_secret"],
            "is_active": True,
            "connected_at": datetime.utcnow().isoformat(),
        }
        bot.config = config
        flag_modified(bot, "config")
        db.commit()

        logger.info(f"Zalo Bot connected for bot '{bot.name}' (ID: {bot.id})")

        return {
            "status": "connected",
            "bot_info": result["bot_info"],
            "webhook_url": result["webhook_url"],
        }
    except Exception as e:
        logger.error(f"Zalo Bot connect failed: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Connection failed: {str(e)}")


# ─── Disconnect (Authenticated) ─────────────────────

@router.post("/disconnect/{bot_id}")
async def disconnect_zalo_bot(
    bot_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Disconnect Zalo Bot from an OmniRAG bot. Keeps other config intact."""
    bot = db.query(BotModel).filter(
        BotModel.id == bot_id,
        BotModel.tenant_id == current_user.tenant_id
    ).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    config = dict(bot.config or {})
    config.pop("zalo_bot", None)
    bot.config = config
    flag_modified(bot, "config")
    db.commit()

    logger.info(f"Zalo Bot disconnected for bot '{bot.name}' (ID: {bot.id})")
    return {"status": "disconnected"}


# ─── Status (Authenticated) ─────────────────────────

@router.get("/status/{bot_id}")
async def zalo_bot_status(
    bot_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check Zalo Bot connection status for a bot."""
    bot = db.query(BotModel).filter(
        BotModel.id == bot_id,
        BotModel.tenant_id == current_user.tenant_id
    ).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    zalo_config = (bot.config or {}).get("zalo_bot", {})

    return {
        "is_connected": bool(zalo_config.get("bot_token")),
        "is_active": zalo_config.get("is_active", False),
        "bot_info": zalo_config.get("bot_info"),
        "webhook_url": zalo_config.get("webhook_url"),
        "connected_at": zalo_config.get("connected_at"),
    }
