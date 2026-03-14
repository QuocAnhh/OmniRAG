import hmac
import logging

from fastapi import APIRouter, Request, HTTPException

from app.core.config import settings
from app.tasks.zalo_tasks import process_zalo_hub_webhook_task

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/hub-webhook")
async def zalo_central_hub_webhook(request: Request):
    """
    CENTRAL Hub Webhook.
    This is the ONLY URL configured on Func.vn Admin side.
    It receives messages for ALL connected Zalo accounts and routes them.

    Security: verifies the x-hub-secret header using constant-time comparison
    to prevent both unauthorized requests and timing attacks.
    Set ZALO_HUB_WEBHOOK_SECRET in .env to enable verification.
    """
    # Verify webhook secret if configured
    expected_secret = settings.ZALO_HUB_WEBHOOK_SECRET
    if expected_secret:
        received_secret = request.headers.get("x-hub-secret", "")
        if not received_secret or not hmac.compare_digest(
            received_secret.encode(), expected_secret.encode()
        ):
            logger.warning("Zalo Hub webhook: invalid or missing x-hub-secret header")
            raise HTTPException(status_code=403, detail="Invalid webhook secret")

    try:
        payload = await request.json()
        logger.info("Incoming message at Zalo Central Hub")

        # Dispatch to Celery worker immediately
        process_zalo_hub_webhook_task.delay(payload)

        return {"status": "received"}
    except Exception as e:
        logger.error(f"Webhook receive error: {e}")
        return {"status": "error", "message": "Failed to parse payload"}
