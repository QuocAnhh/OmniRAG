import asyncio
import hashlib
import hmac
import json
import logging
from typing import Any

import httpx

from .config import settings

log = logging.getLogger(__name__)


def _sign(body: bytes, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


async def push_inbound(bot_id: str, kind: str, data: dict[str, Any]) -> None:
    payload = {"kind": kind, "bot_id": bot_id, "data": data}
    body = json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8")
    signature = _sign(body, settings.INBOUND_SECRET)
    url = f"{settings.BACKEND_URL.rstrip('/')}/api/v1/channels/facebook/inbound/{bot_id}"
    headers = {
        "Content-Type": "application/json",
        "X-FB-Worker-Signature": signature,
    }

    backoff = 0.5
    last_err: Exception | None = None
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=settings.INBOUND_HTTP_TIMEOUT_SECONDS) as client:
                r = await client.post(url, content=body, headers=headers)
                if r.status_code >= 500:
                    raise RuntimeError(f"backend {r.status_code}: {r.text[:200]}")
                if r.status_code >= 400:
                    log.warning("inbound rejected by backend bot=%s status=%s body=%s",
                                bot_id, r.status_code, r.text[:200])
                    return
                return
        except Exception as e:
            last_err = e
            log.warning("inbound attempt %d failed bot=%s err=%s", attempt + 1, bot_id, e)
            await asyncio.sleep(backoff)
            backoff *= 2

    log.error("inbound dropped after retries bot=%s err=%s", bot_id, last_err)
