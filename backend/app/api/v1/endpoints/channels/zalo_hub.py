from fastapi import APIRouter, Request, Depends
import logging
from app.tasks.zalo_tasks import process_zalo_hub_webhook_task

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/hub-webhook")
async def zalo_central_hub_webhook(
    request: Request
):
    """
    CENTRAL Hub Webhook. 
    This is the ONLY URL configured on Func.vn Admin side.
    It receives messages for ALL connected Zalo accounts and routes them.
    """
    try:
        payload = await request.json()
        logger.info("Incoming message at Zalo Central Hub")
        
        # Dispatch to Celery worker immediately
        process_zalo_hub_webhook_task.delay(payload)
        
        return {"status": "received"}
    except Exception as e:
        logger.error(f"Webhook receive error: {e}")
        return {"status": "error", "message": "Failed to parse payload"}
