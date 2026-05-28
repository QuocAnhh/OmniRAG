# Troubleshooting

Các lỗi thường gặp khi chạy OmniRAG trên snapshot `refactor/backend-perf-p1-observability`.

## Không thấy `backend/.env.example`

Đúng với snapshot này. Tạo `backend/.env` thủ công và thêm các biến tối thiểu:

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

## Gọi `localhost:8000` không được khi chạy Docker

Trong Docker, backend map `8001:8000`. Dùng:

- `http://localhost:8080` cho gateway.
- `http://localhost:8080/api/v1` cho API qua gateway.
- `http://localhost:8001` nếu muốn gọi backend direct.
- `http://localhost:8000` chỉ dành cho backend chạy local bằng uvicorn.

## Swagger không mở

Thử theo thứ tự:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/docs
curl http://localhost:8001/docs
docker compose ps
docker compose logs --tail=100 backend
docker compose logs --tail=100 gateway
```

Nếu backend chưa healthy, kiểm tra database migration và env.

## Database lỗi kết nối hoặc migration

Docker compose dùng service Postgres nội bộ `db:5432`, host port `5433`.

```bash
docker compose ps db
docker compose logs --tail=100 db
docker compose exec backend alembic upgrade head
```

Khi chạy backend ngoài Docker, đổi `SQLALCHEMY_DATABASE_URI` sang `postgresql://postgres:password@localhost:5433/omnirag`.

## Redis/Celery không ingest tài liệu

Upload tài liệu chỉ tạo job, Celery worker mới xử lý parsing/chunking/indexing.

```bash
docker compose ps redis celery-worker
docker compose logs -f celery-worker
```

Trong Docker dùng `REDIS_URL=redis://redis:6379/0`. Khi chạy local, dùng `redis://localhost:6380/0`.

## MinIO upload lỗi

Kiểm tra MinIO:

```bash
curl http://localhost:9000/minio/health/live
docker compose logs --tail=100 minio
```

Console: `http://localhost:9001`.

Trong Docker backend dùng `MINIO_ENDPOINT=minio:9000`. Khi chạy backend local, dùng `MINIO_ENDPOINT=localhost:9000`.

## Qdrant hoặc Knowledge Graph không có dữ liệu

Kiểm tra Qdrant:

```bash
curl http://localhost:6333/
docker compose logs --tail=100 qdrant
```

Sau khi upload tài liệu, đợi Celery hoàn tất. Frontend Knowledge Graph nằm ở `/bots/:id/graph`; API backend là `/api/v1/bots/{bot_id}/knowledge-graph`.

## Chat/RAG trả lỗi model hoặc provider

Kiểm tra:

- `OPENROUTER_API_KEY` hoặc `OPENAI_API_KEY`.
- `LIGHTRAG_LLM_MODEL`.
- `LIGHTRAG_EMBEDDING_MODEL`.
- Log backend và Celery.

Lưu ý model mặc định trong code là `openai/gpt-5.4-nano`, nhưng Docker Compose override `LIGHTRAG_LLM_MODEL=openai/gpt-4.1-mini`.

## Gateway cache không hoạt động với chat

Đúng thiết kế. Gateway cache chỉ cache `GET` response đủ điều kiện. Chat là `POST` và được xử lý bởi backend RAG service, nơi có cache RAG/chat riêng.

## Webhook Zalo/Facebook không nhận event

Kiểm tra:

- Public HTTPS URL trỏ về gateway/backend đúng route.
- Verify token trong provider dashboard khớp env.
- Bot/page đã connect với bot trong OmniRAG.
- Log backend hoặc Facebook worker.

Routes hiện có:

- Zalo Hub: `POST /api/v1/channels/zalo/hub-webhook`
- Zalo Bot Platform: `POST /api/v1/channels/zalo-bot/webhook/{bot_id}`
- Facebook Messenger: `POST /api/v1/channels/facebook/inbound/{bot_id}`
