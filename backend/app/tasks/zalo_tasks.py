from app.worker import celery_app
from app.services.channels.zalo_hub_service import get_zalo_hub_service
import asyncio
import logging

logger = logging.getLogger(__name__)

@celery_app.task(name="process_zalo_hub_webhook")
def process_zalo_hub_webhook_task(payload: dict):
    """
    Celery task to process Zalo messages asynchronously.
    """
    logger.info(f"Processing Zalo Hub task for payload: {payload}")
    
    service = get_zalo_hub_service()
    
    try:
        return asyncio.run(service.handle_hub_webhook(payload))
    except RuntimeError:
        # Fallback for environments where a loop might already exist (unlikely in worker prefork but safe)
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(service.handle_hub_webhook(payload))
