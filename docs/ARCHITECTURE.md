# Architecture

Tài liệu này mô tả kiến trúc hiện tại của OmniRAG sau audit ngày 2026-06-01.

## Tổng quan

```text
Browser
  |
  v
React Frontend :5173
  |
  | VITE_API_URL=http://localhost:8080
  v
Go Gateway :8080
  |
  | PYTHON_BACKEND_URL=http://backend:8000
  v
FastAPI Backend :8000 container / :8001 host
  |
  +-- PostgreSQL db:5432       metadata, users, tenants, bots, documents
  +-- MongoDB mongodb:27017    conversations, sessions, api keys, integrations
  +-- Redis redis:6379         cache, Celery broker/result backend
  +-- MinIO minio:9000         uploaded file objects
  +-- Qdrant qdrant:6333       dense+sparse vector search
  +-- Celery worker            async document ingestion
  +-- OpenDataLoader :5002     CPU-only hybrid PDF layout/OCR parsing
  +-- OpenRouter/OpenAI        LLM, embeddings, vision
```

## Components

| Component | Path | Vai trò |
| --- | --- | --- |
| Backend API | `backend/app` | FastAPI API, auth, tenants, bots, documents, chat, analytics, integrations |
| Gateway | `gateway` | Go HTTP proxy, CORS, rate limit, health/readiness/metrics, GET cache |
| Frontend | `frontend` | React 19 SPA, protected routes, API clients |
| Celery worker | `backend/app/tasks` | Xử lý ingest tài liệu bất đồng bộ |
| RAG service | `backend/app/services/openrouter_rag_service.py` | Structured chunking, dense+sparse embedding, RRF retrieval, rerank, rewrite, CRAG, chat, cache |
| LightRAG service | `backend/app/services/lightrag_service.py` | Knowledge Graph và LightRAG mode |
| OpenDataLoader hybrid | `backend/Dockerfile.hybrid` | CPU-only OCR/formula/chart/table/image extraction service |
| Facebook worker | `services/fb-channel-worker` | Messenger bridge tách riêng runtime GPL |

## Ports

| Service | Host mặc định | Container/Internal |
| --- | ---: | ---: |
| Frontend | `${FRONTEND_HOST_PORT:-5173}` | `5173` |
| Gateway | `${GATEWAY_HOST_PORT:-8080}` | `8080` |
| Backend | `${BACKEND_HOST_PORT:-8001}` | `8000` |
| PostgreSQL | `${POSTGRES_HOST_PORT:-5433}` | `5432` |
| MongoDB | `${MONGODB_HOST_PORT:-27017}` | `27017` |
| Redis | `${REDIS_HOST_PORT:-6380}` | `6379` |
| MinIO API | `${MINIO_API_HOST_PORT:-9000}` | `9000` |
| MinIO Console | `${MINIO_CONSOLE_HOST_PORT:-9001}` | `9001` |
| Qdrant | `${QDRANT_HOST_PORT:-6333}` | `6333` |
| OpenDataLoader hybrid | `${PDF_HYBRID_HOST_PORT:-5002}` | `5002` |
| Facebook worker | internal | `9100` |

## Backend runtime

Backend dùng SQLAlchemy theo hai mode:

- Sync engine cho Alembic và Celery tasks.
- Async engine cho FastAPI endpoints qua async session.

`SQLALCHEMY_DATABASE_URI` nên dùng dạng sync `postgresql://...`; code tự derive URI async `postgresql+asyncpg://...`.

Startup backend:

1. Configure `structlog` JSON logging.
2. Kết nối MongoDB.
3. Khởi tạo FastAPI middleware, CORS, SlowAPI, request id.
4. Mount routers dưới `/api/v1`.
5. Expose `/health`, `/docs`, `/openapi.json`, `/metrics`.

## Observability

Backend hiện có:

- Structured logs qua `structlog`.
- Request ID middleware để trace request.
- Prometheus metrics tại `/metrics`.
- SlowAPI rate limiting.
- Health check tổng hợp cho PostgreSQL, MongoDB, Redis và các dependency chính.

Gateway hiện có:

- Zap logging.
- `/health`, `/readiness`, `/metrics`.
- Redis readiness/metrics.
- Rate limit middleware.

## Cache

Phân biệt rõ hai lớp cache:

- Gateway cache chỉ áp dụng cho `GET` request đủ điều kiện, có tính `Authorization` vào cache key để tránh leak cross-user. Gateway không cache `POST /chat` hoặc streaming.
- Backend RAG cache dùng Redis cho chat result, embeddings, query rewrite, CRAG verdict và invalidation theo `kb_version:{bot_id}` khi knowledge base thay đổi. Chat cache bypass với memory/history/user-scoped context.

## Document ingestion

Luồng upload tài liệu:

1. `POST /api/v1/bots/{bot_id}/documents` nhận multipart files.
2. Backend lưu metadata PostgreSQL và object vào MinIO.
3. Backend enqueue Celery task.
4. Celery gọi OpenDataLoader/local parser để parse file.
5. PDF được parse thành markdown + JSON elements nếu có; artifacts được lưu ở `documents/{document_id}/extracted/...` trong MinIO.
6. Service chunk tài liệu theo strategy hiệu lực hoặc structured JSON element metadata.
7. Dense OpenRouter embedding và sparse BM25 vector được ghi vào Qdrant collection `omnirag_openrouter_collection_v3`.
8. Metadata cập nhật vào PostgreSQL, gồm số chunks và trạng thái ingest.
9. Nếu bật Knowledge Graph, LightRAG xử lý graph data.

Chunk strategies hiện hỗ trợ:

- `recursive`
- `sentence`
- `article`
- `parent_child`
- `semantic`

Domain templates hiện dùng các strategy trong `domain_config.py`: `recursive`, `article`, `sentence`, `parent_child`.

## Model defaults

- Code internal model: `openai/gpt-5.4-nano`.
- `backend/app/services/lightrag_service.py` default `LIGHTRAG_LLM_MODEL=openai/gpt-5.4-nano`.
- Docker Compose override `LIGHTRAG_LLM_MODEL=openai/gpt-4.1-mini` cho backend và Celery worker.
- Embedding mặc định qua OpenRouter/OpenAI theo config hiện tại.

## Frontend routing

Routes chính:

- `/dashboard`
- `/bots`
- `/bots/new`
- `/bots/:id/edit`
- `/bots/:id/config`
- `/bots/:id/chat`
- `/bots/:id/graph`
- `/bots/:id/zalo-accounts`
- `/settings`
- `/docs/zalo-bot`

API Knowledge Graph vẫn là `/api/v1/bots/{bot_id}/knowledge-graph`; chỉ route frontend là `/bots/:id/graph`.

## Channel integrations

Snapshot này có:

- Zalo Hub webhook: `/api/v1/channels/zalo/hub-webhook`
- Zalo Bot Platform: connect/disconnect/status/webhook dưới `/api/v1/channels/zalo-bot/*`
- Zalo Personal worker: account CRUD/login/status/access/inbound dưới `/api/v1/channels/zalo-personal/*`
- Facebook Messenger bridge: connect/disconnect/status/inbound dưới `/api/v1/channels/facebook/*`

## Known gaps

- Backend chưa expose document update/preview endpoint dù frontend client có hàm tương ứng.
- Gateway cache không cache chat responses. Nếu cần đo cache chat, xem backend RAG cache.
- Một số route OpenRouter trong `/api/v1/openrouter/*` là utility/test route, không phải flow chính của frontend.
