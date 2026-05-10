# 🤖 Zalo Bot Integration — Implementation Plan (v2)

> **Status: IMPLEMENTED** (commit `1ed3c0b`). Xem code thực tế:
> - `backend/app/services/channels/zalo_bot_service.py` — service core
> - `backend/app/api/v1/endpoints/channels/zalo_bot.py` — webhook + connect/disconnect endpoints
> - `backend/app/tasks/zalo_bot_tasks.py` — Celery task (imported nhưng webhook hiện xử lý in-process)
>
> **Thay đổi so với plan ban đầu:**
> - Webhook xử lý **in-process** (`asyncio.create_task`) thay vì dispatch qua Celery — đảm bảo LightRAG, Redis cache, memory hoạt động giống web chat
> - **Typing indicator** (`sendChatAction`) được gửi trước khi xử lý RAG
> - Header debug logging để trace `x-bot-api-secret-token`

> **Dựa trên**: Repo `zalo-bot` sẵn có — Zalo Bot Platform (`bot-api.zapps.me`)  
> **Pipeline user**: Paste Bot Token → Click Connect → Bot live trên Zalo  
> **Estimated effort**: 2-3 ngày  
> **Tương tự**: Telegram BotFather flow

---

## 🔑 Key Discovery: Zalo Bot Platform API

Zalo Bot Platform (`bot-api.zapps.me`) hoạt động **gần giống Telegram Bot API**:

| Feature | Zalo Bot Platform | Telegram Bot API |
|---------|-------------------|-----------------|
| API Base | `https://bot-api.zapps.me/bot{TOKEN}` | `https://api.telegram.org/bot{TOKEN}` |
| Token format | `id:secret` (e.g. `4045714827:FrVA...`) | `id:secret` (e.g. `123456:ABC-DEF`) |
| setWebhook | ✅ `POST /setWebhook` | ✅ `POST /setWebhook` |
| getMe | ✅ `POST /getMe` | ✅ `POST /getMe` |
| sendMessage | ✅ `POST /sendMessage` | ✅ `POST /sendMessage` |
| Webhook verify | `x-bot-api-secret-token` header | `X-Telegram-Bot-Api-Secret-Token` header |
| Payload format | `{ message: { chat: { id }, text } }` | `{ message: { chat: { id }, text } }` |

**→ Gần như copy-paste logic từ Telegram integration!**

---

## 🎯 User Pipeline (30 giây!)

```
Bước 1: User tạo Zalo Bot trên zapps.me → Lấy Bot Token
Bước 2: Paste Bot Token vào OmniRAG → Click "Connect"
Bước 3: Done! ✅ Backend tự setWebhook + getMe
```

---

## 📊 Kiến trúc

```
┌─────────────────────────────────────────────────────────────┐
│                    User nhắn tin trên Zalo                    │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP POST (webhook)
                           │ Header: x-bot-api-secret-token
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  OmniRAG Backend                                             │
│                                                              │
│  POST /api/v1/channels/zalo-bot/webhook/{bot_id}             │
│     ├── Verify secret token                                  │
│     ├── Parse: payload.message.chat.id + payload.message.text│
│     └── Dispatch → Celery worker                             │
│              │                                               │
│              ▼                                               │
│  ┌─── Celery Worker ───────────────────────┐                 │
│  │ 1. Load bot config (token, etc.)        │                 │
│  │ 2. Call RAG engine → get AI response    │                 │
│  │ 3. POST bot-api.zapps.me/sendMessage    │                 │
│  └─────────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Files cần tạo/sửa

### Backend — Tạo mới

| # | File | Mô tả |
|---|------|--------|
| 1 | `backend/app/services/channels/zalo_bot_service.py` | Core: setWebhook, getMe, sendMessage, handle webhook |
| 2 | `backend/app/api/v1/endpoints/channels/zalo_bot.py` | Endpoints: webhook, connect, disconnect, status |
| 3 | `backend/app/tasks/zalo_bot_tasks.py` | Celery task: process message async |

### Backend — Sửa

| # | File | Thay đổi |
|---|------|----------|
| 4 | `backend/app/api/api.py` | Thêm router `zalo_bot` |

### Frontend — Sửa

| # | File | Thay đổi |
|---|------|----------|
| 5 | `frontend/src/pages/BotConfigPage.tsx` | Thay Zalo Hub UI cũ → Zalo Bot UI mới (paste token) |

---

## 🔧 Implementation Chi Tiết

### File 1: `zalo_bot_service.py`

```python
"""
Zalo Bot Service — Direct integration via bot-api.zapps.me
Inspired by zalo-bot repo pattern.
"""
import httpx
import logging
from typing import Optional, Dict, Any
from app.db.session import SessionLocal
from app.models.bot import Bot as BotModel
from app.services.openrouter_rag_service import get_openrouter_rag_service

logger = logging.getLogger(__name__)

ZALO_BOT_API_BASE = "https://bot-api.zapps.me/bot"


class ZaloBotService:

    def __init__(self):
        self.rag_service = get_openrouter_rag_service()

    # ─── Zalo Bot API Helpers ────────────────────────────

    async def _zalo_post(self, bot_token: str, method: str, payload: dict) -> dict:
        """Generic POST to Zalo Bot API."""
        url = f"{ZALO_BOT_API_BASE}{bot_token}/{method}"
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(url, json=payload)
            r.raise_for_status()
            return r.json()

    async def get_me(self, bot_token: str) -> dict:
        """Get bot info — verify token is valid."""
        return await self._zalo_post(bot_token, "getMe", {})

    async def set_webhook(self, bot_token: str, webhook_url: str, secret_token: str) -> dict:
        """Register webhook URL on Zalo."""
        return await self._zalo_post(bot_token, "setWebhook", {
            "url": webhook_url,
            "secret_token": secret_token
        })

    async def send_message(self, bot_token: str, chat_id: str, text: str) -> dict:
        """Send text message to user."""
        return await self._zalo_post(bot_token, "sendMessage", {
            "chat_id": chat_id,
            "text": text
        })

    # ─── Connect / Disconnect ────────────────────────────

    async def connect(self, bot_id: str, bot_token: str, webhook_base_url: str) -> dict:
        """
        Full connect flow:
        1. getMe → verify token + get bot info
        2. setWebhook → register our endpoint
        3. Save config to bot.config.zalo_bot
        """
        # 1. Verify token
        bot_info = await self.get_me(bot_token)

        # 2. Generate webhook URL & secret
        import secrets
        webhook_secret = secrets.token_hex(16)
        webhook_url = f"{webhook_base_url}/api/v1/channels/zalo-bot/webhook/{bot_id}"

        # 3. Set webhook
        await self.set_webhook(bot_token, webhook_url, webhook_secret)

        # 4. Return info to save
        return {
            "bot_info": bot_info,
            "webhook_url": webhook_url,
            "webhook_secret": webhook_secret,
        }

    # ─── Handle Incoming Messages ────────────────────────

    async def handle_webhook(self, bot_id: str, payload: dict) -> dict:
        """
        Process incoming Zalo webhook event.
        Payload structure (from zalo-bot repo):
        {
            "message": {
                "chat": { "id": "chat_id_here" },
                "text": "user message"
            }
        }
        """
        msg = payload.get("message", {}) or {}
        chat = msg.get("chat", {}) or {}
        chat_id = chat.get("id")
        text = msg.get("text", "") or ""

        if not chat_id or not text.strip():
            return {"status": "ignored", "reason": "no_text_or_chat_id"}

        db = SessionLocal()
        try:
            bot = db.query(BotModel).filter(
                BotModel.id == bot_id,
                BotModel.is_active == True
            ).first()

            if not bot:
                return {"status": "not_found"}

            zalo_config = (bot.config or {}).get("zalo_bot", {})
            bot_token = zalo_config.get("bot_token")
            if not bot_token or not zalo_config.get("is_active"):
                return {"status": "inactive"}

            # Call RAG engine
            result = await self.rag_service.chat(
                bot_id=str(bot.id),
                query=text,
                bot_config=bot.config or {},
                session_id=f"zalo_bot_{chat_id}"
            )

            # Send AI reply
            await self.send_message(bot_token, chat_id, result["response"])
            return {"status": "success", "bot_name": bot.name}

        except Exception as e:
            logger.error(f"Zalo Bot error: {e}", exc_info=True)
            return {"status": "error", "message": str(e)}
        finally:
            db.close()


# Singleton
_service = ZaloBotService()
def get_zalo_bot_service():
    return _service
```

### File 2: `zalo_bot.py` (Endpoints)

```python
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
import logging

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.models.bot import Bot
from app.tasks.zalo_bot_tasks import process_zalo_bot_webhook_task

logger = logging.getLogger(__name__)
router = APIRouter()


class ZaloBotConnectRequest(BaseModel):
    bot_id: str
    bot_token: str


@router.post("/webhook/{bot_id}")
async def zalo_bot_webhook(bot_id: str, request: Request):
    """
    Receive webhook events from Zalo Bot Platform.
    Verify secret token from header.
    """
    # Load bot to check webhook secret
    from app.db.session import SessionLocal
    db = SessionLocal()
    try:
        bot = db.query(Bot).filter(Bot.id == bot_id).first()
        if not bot:
            raise HTTPException(status_code=404)

        zalo_config = (bot.config or {}).get("zalo_bot", {})
        expected_secret = zalo_config.get("webhook_secret", "")

        # Verify header
        received_secret = request.headers.get("x-bot-api-secret-token", "")
        if received_secret != expected_secret:
            raise HTTPException(status_code=403, detail="Invalid secret")
    finally:
        db.close()

    payload = await request.json()
    logger.info(f"Zalo Bot webhook for bot {bot_id}")

    # Dispatch to Celery
    process_zalo_bot_webhook_task.delay(bot_id, payload)
    return {"status": "received"}


@router.post("/connect")
async def connect_zalo_bot(
    data: ZaloBotConnectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Connect a Zalo Bot to an OmniRAG bot.
    1. Verify bot_token via getMe
    2. Set webhook
    3. Save config
    """
    from app.services.channels.zalo_bot_service import get_zalo_bot_service
    from app.core.config import settings

    bot = db.query(Bot).filter(
        Bot.id == data.bot_id,
        Bot.tenant_id == current_user.tenant_id
    ).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    service = get_zalo_bot_service()

    try:
        # Detect webhook base URL
        webhook_base = settings.PUBLIC_URL or "https://your-domain.com"
        result = await service.connect(data.bot_id, data.bot_token, webhook_base)

        # Save to bot config
        config = bot.config or {}
        config["zalo_bot"] = {
            "bot_token": data.bot_token,
            "bot_info": result["bot_info"],
            "webhook_url": result["webhook_url"],
            "webhook_secret": result["webhook_secret"],
            "is_active": True,
            "connected_at": str(__import__('datetime').datetime.utcnow()),
        }
        bot.config = config
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(bot, "config")
        db.commit()

        return {
            "status": "connected",
            "bot_info": result["bot_info"],
            "webhook_url": result["webhook_url"],
        }
    except Exception as e:
        logger.error(f"Connect Zalo Bot failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/disconnect/{bot_id}")
async def disconnect_zalo_bot(
    bot_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Disconnect Zalo Bot from OmniRAG bot."""
    bot = db.query(Bot).filter(
        Bot.id == bot_id,
        Bot.tenant_id == current_user.tenant_id
    ).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    config = bot.config or {}
    config.pop("zalo_bot", None)
    bot.config = config
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(bot, "config")
    db.commit()

    return {"status": "disconnected"}


@router.get("/status/{bot_id}")
async def zalo_bot_status(
    bot_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check Zalo Bot connection status."""
    bot = db.query(Bot).filter(
        Bot.id == bot_id,
        Bot.tenant_id == current_user.tenant_id
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
```

### File 3: `zalo_bot_tasks.py`

```python
from app.worker import celery_app
from app.services.channels.zalo_bot_service import get_zalo_bot_service
import asyncio
import logging

logger = logging.getLogger(__name__)

@celery_app.task(name="process_zalo_bot_webhook")
def process_zalo_bot_webhook_task(bot_id: str, payload: dict):
    """Celery task to process Zalo Bot messages asynchronously."""
    logger.info(f"Processing Zalo Bot message for bot: {bot_id}")
    service = get_zalo_bot_service()
    try:
        return asyncio.run(service.handle_webhook(bot_id, payload))
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(service.handle_webhook(bot_id, payload))
```

---

## 🗓️ Implementation Schedule

### Day 1: Backend (~4-5 hours)
- [ ] Tạo `zalo_bot_service.py` — copy pattern từ `zalo-bot` repo
- [ ] Tạo `zalo_bot.py` endpoints — webhook + connect + disconnect + status
- [ ] Tạo `zalo_bot_tasks.py` — Celery task
- [ ] Update `api.py` — register router
- [ ] Update `config.py` — thêm `PUBLIC_URL` env var
- [ ] Test connect flow + webhook

### Day 2: Frontend (~4-5 hours)
- [ ] Redesign Channels tab — Zalo Bot section mới
- [ ] Token input + Connect button
- [ ] Connected state: bot info + webhook URL + toggle active
- [ ] Disconnect button
- [ ] In-app step guide (tạo bot ở đâu, lấy token thế nào)

### Day 3: Testing + Polish (~2-3 hours)
- [ ] End-to-end test: Zalo message → webhook → RAG → reply
- [ ] Error handling UX
- [ ] Update docs

---

## 🆚 So sánh: Flow cũ (Func.vn Hub) vs Flow mới (Zalo Bot Direct)

| | Cũ (Func.vn Hub) | Mới (Zalo Bot Direct) |
|--|---|---|
| User effort | Nhiều bước + Func.vn | **Paste token → Done** |
| Middleware | Func.vn | **Không cần** |
| setWebhook | ❌ Manual | **✅ Auto** |
| Token refresh | N/A | **Không cần** (bot token permanent) |
| Verify webhook | Không có | **✅ secret_token header** |
| API style | Custom Func.vn | **Giống Telegram** |
| Phức tạp | 🔴 Cao | **🟢 Thấp** |
