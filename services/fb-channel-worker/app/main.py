import hmac
import logging
import time
from contextlib import asynccontextmanager
from typing import Any, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field

from . import __version__
from .config import configure_logging, settings
from .manager import manager

configure_logging()
log = logging.getLogger(__name__)
_boot_ts = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("fb-channel-worker starting v=%s", __version__)
    if not settings.WORKER_API_TOKEN or not settings.INBOUND_SECRET:
        log.warning("WORKER_API_TOKEN or INBOUND_SECRET not configured — refusing privileged calls")
    yield
    log.info("fb-channel-worker shutting down — stopping all sessions")
    await manager.stop_all()


app = FastAPI(title="fb-channel-worker", version=__version__, lifespan=lifespan)


# ─── auth dependency ────────────────────────────────────────────────────

def require_bearer(authorization: Optional[str] = Header(default=None)) -> None:
    if not settings.WORKER_API_TOKEN:
        raise HTTPException(status_code=503, detail="worker not configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    if not hmac.compare_digest(token, settings.WORKER_API_TOKEN):
        raise HTTPException(status_code=403, detail="invalid token")


# ─── request models ─────────────────────────────────────────────────────

class LoadRequest(BaseModel):
    cookies: Any = Field(..., description="Either a flat list or Cookie-Editor dict {url, cookies:[...]}")
    reply_policy: str = Field("mention_only", pattern="^(mention_only|all)$")
    thread_whitelist: Optional[list[str]] = None


class SendRequest(BaseModel):
    thread_id: str
    text: str
    reply_to_id: Optional[str] = None
    mentions: Optional[list[dict]] = None  # [{user_id, offset, length}]


class ReactRequest(BaseModel):
    message_id: str
    thread_id: str
    emoji: str = "👍"


class TypingRequest(BaseModel):
    thread_id: str

class LeaveThreadRequest(BaseModel):
    thread_id: str


# ─── routes ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "ok": True,
        "version": __version__,
        "uptime_s": int(time.time() - _boot_ts),
        "loaded_bots": len(manager.list_ids()),
    }


@app.get("/bots", dependencies=[Depends(require_bearer)])
async def list_bots() -> dict[str, Any]:
    return {"bot_ids": manager.list_ids()}


@app.post("/bots/{bot_id}/load", dependencies=[Depends(require_bearer)])
async def load_bot(bot_id: str, req: LoadRequest) -> dict[str, Any]:
    try:
        status = await manager.load(
            bot_id=bot_id,
            cookies_payload=req.cookies,
            reply_policy=req.reply_policy,
            thread_whitelist=req.thread_whitelist,
        )
    except Exception as e:
        log.exception("load failed bot=%s", bot_id)
        raise HTTPException(status_code=400, detail=f"load failed: {type(e).__name__}: {e}")
    return {"ok": True, "status": status.as_dict()}


@app.post("/bots/{bot_id}/unload", dependencies=[Depends(require_bearer)])
async def unload_bot(bot_id: str) -> dict[str, Any]:
    removed = await manager.unload(bot_id)
    return {"ok": True, "removed": removed}


@app.post("/bots/{bot_id}/send", dependencies=[Depends(require_bearer)])
async def send_message(bot_id: str, req: SendRequest) -> dict[str, Any]:
    session = manager.get(bot_id)
    if session is None:
        raise HTTPException(status_code=404, detail="bot not loaded")
    try:
        result = await session.send(req.thread_id, req.text, req.reply_to_id, req.mentions)
    except Exception as e:
        log.exception("send failed bot=%s thread=%s", bot_id, req.thread_id)
        raise HTTPException(status_code=502, detail=f"send failed: {type(e).__name__}: {e}")
    return {"ok": True, **result}


@app.post("/bots/{bot_id}/typing", dependencies=[Depends(require_bearer)])
async def send_typing(bot_id: str, req: TypingRequest) -> dict[str, Any]:
    session = manager.get(bot_id)
    if session is None:
        raise HTTPException(status_code=404, detail="bot not loaded")
    try:
        await session.send_typing(req.thread_id)
    except Exception as e:
        log.warning("typing failed bot=%s thread=%s: %s", bot_id, req.thread_id, e)
        return {"ok": False, "error": str(e)}
    return {"ok": True}

@app.post("/bots/{bot_id}/react", dependencies=[Depends(require_bearer)])
async def react_to_message(bot_id: str, req: ReactRequest) -> dict[str, Any]:
    session = manager.get(bot_id)
    if session is None:
        raise HTTPException(status_code=404, detail="bot not loaded")
    try:
        await session.react(req.message_id, req.thread_id, req.emoji)
    except Exception as e:
        log.warning("react failed bot=%s msg=%s: %s", bot_id, req.message_id, e)
        raise HTTPException(status_code=502, detail=f"react failed: {e}")
    return {"ok": True}


@app.post("/bots/{bot_id}/threads/leave", dependencies=[Depends(require_bearer)])
async def leave_thread(bot_id: str, req: LeaveThreadRequest) -> dict[str, Any]:
    session = manager.get(bot_id)
    if session is None:
        raise HTTPException(status_code=404, detail="bot not loaded")
    try:
        await session.leave_thread(req.thread_id)
    except Exception as e:
        log.exception("leave thread failed bot=%s thread=%s", bot_id, req.thread_id)
        raise HTTPException(status_code=502, detail=f"leave failed: {type(e).__name__}: {e}")
    return {"ok": True, "thread_id": req.thread_id}


@app.get("/bots/{bot_id}/threads/{thread_id}/participants", dependencies=[Depends(require_bearer)])
async def thread_participants(bot_id: str, thread_id: str) -> dict[str, Any]:
    session = manager.get(bot_id)
    if session is None:
        raise HTTPException(status_code=404, detail="bot not loaded")
    try:
        participants = await session.get_participants(thread_id)
    except Exception as e:
        log.exception("get_participants failed bot=%s thread=%s", bot_id, thread_id)
        raise HTTPException(status_code=502, detail=f"get_participants failed: {e}")
    return {"ok": True, "participants": participants}


@app.get("/bots/{bot_id}/threads/{thread_id}/context", dependencies=[Depends(require_bearer)])
async def thread_context(
    bot_id: str,
    thread_id: str,
    message_limit: int = 30,
) -> dict[str, Any]:
    session = manager.get(bot_id)
    if session is None:
        raise HTTPException(status_code=404, detail="bot not loaded")
    try:
        ctx = await session.get_thread_context(thread_id, message_limit=min(message_limit, 50))
    except Exception as e:
        log.exception("get_thread_context failed bot=%s thread=%s", bot_id, thread_id)
        raise HTTPException(status_code=502, detail=f"get_thread_context failed: {e}")
    return {"ok": True, **ctx}


@app.get("/bots/{bot_id}/status", dependencies=[Depends(require_bearer)])
async def bot_status(bot_id: str) -> dict[str, Any]:
    session = manager.get(bot_id)
    if session is None:
        return {"loaded": False, "bot_id": bot_id}
    return session.status.as_dict()
