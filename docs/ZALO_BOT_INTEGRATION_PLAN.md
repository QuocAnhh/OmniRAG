# Zalo Bot Platform Integration

File này giữ nguyên path cũ để tránh link gãy, nhưng nội dung đã chuyển từ implementation checklist sang guide hiện trạng. Snapshot này chỉ document Zalo Bot Platform hiện có, không document Zalo Personal/ZCA.

## Trạng thái hiện tại

| Capability | Status |
| --- | --- |
| Connect bot bằng Zalo Bot token | Supported |
| Verify token qua `getMe` | Supported |
| Tự đăng ký webhook qua `setWebhook` | Supported |
| Secret header `x-bot-api-secret-token` | Supported |
| Nhận text message webhook | Supported |
| Typing indicator | Supported |
| Trả lời bằng RAG pipeline | Supported |
| Lưu config trong `bot.config.zalo_bot` | Supported |
| Zalo Personal/ZCA | Pending/future, không thuộc snapshot này |

## Backend routes

Tất cả route nằm dưới prefix `/api/v1/channels/zalo-bot`.

| Method | Path | Auth | Mô tả |
| --- | --- | --- | --- |
| `POST` | `/connect` | Bearer token | Kết nối Zalo Bot vào OmniRAG bot |
| `POST` | `/disconnect/{bot_id}` | Bearer token | Ngắt kết nối |
| `GET` | `/status/{bot_id}` | Bearer token | Xem trạng thái |
| `POST` | `/webhook/{bot_id}` | Public + secret header | Webhook inbound từ Zalo |

Zalo Hub legacy route khác:

```text
POST /api/v1/channels/zalo/hub-webhook
```

## Connect flow

1. User tạo OmniRAG bot.
2. User lấy Bot Token từ Zalo Bot Platform.
3. Frontend/backend gọi:

```http
POST /api/v1/channels/zalo-bot/connect
Authorization: Bearer <access_token>
Content-Type: application/json
```

Body:

```json
{
  "bot_id": "uuid",
  "bot_token": "zalo-bot-token"
}
```

4. Backend yêu cầu `PUBLIC_URL` để build webhook URL public:

```text
{PUBLIC_URL}/api/v1/channels/zalo-bot/webhook/{bot_id}
```

5. Service gọi Zalo Bot API:

```text
POST https://bot-api.zapps.me/bot{bot_token}/getMe
POST https://bot-api.zapps.me/bot{bot_token}/setWebhook
```

6. Backend lưu vào `bot.config.zalo_bot`:

```json
{
  "bot_token": "...",
  "bot_info": {},
  "webhook_url": "https://public.example.com/api/v1/channels/zalo-bot/webhook/<bot_id>",
  "webhook_secret": "...",
  "is_active": true,
  "connected_at": "2026-05-28T00:00:00"
}
```

## Webhook flow

Zalo gọi:

```http
POST /api/v1/channels/zalo-bot/webhook/{bot_id}
x-bot-api-secret-token: <webhook_secret>
Content-Type: application/json
```

Payload text tối thiểu:

```json
{
  "message": {
    "chat": { "id": "chat_id" },
    "text": "Câu hỏi của user"
  }
}
```

Backend:

1. Load bot theo `bot_id`.
2. So sánh secret header bằng constant-time comparison.
3. Tạo background task xử lý message.
4. Gọi RAG service với `session_id=zalo_bot_{chat_id}` và `user_id=zalo_{chat_id}`.
5. Gửi typing action rồi gửi reply qua `sendMessage`.

Webhook response trả nhanh:

```json
{ "status": "received" }
```

## Env cần có

```env
PUBLIC_URL=https://your-public-domain.example.com
OPENROUTER_API_KEY=sk-or-v1-your-key
```

`PUBLIC_URL` phải là HTTPS public URL mà Zalo có thể gọi được. Khi dev local có thể dùng tunnel, nhưng không commit URL tunnel vào repo.

## Debug

Kiểm tra status:

```bash
curl http://localhost:8080/api/v1/channels/zalo-bot/status/<bot_id> \
  -H "Authorization: Bearer <access_token>"
```

Log backend:

```bash
docker compose logs -f backend
```

Lỗi thường gặp:

- `PUBLIC_URL is not configured`: set `PUBLIC_URL` trong `backend/.env` hoặc env deploy.
- `Invalid secret token`: webhook secret trên Zalo không khớp config đã lưu.
- Zalo gọi webhook nhưng bot không reply: kiểm tra `OPENROUTER_API_KEY`, bot active, log RAG và network tới `bot-api.zapps.me`.
- Upload tài liệu chưa index: kiểm tra Celery worker, không phải Zalo service.

## Không thuộc snapshot này

Zalo Personal/ZCA, login QR/cookie và personal account messaging không nằm trong branch `refactor/backend-perf-p1-observability`. Nếu PR Zalo Personal được merge sau này, cần tạo guide riêng hoặc cập nhật file này với section phân biệt rõ Zalo Bot Platform và Zalo Personal.
