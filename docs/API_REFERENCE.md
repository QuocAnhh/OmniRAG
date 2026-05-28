# API Reference

API reference này được đối chiếu với router hiện có trong `backend/app/api/v1/endpoints` trên snapshot hiện tại của `refactor/backend-perf-p1-observability`.

## Base URL

| Môi trường | Base URL |
| --- | --- |
| Docker qua gateway | `http://localhost:8080/api/v1` |
| Docker direct backend | `http://localhost:8001/api/v1` |
| Local uvicorn | `http://localhost:8000/api/v1` |

Frontend mặc định gọi qua gateway. Gateway proxy tới backend nội bộ `http://backend:8000`.

## Auth

Các endpoint protected dùng:

```http
Authorization: Bearer <access_token>
```

### Register

```http
POST /auth/register
Content-Type: application/json
```

Body:

```json
{
  "email": "dev@example.com",
  "password": "password123",
  "full_name": "Dev User",
  "tenant_name": "Dev Tenant"
}
```

### Login

```http
POST /auth/login
Content-Type: application/x-www-form-urlencoded
```

Body form:

```text
username=dev@example.com&password=password123
```

### Current auth user

```http
GET /auth/me
```

## Tenant

| Method | Path | Mô tả |
| --- | --- | --- |
| `GET` | `/tenants/me` | Lấy tenant hiện tại |
| `PUT` | `/tenants/me` | Cập nhật tenant hiện tại |

## Users và API Keys

Snapshot này không có admin CRUD `/users`. User API hiện tại chỉ thao tác với chính user đang đăng nhập.

| Method | Path | Mô tả |
| --- | --- | --- |
| `GET` | `/users/me` | Lấy profile user hiện tại |
| `PUT` | `/users/me` | Cập nhật profile user hiện tại |
| `GET` | `/users/me/api-keys` | Liệt kê API keys |
| `POST` | `/users/me/api-keys` | Tạo API key |
| `DELETE` | `/users/me/api-keys/{key_id}` | Xóa API key |
| `PATCH` | `/users/me/api-keys/{key_id}/toggle` | Bật/tắt API key |

## Bots

| Method | Path | Mô tả |
| --- | --- | --- |
| `GET` | `/bots/` | Liệt kê bots của tenant |
| `POST` | `/bots/` | Tạo bot |
| `GET` | `/bots/{bot_id}` | Lấy chi tiết bot |
| `PUT` | `/bots/{bot_id}` | Cập nhật bot |
| `DELETE` | `/bots/{bot_id}` | Xóa bot |
| `POST` | `/bots/generate-prompt` | Gợi ý system prompt |

Ví dụ tạo bot:

```json
{
  "name": "Support Bot",
  "description": "Bot hỗ trợ nội bộ",
  "config": {
    "system_prompt": "Trả lời ngắn gọn bằng tiếng Việt.",
    "model": "openai/gpt-4o-mini",
    "chunking_strategy": "recursive"
  }
}
```

`chunking_strategy` hiện hỗ trợ:

- `recursive`
- `sentence`
- `article`
- `parent_child`
- `semantic`

## Bot Documents

| Method | Path | Mô tả |
| --- | --- | --- |
| `POST` | `/bots/{bot_id}/documents` | Upload một tài liệu |
| `GET` | `/bots/{bot_id}/documents` | Liệt kê tài liệu của bot |
| `DELETE` | `/bots/{bot_id}/documents/{doc_id}` | Xóa tài liệu |

Upload dùng `multipart/form-data`:

```bash
curl -X POST http://localhost:8080/api/v1/bots/<bot_id>/documents \
  -H "Authorization: Bearer <access_token>" \
  -F "file=@/path/to/file.pdf" \
  -F "chunking_strategy=recursive" \
  -F "enable_knowledge_graph=false"
```

Ingestion chạy qua Celery worker. Backend hiện chưa có endpoint public để update metadata tài liệu hoặc preview file:

- Không có `PUT /bots/{bot_id}/documents/{doc_id}`.
- Không có `/documents/{doc_id}/preview`.

Nếu frontend gọi các client này, xem đó là known gap của snapshot.

## Chat, Retrieval và Memory

| Method | Path | Mô tả |
| --- | --- | --- |
| `POST` | `/bots/{bot_id}/chat` | Chat non-streaming |
| `POST` | `/bots/{bot_id}/chat-stream` | Chat streaming |
| `GET` | `/bots/{bot_id}/history` | Lấy lịch sử hội thoại |
| `GET` | `/bots/{bot_id}/sessions` | Liệt kê sessions |
| `DELETE` | `/bots/{bot_id}/sessions/{session_id}` | Xóa một session |
| `DELETE` | `/bots/{bot_id}/history` | Xóa lịch sử |
| `GET` | `/bots/{bot_id}/memory` | Lấy memory |
| `DELETE` | `/bots/{bot_id}/memory` | Xóa memory |
| `POST` | `/bots/{bot_id}/retrieve` | Test retrieval |
| `GET` | `/bots/{bot_id}/debug-retrieval` | Debug retrieval |
| `POST` | `/bots/{bot_id}/chat/{message_id}/feedback` | Gửi feedback |

Ví dụ chat:

```json
{
  "message": "Tóm tắt chính sách trong tài liệu",
  "session_id": "support-session"
}
```

Gateway không cache `POST /chat`. Cache chat/RAG được xử lý trong backend service.

## Knowledge Graph

| Method | Path | Mô tả |
| --- | --- | --- |
| `GET` | `/bots/{bot_id}/knowledge-graph` | Lấy graph nodes/edges của bot |

Frontend route là `/bots/:id/graph`, không phải `/bots/:id/knowledge-graph`.

## Bot Templates

| Method | Path | Mô tả |
| --- | --- | --- |
| `GET` | `/bot-templates/` | Liệt kê templates |
| `GET` | `/bot-templates/domains/{domain}` | Liệt kê templates theo domain |
| `GET` | `/bot-templates/{template_id}` | Lấy chi tiết template |
| `POST` | `/bot-templates/create-from-template` | Tạo bot từ template |

Không có route `/bot-templates/{id}/apply` trong snapshot này.

## Folders

| Method | Path | Mô tả |
| --- | --- | --- |
| `POST` | `/folders/` | Tạo folder |
| `GET` | `/folders/` | Liệt kê folders |
| `PUT` | `/folders/{folder_id}` | Cập nhật folder |
| `DELETE` | `/folders/{folder_id}` | Xóa folder |

## Dashboard

| Method | Path | Mô tả |
| --- | --- | --- |
| `GET` | `/dashboard/stats` | Tổng quan dashboard |
| `GET` | `/dashboard/activity` | Hoạt động gần đây |
| `GET` | `/dashboard/quick-stats` | Quick stats cho UI |

## Analytics

| Method | Path | Mô tả |
| --- | --- | --- |
| `GET` | `/analytics/stats` | Tổng quan analytics |
| `GET` | `/analytics/conversations` | Thống kê conversations |
| `GET` | `/analytics/messages-over-time` | Messages theo thời gian |
| `GET` | `/analytics/bot-usage` | Usage theo bot |
| `GET` | `/analytics/top-queries` | Query phổ biến |
| `GET` | `/analytics/response-time-distribution` | Phân bố thời gian phản hồi |

Các endpoint analytics thường nhận query params theo thời gian/bot tùy implementation. Kiểm tra Swagger để xem schema chi tiết.

## Integrations

| Method | Path | Mô tả |
| --- | --- | --- |
| `GET` | `/integrations/` | Liệt kê integrations |
| `POST` | `/integrations/` | Tạo integration |
| `GET` | `/integrations/{integration_id}` | Lấy chi tiết integration |
| `PUT` | `/integrations/{integration_id}` | Cập nhật integration |
| `DELETE` | `/integrations/{integration_id}` | Xóa integration |
| `POST` | `/integrations/{integration_id}/test` | Test integration |

Integrations lưu cấu hình kênh/provider ở backend. Webhook channel cụ thể nằm dưới nhóm `/channels/*`.

## Channels

### Zalo Hub

| Method | Path | Mô tả |
| --- | --- | --- |
| `POST` | `/channels/zalo/hub-webhook` | Nhận webhook Zalo hub |

### Zalo Bot Platform

| Method | Path | Mô tả |
| --- | --- | --- |
| `POST` | `/channels/zalo-bot/webhook/{bot_id}` | Webhook inbound cho một bot |
| `POST` | `/channels/zalo-bot/connect` | Kết nối cấu hình Zalo Bot |
| `POST` | `/channels/zalo-bot/disconnect/{bot_id}` | Ngắt kết nối |
| `GET` | `/channels/zalo-bot/status/{bot_id}` | Trạng thái kết nối |

### Zalo Personal

Zalo Personal dùng worker nội bộ `zalo-personal-worker:9200`, mặc định tắt nếu `ZALO_PERSONAL_ENABLED=false`. Frontend/backend gọi các route backend dưới đây; worker route chỉ dành cho backend gọi trong Docker network.

| Method | Path | Mô tả |
| --- | --- | --- |
| `GET` | `/channels/zalo-personal/bots/{bot_id}/accounts` | Liệt kê accounts của bot |
| `POST` | `/channels/zalo-personal/bots/{bot_id}/accounts` | Tạo account và start QR login |
| `GET` | `/channels/zalo-personal/accounts/{account_id}` | Lấy cấu hình một account |
| `PUT` | `/channels/zalo-personal/accounts/{account_id}` | Cập nhật reply policy/thread whitelist |
| `DELETE` | `/channels/zalo-personal/accounts/{account_id}` | Xóa account và unload worker session |
| `GET` | `/channels/zalo-personal/accounts/{account_id}/login-status` | Poll QR login status theo account |
| `GET` | `/channels/zalo-personal/accounts/{account_id}/status` | Trạng thái saved config + worker runtime |
| `GET` | `/channels/zalo-personal/accounts/{account_id}/access` | Liệt kê access grants |
| `POST` | `/channels/zalo-personal/accounts/{account_id}/access` | Grant user access |
| `DELETE` | `/channels/zalo-personal/accounts/{account_id}/access/{access_id}` | Revoke access grant |
| `POST` | `/channels/zalo-personal/connect/start` | Legacy single-account QR login |
| `GET` | `/channels/zalo-personal/login-status/{bot_id}` | Legacy poll login status |
| `GET` | `/channels/zalo-personal/status/{bot_id}` | Legacy status |
| `POST` | `/channels/zalo-personal/disconnect/{bot_id}` | Legacy disconnect |
| `POST` | `/channels/zalo-personal/inbound/{bot_id}` | HMAC-protected worker webhook |

Tạo account:

```json
{
  "channel_type": "zalo_personal",
  "reply_policy": "mention_only",
  "thread_whitelist": []
}
```

### Facebook Messenger

| Method | Path | Mô tả |
| --- | --- | --- |
| `POST` | `/channels/facebook/inbound/{bot_id}` | HMAC-protected worker webhook |
| `POST` | `/channels/facebook/connect` | Kết nối Messenger worker bằng cookies |
| `POST` | `/channels/facebook/disconnect/{bot_id}` | Ngắt kết nối |
| `GET` | `/channels/facebook/status/{bot_id}` | Trạng thái kết nối |

## OpenRouter Utilities

| Method | Path | Mô tả |
| --- | --- | --- |
| `GET` | `/openrouter/test` | Kiểm tra cấu hình provider |
| `POST` | `/openrouter/chat` | Gọi chat completion test |
| `POST` | `/openrouter/embeddings` | Gọi embeddings test |
| `POST` | `/openrouter/rag/ingest` | Test ingest RAG |
| `POST` | `/openrouter/rag/chat` | Test RAG chat |
| `GET` | `/openrouter/models/chat` | Liệt kê chat models |
| `GET` | `/openrouter/models/embeddings` | Liệt kê embedding models |

## Health, Docs và Metrics

Các route ngoài prefix `/api/v1` có thể được expose bởi backend/gateway:

| URL | Mô tả |
| --- | --- |
| `/health` | Health check service |
| `/docs` | Swagger UI |
| `/openapi.json` | OpenAPI schema |
| `/metrics` | Prometheus metrics nếu bật |

Qua Docker gateway, dùng `http://localhost:8080/docs` hoặc `http://localhost:8080/metrics`.
