"""
Telegram Bot Service — Direct integration via Telegram Bot API + aiogram 3.
Pattern mirrored from zalo_bot_service.py. Telegram Bot API is nearly identical to Zalo Bot API.
"""
import asyncio
import logging
import secrets
import uuid
from typing import Dict, Any, Optional

from aiogram import Bot
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.types import Update, Message
from sqlalchemy import select

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.bot import Bot as BotModel
from app.services.openrouter_rag_service import get_openrouter_rag_service

logger = logging.getLogger(__name__)

TELEGRAM_API_BASE = "https://api.telegram.org/bot"


class TelegramBotService:
    """
    Direct Telegram Bot integration.
    Each OmniRAG bot stores its own Telegram credentials in bot.config.telegram.
    Uses aiogram Bot for API calls + Update parsing; custom routing (no Dispatcher).
    """

    def __init__(self):
        self.rag_service = get_openrouter_rag_service()
        self._bot_cache: dict[str, Bot] = {}  # bot_token -> Bot instance

    def _get_bot(self, bot_token: str) -> Bot:
        """Get or create an aiogram Bot instance for the given token."""
        if bot_token not in self._bot_cache:
            self._bot_cache[bot_token] = Bot(
                token=bot_token,
                default=DefaultBotProperties(parse_mode=ParseMode.HTML),
            )
        return self._bot_cache[bot_token]

    # ─── Telegram Bot API Helpers ─────────────────────────

    async def get_me(self, bot_token: str) -> dict:
        """Verify token and get bot info."""
        bot = self._get_bot(bot_token)
        user = await bot.get_me()
        return user.model_dump()

    async def set_webhook(self, bot_token: str, webhook_url: str, secret_token: str) -> bool:
        """Register webhook URL on Telegram."""
        bot = self._get_bot(bot_token)
        return await bot.set_webhook(
            url=webhook_url,
            secret_token=secret_token,
            allowed_updates=["message"],
            drop_pending_updates=True,
            max_connections=40,
        )

    async def delete_webhook(self, bot_token: str) -> bool:
        """Remove webhook and close bot session."""
        bot = self._get_bot(bot_token)
        result = await bot.delete_webhook(drop_pending_updates=True)
        # Close session and remove from cache
        await bot.session.close()
        self._bot_cache.pop(bot_token, None)
        return result

    async def send_message(self, bot_token: str, chat_id: int, text: str) -> dict:
        """Send text message to a Telegram chat."""
        bot = self._get_bot(bot_token)
        msg = await bot.send_message(chat_id=chat_id, text=text)
        return msg.model_dump()

    async def send_chat_action(self, bot_token: str, chat_id: int, action: str = "typing") -> None:
        """Send chat action (typing indicator)."""
        bot = self._get_bot(bot_token)
        await bot.send_chat_action(chat_id=chat_id, action=action)

    # ─── Connect / Disconnect ────────────────────────────

    async def connect(self, bot_id: str, bot_token: str, webhook_base_url: str) -> dict:
        """
        Full connection flow:
        1. getMe -> verify token + get bot info
        2. Generate webhook secret
        3. setWebhook -> register our endpoint on Telegram
        4. Return info for saving to bot.config
        """
        bot_info = await self.get_me(bot_token)
        logger.info(f"Telegram Bot verified: {bot_info}")

        webhook_secret = secrets.token_urlsafe(24)
        webhook_url = f"{webhook_base_url}/api/v1/channels/telegram/webhook/{bot_id}"

        await self.set_webhook(bot_token, webhook_url, webhook_secret)
        logger.info(f"Telegram webhook registered: {webhook_url}")

        return {
            "bot_info": bot_info,
            "webhook_url": webhook_url,
            "webhook_secret": webhook_secret,
        }

    async def disconnect(self, bot_token: str) -> None:
        """Remove webhook and clean up bot session."""
        await self.delete_webhook(bot_token)
        logger.info("Telegram webhook removed and session closed")

    # ─── Handle Incoming Webhook ─────────────────────────

    async def handle_webhook(self, bot_id: str, payload: dict) -> dict:
        """
        Process incoming Telegram webhook update.
        Routes by content type: text, photo, document, voice, commands.
        """
        update = Update.model_validate(payload)
        message = update.message

        if not message:
            logger.info(f"Telegram: Ignoring non-message update for bot {bot_id}")
            return {"status": "ignored", "reason": "no_message"}

        chat_id = message.chat.id
        message_id = message.message_id

        db = SessionLocal()
        try:
            bot = db.execute(
                select(BotModel).where(BotModel.id == bot_id, BotModel.is_active == True)
            ).scalar_one_or_none()

            if not bot:
                logger.warning(f"Telegram: Bot {bot_id} not found or inactive")
                return {"status": "not_found"}

            tg_config = (bot.config or {}).get("telegram", {})
            bot_token = tg_config.get("bot_token")

            if not bot_token or not tg_config.get("is_active", False):
                logger.warning(f"Telegram: Integration inactive for bot {bot_id}")
                return {"status": "inactive"}

            # Route by content type
            if message.text:
                return await self._handle_text(message, bot, bot_token, chat_id)
            elif message.photo:
                return await self._handle_photo(message, bot, bot_token, chat_id)
            elif message.document:
                return await self._handle_document(message, bot, bot_token, chat_id)
            elif message.voice:
                return await self._handle_voice(message, bot_token, chat_id)
            else:
                await self.send_message(bot_token, chat_id, "Sorry, this message type is not supported yet.")
                return {"status": "ignored", "reason": "unsupported_type"}

        except Exception as e:
            logger.error(f"Telegram Service Error: {e}", exc_info=True)
            return {"status": "error", "message": str(e)}
        finally:
            db.close()

    # ─── Message Handlers ─────────────────────────────────

    async def _handle_text(self, message: Message, bot: BotModel, bot_token: str, chat_id: int) -> dict:
        text = message.text or ""

        # Commands
        if text.startswith("/start"):
            user_name = message.from_user.full_name if message.from_user else "there"
            welcome = (bot.config or {}).get("welcome_message") or f"Hello {user_name}! I'm {bot.name}. How can I help you today?"
            await self.send_message(bot_token, chat_id, welcome)
            return {"status": "ok", "type": "command_start"}

        if text.startswith("/help"):
            await self.send_message(
                bot_token, chat_id,
                "Send me a question and I'll answer using the knowledge base. You can also send photos or documents (PDF, DOCX)."
            )
            return {"status": "ok", "type": "command_help"}

        # Regular text -> RAG pipeline
        await self.send_chat_action(bot_token, chat_id)

        logger.info(f"Telegram: Processing message for bot '{bot.name}': '{text[:50]}...'")
        result = await self.rag_service.chat(
            bot_id=str(bot.id),
            query=text,
            bot_config={
                **(bot.config or {}),
                "user_id": f"tg_{chat_id}",
                "enable_memory": True,
            },
            session_id=f"tg_{chat_id}"
        )

        ai_response = result["response"]
        await self.send_message(bot_token, chat_id, ai_response)
        logger.info(f"Telegram: Replied to chat {chat_id} for bot '{bot.name}'")

        return {"status": "success", "bot_name": bot.name}

    async def _handle_photo(self, message: Message, bot: BotModel, bot_token: str, chat_id: int) -> dict:
        """Handle photo messages — download, describe, and feed to RAG pipeline."""
        await self.send_chat_action(bot_token, chat_id)

        photo = message.photo[-1]  # Largest size
        caption = message.caption or ""

        aiogram_bot = self._get_bot(bot_token)
        file_obj = await aiogram_bot.get_file(photo.file_id)
        file_bytes = await aiogram_bot.download_file(file_obj.file_path)
        image_data = file_bytes.read()

        # Describe image via OpenRouter vision
        import base64
        import httpx
        from app.core.config import settings as app_settings

        image_b64 = base64.b64encode(image_data).decode("utf-8")
        data_url = f"data:image/jpeg;base64,{image_b64}"

        query = caption or "What's in this image?"
        logger.info(f"Telegram: Processing image for bot '{bot.name}', caption: '{caption[:50]}'")

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {app_settings.OPENROUTER_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "google/gemini-3.1-flash-lite",
                        "messages": [
                            {
                                "role": "user",
                                "content": [
                                    {"type": "text", "text": f"Describe this image briefly in Vietnamese (2-3 sentences). User caption: {caption}" if caption else "Describe this image briefly in Vietnamese (2-3 sentences)."},
                                    {"type": "image_url", "image_url": {"url": data_url}},
                                ],
                            }
                        ],
                    },
                )
                if resp.status_code == 200:
                    description = resp.json()["choices"][0]["message"]["content"]
                else:
                    description = caption or "Image received (could not describe)."
        except Exception as e:
            logger.warning(f"Telegram: Image description failed: {e}")
            description = caption or "Image received."

        # Feed described image to RAG
        result = await self.rag_service.chat(
            bot_id=str(bot.id),
            query=f"[User sent an image]\nImage description: {description}",
            bot_config={
                **(bot.config or {}),
                "user_id": f"tg_{chat_id}",
                "enable_memory": True,
            },
            session_id=f"tg_{chat_id}"
        )

        await self.send_message(bot_token, chat_id, result["response"])
        logger.info(f"Telegram: Replied to image in chat {chat_id} for bot '{bot.name}'")

        return {"status": "success", "bot_name": bot.name, "type": "photo"}

    async def _handle_document(self, message: Message, bot: BotModel, bot_token: str, chat_id: int) -> dict:
        """Handle document messages — download, extract text, feed to RAG pipeline."""
        doc = message.document
        file_name = doc.file_name or f"document_{doc.file_id}"
        mime_type = doc.mime_type or "application/octet-stream"
        file_size_mb = (doc.file_size or 0) / (1024 * 1024)

        # Check file size (Telegram limit is 20MB)
        if file_size_mb > 20:
            await self.send_message(bot_token, chat_id, f"File too large ({file_size_mb:.1f} MB). Telegram limit is 20 MB.")
            return {"status": "ignored", "reason": "file_too_large"}

        await self.send_chat_action(bot_token, chat_id)

        # Download file
        aiogram_bot = self._get_bot(bot_token)
        file_obj = await aiogram_bot.get_file(doc.file_id)
        file_bytes = await aiogram_bot.download_file(file_obj.file_path)
        file_data = file_bytes.read()

        # Upload to MinIO (sync — runs in background task, won't block the main loop)
        import io
        from app.services.storage_service import storage_service

        object_name = f"telegram/{bot.id}/{uuid.uuid4().hex[:12]}/{file_name}"
        try:
            minio_obj = storage_service.upload_file(
                file=io.BytesIO(file_data),
                filename=object_name,
                content_type=mime_type,
            )
            logger.info(f"Telegram: Uploaded document to MinIO: {minio_obj}")
        except Exception as e:
            logger.error(f"Telegram: MinIO upload failed: {e}")

        # Feed document context to RAG
        caption = message.caption or ""
        doc_context = f"File: {file_name} ({mime_type}, {file_size_mb:.1f} MB)"
        if mime_type.startswith("text/"):
            text_preview = file_data[:2000].decode("utf-8", errors="ignore")
            doc_context += f"\nContent preview:\n{text_preview}"
        query = f"{caption}\n\n[{doc_context}]" if caption else f"I uploaded a document.\n\n[{doc_context}]"

        result = await self.rag_service.chat(
            bot_id=str(bot.id),
            query=query,
            bot_config={
                **(bot.config or {}),
                "user_id": f"tg_{chat_id}",
                "enable_memory": True,
            },
            session_id=f"tg_{chat_id}",
        )

        await self.send_message(bot_token, chat_id, result["response"])
        logger.info(f"Telegram: Replied to document in chat {chat_id} for bot '{bot.name}'")

        return {"status": "success", "bot_name": bot.name, "type": "document"}

    async def _handle_voice(self, message: Message, bot_token: str, chat_id: int) -> dict:
        """Handle voice messages — not yet supported."""
        await self.send_message(bot_token, chat_id, "Voice messages are not yet supported. Please send text or a document.")
        return {"status": "ignored", "reason": "voice_not_supported"}


# Singleton
_telegram_bot_service = TelegramBotService()


def get_telegram_bot_service() -> TelegramBotService:
    return _telegram_bot_service
