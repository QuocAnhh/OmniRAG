# Integration Status

File này thay thế nội dung “complete checklist” cũ bằng trạng thái hiện tại. Nó chỉ mô tả các component thật đang có trong snapshot này.

## Completed in current snapshot

| Area | Status |
| --- | --- |
| Docker Compose stack | Backend, frontend, gateway, db, mongodb, redis, minio, qdrant, celery, hybrid parser |
| Gateway | Proxy, CORS, rate limit, health/readiness/metrics, GET cache |
| Backend API | Auth, tenants, bots, documents, chat, graph, dashboard, analytics, users, integrations, channels |
| RAG | OpenRouter RAG service, LightRAG, Qdrant, Redis cache, Celery ingestion |
| Frontend | React app with protected dashboard/bots/chat/graph/settings routes |
| Zalo Bot Platform | Connect/disconnect/status/webhook |
| Zalo Personal | QR-login worker, multi-account APIs, access grants, HMAC inbound |
| Facebook Messenger | Isolated worker integration |
| Observability | `structlog`, Prometheus metrics, request id, SlowAPI, gateway metrics |

## Current entrypoints

- Frontend: `http://localhost:5173`
- Gateway: `http://localhost:8080`
- API: `http://localhost:8080/api/v1`
- Swagger: `http://localhost:8080/docs`
- Backend direct Docker: `http://localhost:8001`

## Current model behavior

- Code internal default: `openai/gpt-5.4-nano`.
- Docker Compose override: `LIGHTRAG_LLM_MODEL=openai/gpt-4.1-mini`.

## Current document flow

1. Upload one file via `POST /api/v1/bots/{bot_id}/documents`.
2. Backend stores metadata/file and queues Celery.
3. Worker parses via OpenDataLoader/hybrid service.
4. RAG service chunks with `recursive`, `sentence`, `article`, `parent_child` or `semantic`.
5. Embeddings go to Qdrant.
6. Cache is invalidated for the bot.

## Not complete / known gaps

- No backend document update endpoint.
- No backend document preview endpoint.
- Frontend folder API client lacks `/api/v1` prefix.
- Zalo Personal is present but disabled by default unless the required env flags/secrets are configured.
- Production deployment still needs environment-specific secrets, TLS, backups, alerting and log retention.

## Recommended smoke test

```bash
docker compose up -d --build
curl http://localhost:8080/health
curl http://localhost:8080/docs
```

Then:

1. Register/login.
2. Create bot.
3. Upload document.
4. Wait for Celery ingestion.
5. Chat.
6. Open `/bots/:id/graph` if Knowledge Graph is enabled.
