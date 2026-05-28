# OmniRAG

OmniRAG là nền tảng chatbot RAG đa tenant, có quản trị bot, ingest tài liệu bất đồng bộ, OpenRouter/LightRAG, Knowledge Graph, dashboard analytics và các kênh tích hợp như Zalo Bot Platform, Zalo Personal và Facebook Messenger.

Tài liệu này phản ánh snapshot hiện tại của `refactor/backend-perf-p1-observability`.

## Stack chính

- Backend: FastAPI, SQLAlchemy sync/async, Alembic, PostgreSQL, MongoDB, Redis, Celery.
- RAG: LightRAG, Qdrant, OpenRouter, pipeline PDF/Office qua OpenDataLoader hybrid build service.
- Gateway: Go proxy tại port `8080`, là entrypoint chính cho frontend và API khi chạy Docker.
- Frontend: React 19, React Router 7, Zustand, Tailwind CSS 4, Vite.
- Channels: Zalo Bot Platform, Zalo Personal worker, Facebook Messenger worker.
- Observability: `structlog`, Prometheus metrics, request id, SlowAPI rate limit, gateway metrics.

## Services

| Service | Host port | Internal port | Ghi chú |
| --- | ---: | ---: | --- |
| Frontend | `5173` | `5173` | React app |
| Gateway | `8080` | `8080` | Entrypoint chính |
| Backend | `8001` | `8000` | FastAPI direct access khi chạy Docker |
| PostgreSQL | `5433` | `5432` | Metadata |
| MongoDB | `27017` | `27017` | Conversations, sessions, integrations |
| Redis | `6380` | `6379` | Celery, cache, rate limit |
| Qdrant | `6333` | `6333` | Vector store |
| MinIO | `9000/9001` | `9000/9001` | Object storage |
| OpenDataLoader hybrid | `5002` | `5002` | PDF/Office parsing |
| Facebook worker | internal | `9100` | Messenger bridge |
| Zalo Personal worker | internal | `9200` | `zca-js` bridge |

## Chạy nhanh bằng Docker

Tạo `backend/.env` thủ công. Nhánh này không có `backend/.env.example`.

```bash
cd backend
touch .env
```

Các biến tối thiểu thường dùng:

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

Khởi động stack:

```bash
docker compose up -d --build
```

Các endpoint quan trọng:

| Service | URL | Ghi chú |
| --- | --- | --- |
| Frontend | `http://localhost:5173` | App React |
| Gateway | `http://localhost:8080` | Entrypoint chính |
| API qua gateway | `http://localhost:8080/api/v1` | Frontend dùng URL này |
| Swagger qua gateway | `http://localhost:8080/docs` | Proxy tới backend |
| Backend direct Docker | `http://localhost:8001` | Host port map `8001:8000` |
| Backend local uvicorn | `http://localhost:8000` | Chỉ khi chạy ngoài Docker |
| MinIO Console | `http://localhost:9001` | Object storage |
| Qdrant | `http://localhost:6333` | Vector store |

## Luồng vận hành

1. User đăng nhập qua `/api/v1/auth/*`.
2. Frontend gọi gateway `http://localhost:8080`.
3. Gateway proxy tới backend service nội bộ `http://backend:8000`.
4. Backend xử lý tenant, bot, tài liệu, chat, analytics và integrations.
5. Ingest tài liệu chạy qua Celery worker, Redis broker, PostgreSQL, MongoDB, MinIO, Qdrant và OpenDataLoader hybrid service.
6. Channel workers gọi inbound webhook về backend bằng token/HMAC nội bộ.

Gateway chỉ cache các response `GET` đủ điều kiện. Cache chat/RAG nằm trong backend RAG service, không phải gateway.

## Tính năng chính

- Bot Wizard với domain selector.
- Dashboard stats, activity và quick stats.
- Streaming chat qua SSE.
- Document processing bất đồng bộ qua Celery.
- Knowledge Graph và RAG cache.
- Zalo Bot Platform webhook integration.
- Zalo Personal QR-login worker, multi-account support, mention-only policy và HMAC inbound.
- Facebook Messenger worker cho group/DM replies, image coalescing và normalized attachments.

## Tài liệu nên đọc

- [Quick Start](docs/QUICK_START.md)
- [Startup Guide](docs/STARTUP_GUIDE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [API Reference](docs/API_REFERENCE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Frontend Integration](docs/FRONTEND_INTEGRATION.md)
- [Gateway Quickstart](docs/GATEWAY_QUICKSTART.md)
- [Zalo Bot Platform](docs/ZALO_BOT_INTEGRATION_PLAN.md)
- [Zalo Personal](docs/ZALO_PERSONAL_INTEGRATION.md)
- [Facebook Messenger](docs/FACEBOOK_MESSENGER_INTEGRATION.md)

## Known gaps

- Frontend có client cho document update/preview, nhưng backend chưa có `PUT /api/v1/bots/{bot_id}/documents/{doc_id}` hoặc endpoint preview. Không document hai endpoint này như API supported.
- Frontend route Knowledge Graph là `/bots/:id/graph`; backend API vẫn là `/api/v1/bots/{bot_id}/knowledge-graph`.
- Zalo Personal có trong snapshot hiện tại nhưng mặc định tắt bằng feature flag/env; bật bằng `ZALO_PERSONAL_ENABLED=true` và `VITE_ENABLE_ZALO_PERSONAL=true`.
