# Features

Danh sách tính năng hiện có trên snapshot `refactor/backend-perf-p1-observability`.

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
- Pages chính: dashboard, bots list, bot form, bot config, chat, graph, settings.
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

### Facebook Messenger

- Worker riêng `fb-channel-worker`.
- Cookie-based login qua unofficial Messenger client.
- Group mention policy, DM replies, attachment normalization, image understanding, typing/reactions.
- Guide: [Facebook Messenger Integration](FACEBOOK_MESSENGER_INTEGRATION.md).

## Future/pending

- Zalo Personal/ZCA không thuộc snapshot này.
- Backend document update/preview endpoint chưa có.
- Nếu cần public production hardening, cần bổ sung TLS, secret management, log retention và alerting ngoài scope code hiện tại.
