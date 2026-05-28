# Quick Start

Hướng dẫn này giúp dev chạy nhanh snapshot `refactor/backend-perf-p1-observability` bằng Docker Compose. Gateway là entrypoint chính tại `http://localhost:8080`.

## 1. Chuẩn bị

Yêu cầu:

- Docker và Docker Compose.
- Node.js nếu muốn chạy frontend ngoài Docker.
- Python 3.11+ nếu muốn chạy backend ngoài Docker.
- OpenRouter/OpenAI key cho RAG.

Nhánh này không có `backend/.env.example`, vì vậy tạo `backend/.env` thủ công:

```bash
cd backend
touch .env
```

Ví dụ tối thiểu:

```env
SECRET_KEY=change-me
OPENROUTER_API_KEY=sk-or-v1-your-key
OPENAI_API_KEY=sk-your-openai-key
SQLALCHEMY_DATABASE_URI=postgresql://postgres:password@db:5432/omnirag
MONGODB_URL=mongodb://admin:password@mongodb:27017
REDIS_URL=redis://redis:6379/0
QDRANT_URL=http://qdrant:6333
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

## 2. Chạy toàn bộ stack

Từ root repo:

```bash
docker compose up -d --build
```

Kiểm tra container:

```bash
docker compose ps
```

## 3. URL cần nhớ

| Mục đích | URL |
| --- | --- |
| Frontend | `http://localhost:5173` |
| Gateway | `http://localhost:8080` |
| API base qua gateway | `http://localhost:8080/api/v1` |
| Swagger qua gateway | `http://localhost:8080/docs` |
| Backend direct khi chạy Docker | `http://localhost:8001` |
| Backend local uvicorn | `http://localhost:8000` |
| MinIO Console | `http://localhost:9001` |
| Qdrant | `http://localhost:6333` |

Trong Docker, backend expose nội bộ `8000`, nhưng host port là `8001:8000`. Khi gọi từ máy host, dùng `http://localhost:8001` nếu muốn bypass gateway.

## 4. Tạo user và đăng nhập

Gọi qua gateway:

```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@example.com","password":"password123","full_name":"Dev","tenant_name":"Dev Tenant"}'
```

Đăng nhập:

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=dev@example.com&password=password123"
```

Lấy `access_token` trả về và gửi header:

```http
Authorization: Bearer <access_token>
```

## 5. Tạo bot và upload tài liệu

Tạo bot:

```bash
curl -X POST http://localhost:8080/api/v1/bots/ \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo Bot","description":"Bot test nhanh","config":{"system_prompt":"Trả lời bằng tiếng Việt.","model":"openai/gpt-4o-mini"}}'
```

Upload tài liệu:

```bash
curl -X POST http://localhost:8080/api/v1/bots/<bot_id>/documents \
  -H "Authorization: Bearer <access_token>" \
  -F "file=@/path/to/document.pdf" \
  -F "chunking_strategy=recursive" \
  -F "enable_knowledge_graph=false"
```

Ingestion chạy bất đồng bộ qua Celery. Theo dõi log:

```bash
docker compose logs -f celery_worker
```

## 6. Chat

```bash
curl -X POST http://localhost:8080/api/v1/bots/<bot_id>/chat \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"message":"Tóm tắt tài liệu vừa upload","session_id":"demo"}'
```

Streaming:

```bash
curl -N -X POST http://localhost:8080/api/v1/bots/<bot_id>/chat-stream \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"message":"Trả lời dạng streaming","session_id":"demo"}'
```

## 7. Frontend routes chính

- `/dashboard`
- `/bots`
- `/bots/new`
- `/bots/:id/edit`
- `/bots/:id/config`
- `/bots/:id/chat`
- `/bots/:id/graph`
- `/settings`
- `/docs/zalo-bot`

Lưu ý: route UI Knowledge Graph là `/bots/:id/graph`; API backend tương ứng là `/api/v1/bots/{bot_id}/knowledge-graph`.

## 8. Khi gặp lỗi

Xem [Troubleshooting](TROUBLESHOOTING.md) cho các lỗi thường gặp về port, env, migration, Redis, MinIO, Qdrant, OpenRouter và webhook channels.
