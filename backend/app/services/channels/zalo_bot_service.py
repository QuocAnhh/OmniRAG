"""
Zalo Bot Service — Direct integration via Zalo Bot Platform (bot-api.zapps.me)
Pattern mirrored from zalo-bot repo. API is nearly identical to Telegram Bot API.
"""
import httpx
import logging
import secrets
from typing import Dict, Any, Optional
from app.services.openrouter_rag_service import get_openrouter_rag_service
from app.db.session import SessionLocal
from app.models.bot import Bot as BotModel
from sqlalchemy.orm.attributes import flag_modified

logger = logging.getLogger(__name__)

ZALO_BOT_API_BASE = "https://bot-api.zapps.me/bot"


class ZaloBotService:
    """
    Direct Zalo Bot integration — no middleware needed.
    Each bot stores its own Zalo Bot credentials in bot.config.zalo_bot
    """

    def __init__(self):
        self.rag_service = get_openrouter_rag_service()

    # ─── Zalo Bot API Helpers ────────────────────────────

    async def _zalo_post(self, bot_token: str, method: str, payload: dict) -> dict:
        """Generic POST to Zalo Bot API (identical pattern to Telegram)."""
        url = f"{ZALO_BOT_API_BASE}{bot_token}/{method}"
        async with httpx.AsyncClient(timeout=15) as client:
            try:
                r = await client.post(url, json=payload)
                logger.info(f"Zalo Bot API {method} response: {r.status_code}")
                data = r.json()
                # Zalo returns 200 with ok=false for errors
                if r.status_code == 200 and data.get("ok") is False:
                    error_msg = data.get("description", "Unknown Zalo API error")
                    raise Exception(f"Zalo API error: {error_msg}")
                r.raise_for_status()
                return data
            except httpx.ConnectTimeout:
                logger.error(f"Zalo Bot API timeout connecting to {url[:60]}...")
                raise Exception("Cannot connect to Zalo Bot API — check your Bot Token")
            except httpx.HTTPStatusError as e:
                logger.error(f"Zalo Bot API error: {e.response.status_code} - {e.response.text}")
                raise Exception(f"Zalo API returned {e.response.status_code}: {e.response.text}")
            except Exception as e:
                logger.error(f"Zalo Bot API call failed: {e}")
                raise

    async def get_me(self, bot_token: str) -> dict:
        """Get bot info — verify token is valid."""
        return await self._zalo_post(bot_token, "getMe", {})

    async def set_webhook(self, bot_token: str, webhook_url: str, secret_token: str) -> dict:
        """Register webhook URL on Zalo Bot Platform."""
        return await self._zalo_post(bot_token, "setWebhook", {
            "url": webhook_url,
            "secret_token": secret_token
        })

    async def send_message(self, bot_token: str, chat_id: str, text: str) -> dict:
        """Send text message to a Zalo user/chat."""
        return await self._zalo_post(bot_token, "sendMessage", {
            "chat_id": chat_id,
            "text": text
        })

    # ─── Connect / Disconnect ────────────────────────────

    async def connect(self, bot_id: str, bot_token: str, webhook_base_url: str) -> dict:
        """
        Full connection flow:
        1. getMe → verify token + get bot info
        2. Generate webhook secret
        3. setWebhook → register our endpoint on Zalo
        4. Return info for saving to bot.config
        """
        # 1. Verify token
        bot_info = await self.get_me(bot_token)
        logger.info(f"Zalo Bot verified: {bot_info}")

        # 2. Generate secure webhook secret (Zalo requires 8-256 chars, A-Z a-z 0-9 _ -)
        webhook_secret = secrets.token_urlsafe(24)  # ~32 chars, URL-safe base64

        # 3. Build webhook URL (unique per bot)
        webhook_url = f"{webhook_base_url}/api/v1/channels/zalo-bot/webhook/{bot_id}"

        # 4. Register webhook on Zalo
        webhook_result = await self.set_webhook(bot_token, webhook_url, webhook_secret)
        logger.info(f"Webhook registered: {webhook_result}")

        return {
            "bot_info": bot_info,
            "webhook_url": webhook_url,
            "webhook_secret": webhook_secret,
        }

    # ─── Handle Incoming Messages ────────────────────────

    async def handle_webhook(self, bot_id: str, payload: dict) -> dict:
        """
        Process incoming Zalo Bot webhook event.
        
        Payload structure (from zalo-bot repo):
        {
            "message": {
                "chat": { "id": "chat_id_here" },
                "text": "user message text"
            }
        }
        """
        # Parse payload — same structure as zalo-bot repo
        msg = payload.get("message", {}) or {}
        chat = msg.get("chat", {}) or {}
        chat_id = chat.get("id")
        text = msg.get("text", "") or ""

        if not chat_id or not text.strip():
            logger.info(f"Zalo Bot: Ignoring non-text event for bot {bot_id}")
            return {"status": "ignored", "reason": "no_text_or_chat_id"}

        db = SessionLocal()
        try:
            bot = db.query(BotModel).filter(
                BotModel.id == bot_id,
                BotModel.is_active == True
            ).first()

            if not bot:
                logger.warning(f"Zalo Bot: Bot {bot_id} not found or inactive")
                return {"status": "not_found"}

            zalo_config = (bot.config or {}).get("zalo_bot", {})
            bot_token = zalo_config.get("bot_token")

            if not bot_token or not zalo_config.get("is_active", False):
                logger.warning(f"Zalo Bot: Integration inactive for bot {bot_id}")
                return {"status": "inactive"}

            # Call RAG engine
            logger.info(f"Zalo Bot: Processing message for bot '{bot.name}': '{text[:50]}...'")
            result = await self.rag_service.chat(
                bot_id=str(bot.id),
                query=text,
                bot_config=bot.config or {},
                session_id=f"zalo_bot_{chat_id}"
            )

            ai_response = result["response"]

            # Send AI reply back via Zalo Bot API
            await self.send_message(bot_token, chat_id, ai_response)
            logger.info(f"Zalo Bot: Replied to chat {chat_id} for bot '{bot.name}'")

            return {"status": "success", "bot_name": bot.name}

        except Exception as e:
            logger.error(f"Zalo Bot Service Error: {e}", exc_info=True)
            return {"status": "error", "message": str(e)}
        finally:
            db.close()


# Singleton
_zalo_bot_service = ZaloBotService()

def get_zalo_bot_service() -> ZaloBotService:
    return _zalo_bot_service
