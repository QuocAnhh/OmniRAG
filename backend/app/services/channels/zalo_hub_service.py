import logging
import httpx
from typing import Dict, Any, Optional
from app.services.openrouter_rag_service import get_openrouter_rag_service
from app.db.session import SessionLocal
from app.models.bot import Bot as BotModel
from app.core.config import settings
from uuid import UUID

logger = logging.getLogger(__name__)

class ZaloHubService:
    """
    Central service to handle multi-tenant Zalo integration via Func.vn Hub.
    """
    def __init__(self):
        self.rag_service = get_openrouter_rag_service()
        # Admin configuration for Func.vn
        self.func_api_url = settings.FUNC_API_URL
        self.func_api_token = settings.FUNC_API_TOKEN

    async def handle_hub_webhook(self, payload: Dict[str, Any]):
        """
        Processes incoming payload from the central Admin Func.vn Webhook.
        Identifies the bot based on the Zalo Account ID (to_account).
        """
        logger.info(f"Received hub webhook payload: {payload}")
        
        # 1. Identify target bot based on Zalo account ID
        # Format expected from Func.vn Zalo Webhook (more robust parsing)
        zalo_account_id = (
            payload.get("account_id") or 
            payload.get("receiver_id") or 
            payload.get("to_account_id") or 
            payload.get("oa_id")
        )
        user_id = (
            payload.get("sender_id") or 
            payload.get("from_user_id") or 
            payload.get("user_id") or 
            payload.get("contact_id")
        )
        user_message = (
            payload.get("content") or 
            payload.get("text") or 
            payload.get("message", {}).get("text")
        )

        if not zalo_account_id or not user_id or not user_message:
            logger.warning(f"Incomplete hub payload: account={zalo_account_id}, user={user_id}, msg={user_message}")
            return {"status": "ignored", "reason": "missing_required_fields"}

        db = SessionLocal()
        try:
            # 2. Find the bot that matches this Zalo Account ID
            # Flexible matching: try exact match or with/without 'zu' prefix
            search_ids = [str(zalo_account_id)]
            if str(zalo_account_id).startswith("zu"):
                search_ids.append(str(zalo_account_id)[2:])
            else:
                search_ids.append(f"zu{zalo_account_id}")

            bot = db.query(BotModel).filter(
                BotModel.config['zalo_integration']['account_id'].astext.in_(search_ids),
                BotModel.config['zalo_integration']['is_active'].as_boolean() == True
            ).first()

            if not bot:
                logger.warning(f"No active bot found for Zalo account {zalo_account_id}")
                return {"status": "not_found", "reason": "bot_not_linked_or_inactive"}

            # 3. Call RAG brain
            # session_id prevents mixing conversations between different Zalo users
            result = await self.rag_service.chat(
                bot_id=str(bot.id),
                query=user_message,
                bot_config=bot.config or {},
                session_id=f"zalo_{user_id}"
            )
            
            ai_response = result["response"]

            # 4. Send reply back via central Func.vn API
            await self.send_reply(user_id, ai_response, zalo_account_id)

            return {"status": "success", "bot_name": bot.name}

        except Exception as e:
            logger.error(f"Zalo Hub Service Error: {e}", exc_info=True)
            return {"status": "error", "message": str(e)}
        finally:
            db.close()

    async def send_reply(self, user_id: str, text: str, oa_id: str):
        """
        Sends back the AI response to Zalo via Admin's Func.vn API.
        """
        if not self.func_api_url or not self.func_api_token:
            logger.error("Admin Func.vn credentials not configured - cannot send reply")
            return

        # Func.vn Spec for 'Reply Zalo User Message' or 'Send Message'
        payload = {
            "user_id": user_id,
            "message": text,
            "phone_number": "",
            "is_broadcast": 0,
            "styles": []
        }

        headers = {
            "Authorization": f"Bearer {self.func_api_token}",
            "Content-Type": "application/json"
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(self.func_api_url, json=payload, headers=headers, timeout=30.0)
                response.raise_for_status()
                logger.info(f"Sent Zalo reply to {user_id} via Hub")
                return response.json()
        except Exception as e:
            logger.error(f"Failed to send Zalo reply via Hub: {e}")
            raise

zalo_hub_service = ZaloHubService()

def get_zalo_hub_service():
    return zalo_hub_service
