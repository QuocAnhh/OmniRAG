# Features

Danh sách tính năng hiện có trên snapshot hiện tại của `refactor/backend-perf-p1-observability`.

## Core platform

- Multi-tenant user/bot management.
- Auth bằng JWT.
- Quản lý profile user và API keys.
- Folder organization cho bots.
- Bot templates theo domain và tạo bot từ template.
- Dashboard stats, activity và quick stats.
- Analytics: conversations, messages over time, bot usage, top queries, response time distribution.

## Bot và RAG

- Upload tài liệu cho từng bot.
- Ingest tài liệu bất đồng bộ qua Celery worker.
- Lưu file gốc trên MinIO, metadata trên PostgreSQL.
- Vector search qua Qdrant.
- Conversation/session history trên MongoDB.
- Hybrid retrieval, reranking, query rewriting và CRAG verdict trong RAG service.
- Redis cache cho chat, embeddings, rewrite và CRAG.
- Knowledge Graph qua backend API `/api/v1/bots/{bot_id}/knowledge-graph`.
- Frontend graph page tại `/bots/:id/graph`.

Chunk strategies:

- `recursive`
- `sentence`
- `article`
- `parent_child`
- `semantic`

## Runtime components

| Component | Technology | Port | Notes |
| --- | --- | ---: | --- |
| API Gateway | Go + Gin | `8080` | Rate limit, Redis GET cache, metrics |
| Backend API | Python 3.11 + FastAPI | `8000` internal, `8001` host | SQLAlchemy, Pydantic, Celery |
| Frontend | React 19 + TypeScript + Vite | `5173` | Tailwind CSS 4, Zustand |
| PostgreSQL | 15-alpine | `5433` host | Relational store |
| MongoDB | 7.0 | `27017` | Conversations, sessions, integrations |
| Redis | 7-alpine | `6380` host | Celery broker, gateway/backend cache |
| Qdrant | latest | `6333` | Vector DB |
| MinIO | latest | `9000/9001` | S3-compatible storage |
| OpenDataLoader hybrid | local build | `5002` | PDF/Office parsing |
| Facebook worker | Python + FastAPI | `9100` internal | `fbchat-muqit` isolated bridge |
| Zalo Personal worker | Node.js + Fastify | `9200` internal | `zca-js` isolated bridge |

## PDF và tài liệu

- PDF/Office parsing qua OpenDataLoader.
- Hybrid service build từ `backend/Dockerfile.hybrid`.
- Hỗ trợ table extraction, external image output, docling-fast hybrid mode.
- Có fallback local nếu hybrid service lỗi và `PDF_HYBRID_FALLBACK=true`.
- Bot config có thể bật enrichment cho mô tả ảnh tùy flow.

## Frontend

- React 19, React Router 7, Zustand, Tailwind CSS 4.
- Protected routes cho dashboard/bots/settings.
- API clients trong `frontend/src/api`.
- Pages chính: dashboard, bots list, bot wizard, bot config, chat, graph, settings.
- Zalo Personal accounts page tại `/bots/:id/zalo-accounts`.
- Zalo Bot docs page tại `/docs/zalo-bot`.

## Gateway và performance

- Go gateway tại `http://localhost:8080`.
- Reverse proxy tới backend `http://backend:8000`.
- CORS, logging, rate limit, health/readiness/metrics.
- Redis cache cho `GET` response đủ điều kiện.
- Không cache `POST` chat ở gateway; chat cache nằm trong backend RAG service.

## Observability

- Backend structured logging qua `structlog`.
- Prometheus metrics tại `/metrics`.
- Request ID middleware.
- SlowAPI rate limiting.
- Gateway metrics và readiness.

## Integrations

### Zalo Bot Platform

- Connect/disconnect/status.
- Webhook inbound theo bot.
- Reply text và typing action qua Zalo Bot API.
- Guide hiện trạng: [Zalo Bot Integration](ZALO_BOT_INTEGRATION_PLAN.md).

### Zalo Personal

- QR-login personal account worker.
- Multi-account support qua `channel_accounts`.
- Reply policy `mention_only | all`.
- Thread whitelist.
- Per-account access grants.
- Worker inbound bảo vệ bằng HMAC.
- Circuit breaker và rate limiting ở worker.
- Mặc định tắt bằng env/feature flag; xem [Zalo Personal Integration](ZALO_PERSONAL_INTEGRATION.md).

### Facebook Messenger

- Worker riêng `fb-channel-worker`.
- Cookie-based login qua unofficial Messenger client.
- Group mention policy, DM replies, attachment normalization, image understanding, typing/reactions.
- Guide: [Facebook Messenger Integration](FACEBOOK_MESSENGER_INTEGRATION.md).

## Known gaps

- Backend document update/preview endpoint chưa có.
- Zalo Personal là integration không chính thức, nên cần account riêng và vận hành cẩn trọng.
- Nếu cần public production hardening, cần bổ sung TLS, secret management, log retention và alerting ngoài scope code hiện tại.
