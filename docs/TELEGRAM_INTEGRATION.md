# Telegram Bot Integration

OmniRAG hỗ trợ tích hợp Telegram Bot trực tiếp qua Telegram Bot API + aiogram 3. Mỗi OmniRAG bot có thể kết nối với một Telegram Bot riêng, nhận tin nhắn qua webhook và tự động trả lời bằng RAG pipeline.

Pattern tích hợp này mirror chính xác Zalo Bot Platform integration — Telegram Bot API gần như tương đương Zalo Bot API về mặt kiến trúc.

---

## Trạng thái hiện tại

| Capability | Status | Notes |
|------------|--------|-------|
| Connect bot bằng Bot Token | Supported | Gọi `getMe` + `setWebhook` tự động |
| Secret token header (`X-Telegram-Bot-Api-Secret-Token`) | Supported | HMAC constant-time comparison |
| Nhận text message | Supported | Qua RAG pipeline đầy đủ |
| Nhận ảnh (photo) | Supported | Vision model mô tả ảnh → RAG pipeline |
| Nhận document (PDF, DOCX, TXT…) | Supported | Download + trích text + upload MinIO → RAG |
| Nhận voice message | Not yet | Trả về thông báo "chưa hỗ trợ" |
| Typing indicator | Supported | `sendChatAction` trước khi reply |
| Command `/start` | Supported | Gửi welcome message |
| Command `/help` | Supported | Gửi hướng dẫn sử dụng |
| Lưu config trong `bot.config.telegram` | Supported | JSONB trên PostgreSQL |
| Multiple bots per tenant | Supported | Mỗi OmniRAG bot có Telegram token riêng |
| Memory xuyên session | Supported | `user_id = tg_{chat_id}`, Mem0 enabled |

---

## Kiến trúc

```
Người dùng Telegram
  |
  | Gửi tin nhắn qua Telegram App
  v
Telegram Bot API
  |
  | POST webhook (có secret token header)
  v
FastAPI Backend  (/api/v1/channels/telegram/webhook/{bot_id})
  |
  | Verify X-Telegram-Bot-Api-Secret-Token
  | Parse Update (aiogram Update.model_validate)
  | Route theo content type: text / photo / document / voice
  v
TelegramBotService
  |
  ├── Text: query → RAG pipeline → answer
  ├── Photo: download → vision model describe → RAG pipeline → answer
  ├── Document: download → extract text → upload MinIO → RAG pipeline → answer
  └── Voice: trả về "chưa hỗ trợ"
  |
  | sendChatAction (typing) + sendMessage (HTML)
  v
aiogram Bot instance
  |
  v
Telegram Bot API → Người dùng Telegram
```

Backend không dùng aiogram Dispatcher. Tất cả routing được làm thủ công trong `TelegramBotService.handle_webhook()` để giữ control flow đơn giản và mirror pattern Zalo Bot.

---

## Backend routes

Tất cả route nằm dưới prefix `/api/v1/channels/telegram`.

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| `POST` | `/webhook/{bot_id}` | Public + secret token header | Webhook inbound từ Telegram |
| `POST` | `/connect` | Bearer token | Kết nối Telegram Bot vào OmniRAG bot |
| `POST` | `/disconnect/{bot_id}` | Bearer token | Ngắt kết nối, xoá webhook |
| `GET` | `/status/{bot_id}` | Bearer token | Xem trạng thái kết nối |

---

## Connect flow

### 1. Tạo Telegram Bot với @BotFather

1. Mở Telegram, tìm **@BotFather**
2. Gửi lệnh `/newbot`
3. Đặt tên cho bot (VD: "My OmniRAG Assistant")
4. Đặt username cho bot (phải kết thúc bằng `bot`, VD: `my_omnirag_bot`)
5. @BotFather trả về **Bot Token** (dạng `1234567890:ABCdefGHIJklmNOPqrstUVwxyz`)

### 2. Kết nối trong OmniRAG UI

1. Vào **Bot Config Page** → Tab **Channels**
2. Tìm section **Telegram Bot**
3. Paste Bot Token từ @BotFather
4. Click **Connect Telegram Bot**

### 3. Backend xử lý connect

```http
POST /api/v1/channels/telegram/connect
Authorization: Bearer <access_token>
Content-Type: application/json
```

Body:
```json
{
  "bot_id": "uuid-của-omnirag-bot",
  "bot_token": "1234567890:ABCdefGHIJklmNOPqrstUVwxyz"
}
```

Backend thực hiện tuần tự:
1. **`getMe`** — Xác thực token, lấy `bot_info` (username, first_name, id…)
2. **Generate secret** — Tạo `webhook_secret` = `secrets.token_urlsafe(24)` để bảo vệ webhook
3. **`setWebhook`** — Đăng ký webhook URL lên Telegram:
   ```
   {PUBLIC_URL}/api/v1/channels/telegram/webhook/{bot_id}
   ```
   Với params: `secret_token`, `allowed_updates=["message"]`, `drop_pending_updates=True`, `max_connections=40`
4. **Save config** — Lưu toàn bộ config vào `bot.config.telegram` (JSONB)

### Config lưu trong `bot.config.telegram`

```json
{
  "bot_token": "1234567890:ABCdefGHI...",
  "bot_username": "@my_omnirag_bot",
  "bot_info": {
    "id": 1234567890,
    "is_bot": true,
    "first_name": "My OmniRAG Assistant",
    "username": "my_omnirag_bot",
    "can_join_groups": true,
    "can_read_all_group_messages": false,
    "supports_inline_queries": false
  },
  "webhook_url": "https://yourdomain.com/api/v1/channels/telegram/webhook/uuid",
  "webhook_secret": "base64url-encoded-24-byte-secret",
  "is_active": true,
  "connected_at": "2026-05-31T12:00:00.000Z"
}
```

---

## Webhook flow (nhận tin nhắn)

### 1. Telegram gửi update

```
POST https://yourdomain.com/api/v1/channels/telegram/webhook/{bot_id}
X-Telegram-Bot-Api-Secret-Token: <webhook_secret>
Content-Type: application/json

{
  "update_id": 123456789,
  "message": {
    "message_id": 100,
    "from": { "id": 987654321, "first_name": "Nguyen", ... },
    "chat": { "id": 987654321, "type": "private", ... },
    "date": 1717000000,
    "text": "Xin chào, cho tôi hỏi về..."
  }
}
```

### 2. Backend xử lý

```
1. Load bot từ DB, kiểm tra is_active
2. Verify secret token bằng hmac.compare_digest (constant-time)
3. Parse Update = aiogram Update.model_validate(payload)
4. Extract message, chat_id, message_id
5. Dispatch background task: asyncio.create_task(service.handle_webhook(...))
6. Return 200 {"status": "received"} ngay lập tức (không chờ reply)
```

### 3. Xử lý tin nhắn (background task)

#### Text message
```
message.text → RAG pipeline:
  - embed(query) + rewrite(query) + memory_search (concurrent)
  - hybrid_search + lightRAG
  - CRAG classify → context assembly
  - Answer synthesis
→ sendMessage(chat_id, response) qua aiogram Bot
```

Session được duy trì qua `user_id = tg_{chat_id}` và `session_id = tg_{chat_id}` — tức mỗi Telegram chat là một session riêng với memory đầy đủ.

#### Photo (ảnh)
```
1. Lấy photo[-1] (kích thước lớn nhất)
2. Download file qua aiogram Bot.get_file() + Bot.download_file()
3. Encode base64 → data:image/jpeg;base64,...
4. Gọi OpenRouter vision model (gpt-4o-mini) để mô tả ảnh (2-3 câu, tiếng Việt)
5. Feed description + caption vào RAG pipeline
6. Trả lời
```

#### Document (file)
```
1. Kiểm tra file_size ≤ 20MB (Telegram limit)
2. Download file qua aiogram
3. Upload lên MinIO (object_name = "telegram/{bot_id}/{uuid}/{file_name}")
4. Nếu là text/* thì trích preview 2000 bytes
5. Feed context (file_name + mime_type + size + preview) vào RAG pipeline
6. Trả lời
```

#### Voice
```
Trả về: "Voice messages are not yet supported. Please send text or a document."
```

#### Commands
| Command | Hành vi |
|---------|---------|
| `/start` | Gửi welcome message (từ `bot.config.welcome_message` hoặc default) |
| `/help` | Gửi hướng dẫn: "Send me a question and I'll answer using the knowledge base..." |

---

## Disconnect flow

```http
POST /api/v1/channels/telegram/disconnect/{bot_id}
Authorization: Bearer <access_token>
```

Backend thực hiện:
1. **`deleteWebhook`** — Xoá webhook trên Telegram (`drop_pending_updates=True`)
2. **Close session** — Đóng aiogram Bot session, xoá khỏi cache
3. **Remove config** — Xoá key `telegram` khỏi `bot.config`

---

## Status check

```http
GET /api/v1/channels/telegram/status/{bot_id}
Authorization: Bearer <access_token>
```

Response:
```json
{
  "is_connected": true,
  "is_active": true,
  "bot_info": { "id": 1234567890, "username": "my_bot", ... },
  "bot_username": "@my_omnirag_bot",
  "webhook_url": "https://yourdomain.com/api/v1/channels/telegram/webhook/uuid",
  "connected_at": "2026-05-31T12:00:00.000Z"
}
```

---

## Cấu hình Environment

Các biến môi trường trong `backend/.env`:

| Variable | Required | Default | Mô tả |
|----------|----------|---------|-------|
| `PUBLIC_URL` | **CÓ** | `""` | Public URL của backend (VD: `https://yourdomain.com`). Dùng để tạo webhook URL. **Không có PUBLIC_URL thì không connect được.** |
| `TELEGRAM_BOT_TOKEN` | Không | `""` | Default bot token (optional). Thực tế mỗi bot dùng token riêng lưu trong `bot.config.telegram`. |
| `TELEGRAM_WEBHOOK_SECRET` | Không | `""` | Fallback webhook secret (optional). Mỗi bot tự generate secret riêng khi connect. |

### Yêu cầu network

- Backend server phải có **public URL** (HTTPS) — Telegram chỉ gửi webhook đến URL public, có certificate hợp lệ
- Nếu chạy local dev, dùng **ngrok** hoặc **Cloudflare Tunnel** để expose backend:
  ```bash
  ngrok http 8000
  # PUBLIC_URL = "https://xxxx.ngrok-free.app"
  ```

---

## Dependencies

```
# backend/requirements.txt
aiogram>=3.0,<4.0
```

aiogram 3 được dùng để:
- Tạo `Bot` instance với token + default properties (HTML parse mode)
- Gọi Telegram Bot API methods: `getMe`, `setWebhook`, `deleteWebhook`, `sendMessage`, `sendChatAction`, `getFile`, `downloadFile`
- Parse webhook payload: `Update.model_validate(payload)`

**Lưu ý:** Không dùng aiogram Dispatcher/Router. Tất cả routing message được làm thủ công trong `TelegramBotService` để đồng bộ pattern với Zalo Bot integration.

---

## Code structure

```
backend/app/
├── api/v1/endpoints/channels/
│   └── telegram.py                    # Route handlers (webhook, connect, disconnect, status)
├── services/channels/
│   └── telegram_service.py            # TelegramBotService — toàn bộ business logic
├── models/
│   └── channel_account.py             # ChannelAccount ORM model (dùng chung cho Zalo/Telegram)
├── schemas/
│   └── channel_account.py             # Pydantic schemas
└── core/
    └── config.py                      # PUBLIC_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET

frontend/src/
├── pages/
│   └── BotConfigPage.tsx              # Channels tab → Telegram Bot section
└── api/
    └── channelAccounts.ts             # API client (Telegram dùng apiClient trực tiếp)
```

### File chính: `backend/app/services/channels/telegram_service.py`

```python
class TelegramBotService:
    def __init__(self):
        self.rag_service = get_openrouter_rag_service()
        self._bot_cache: dict[str, Bot] = {}  # bot_token -> aiogram Bot

    # Telegram Bot API Helpers
    async def get_me(bot_token) -> dict
    async def set_webhook(bot_token, webhook_url, secret_token) -> bool
    async def delete_webhook(bot_token) -> bool
    async def send_message(bot_token, chat_id, text) -> dict
    async def send_chat_action(bot_token, chat_id, action) -> None

    # Connection lifecycle
    async def connect(bot_id, bot_token, webhook_base_url) -> dict
    async def disconnect(bot_token) -> None

    # Webhook handler
    async def handle_webhook(bot_id, payload) -> dict
        ├── _handle_text(message, bot, bot_token, chat_id) -> dict
        ├── _handle_photo(message, bot, bot_token, chat_id) -> dict
        ├── _handle_document(message, bot, bot_token, chat_id) -> dict
        └── _handle_voice(message, bot_token, chat_id) -> dict

# Singleton
get_telegram_bot_service() -> TelegramBotService
```

### File chính: `backend/app/api/v1/endpoints/channels/telegram.py`

```python
router = APIRouter()

POST /webhook/{bot_id}       # Public — Telegram webhook inbound
POST /connect                # Auth required — Kết nối bot
POST /disconnect/{bot_id}    # Auth required — Ngắt kết nối
GET  /status/{bot_id}        # Auth required — Trạng thái
```

---

## Bảo mật

### Webhook secret verification

Mỗi webhook request từ Telegram được bảo vệ bởi 2 layer:

1. **Secret token trong header** — `X-Telegram-Bot-Api-Secret-Token` được set khi gọi `setWebhook`. Backend verify bằng `hmac.compare_digest()` (constant-time comparison) để tránh timing attack.

2. **Unique URL mỗi bot** — `webhook/{bot_id}` — mỗi bot có URL webhook riêng, khó đoán.

### Token storage

- Bot token được lưu trong `bot.config.telegram` (PostgreSQL JSONB column)
- **Không log token** — logging chỉ ghi bot_id và username, không ghi token
- Token chỉ truyền qua HTTPS giữa backend và Telegram API

### Session isolation

- Mỗi Telegram user được isolate qua `user_id = tg_{chat_id}`
- Memory service (Mem0) hoạt động độc lập theo user_id
- Không user Telegram nào thấy được memory của user khác

---

## So sánh với Zalo Bot Integration

| Khía cạnh | Telegram | Zalo Bot |
|-----------|----------|----------|
| Library | aiogram 3.x | httpx (direct API) |
| Webhook secret header | `X-Telegram-Bot-Api-Secret-Token` | `x-bot-api-secret-token` |
| Parse mode | HTML | (plain text) |
| Photo handling | Vision model describe → RAG | Chưa hỗ trợ |
| Document handling | Download + MinIO + RAG | Chưa hỗ trợ |
| Bot cache | `_bot_cache: dict[str, Bot]` | Không cache |
| Dispatcher | Không dùng (manual routing) | Không dùng (manual routing) |
| Config path | `bot.config.telegram` | `bot.config.zalo_bot` |

---

## Troubleshooting

### "PUBLIC_URL is not configured"

**Nguyên nhân:** Thiếu biến `PUBLIC_URL` trong `backend/.env`.

**Fix:** Thêm `PUBLIC_URL=https://yourdomain.com` vào `.env`. Nếu đang dev local, dùng ngrok:
```bash
ngrok http 8000
# Copy HTTPS URL từ ngrok, set PUBLIC_URL=https://xxxx.ngrok-free.app
```

### Webhook không nhận được tin nhắn

1. Kiểm tra webhook status trên Telegram:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
   ```
   Response sẽ cho biết `url`, `last_error_date`, `last_error_message`, `pending_update_count`.

2. Đảm bảo `PUBLIC_URL` có HTTPS (Telegram yêu cầu certificate hợp lệ).

3. Đảm bảo backend không bị firewall chặn port 443/80.

4. Kiểm tra `bot.config.telegram.is_active = true`.

### "Invalid secret token" (403)

**Nguyên nhân:** Secret token trong `X-Telegram-Bot-Api-Secret-Token` header không khớp với `webhook_secret` đã lưu.

**Fix:** Disconnect rồi reconnect lại để regenerate webhook_secret mới.

### File quá lớn (>20MB)

Telegram giới hạn file upload 20MB. Backend sẽ từ chối và trả về thông báo:
> "File too large (XX.X MB). Telegram limit is 20 MB."

### Voice message không được hỗ trợ

Hiện tại voice message chưa được implement. Bot sẽ trả về:
> "Voice messages are not yet supported. Please send text or a document."

---

## Migration

Migration cho `channel_accounts` table được tạo tự động qua Alembic:

```bash
cd backend
alembic upgrade head
```

File migration: `backend/alembic/versions/a1b2c3d4_add_channel_accounts.py`

Table `channel_accounts` được dùng chung cho Zalo Personal, Facebook Messenger, và có thể mở rộng cho Telegram sau này. Hiện tại Telegram lưu config trực tiếp trong `bot.config.telegram` (JSONB).

---

## Hạn chế hiện tại

1. **Không hỗ trợ voice message** — Sẽ trả về thông báo "chưa hỗ trợ"
2. **Không hỗ trợ inline query** — Bot chỉ hoạt động qua chat trực tiếp
3. **Không hỗ trợ group chat** — Chỉ nhận tin nhắn từ private chat (có thể mở rộng)
4. **Document chỉ trích text cơ bản** — Các file phức tạp (PDF có bảng, ảnh) chưa được xử lý qua OpenDataLoader pipeline
5. **Không retry khi gửi message thất bại** — Nếu `sendMessage` lỗi, tin nhắn bị drop
6. **Chưa dùng `channel_accounts` table** — Config lưu trực tiếp trong `bot.config.telegram` JSONB

---

## Lộ trình dự kiến

| Priority | Feature | Notes |
|----------|---------|-------|
| P1 | Hỗ trợ voice message | Speech-to-text → RAG pipeline |
| P1 | Retry + error handling cho sendMessage | Tránh mất tin nhắn khi Telegram API lỗi |
| P2 | Hỗ trợ group chat | Admin configurable reply policy |
| P2 | Inline query support | `/search` command trả kết quả inline |
| P3 | Document parsing qua OpenDataLoader | Xử lý PDF phức tạp, bảng, ảnh, formula |
| P3 | Migration sang `channel_accounts` table | Đồng bộ với Zalo Personal / Facebook Messenger |
