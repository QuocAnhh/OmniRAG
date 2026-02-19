"""
Celery task for processing Zalo Bot messages asynchronously.
"""
from app.worker import celery_app
from app.services.channels.zalo_bot_service import get_zalo_bot_service
import asyncio
import logging

logger = logging.getLogger(__name__)


@celery_app.task(name="process_zalo_bot_webhook")
def process_zalo_bot_webhook_task(bot_id: str, payload: dict):
    """
    Celery task to process incoming Zalo Bot messages.
    Called by the webhook endpoint after verifying the secret token.
    """
    logger.info(f"Processing Zalo Bot message for bot: {bot_id}")

    service = get_zalo_bot_service()

    try:
        return asyncio.run(service.handle_webhook(bot_id, payload))
    except RuntimeError:
        # Fallback for environments where a loop might already exist
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(service.handle_webhook(bot_id, payload))
