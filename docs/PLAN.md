# OmniRAG Current Plan

Tài liệu này là current-state roadmap cho snapshot `refactor/backend-perf-p1-observability`. Nó không còn là checklist triển khai cũ.

## Product direction

OmniRAG tập trung vào:

- Nền tảng chatbot RAG đa tenant.
- Ingestion tài liệu bất đồng bộ, có parsing nâng cao.
- Retrieval chất lượng cao với Qdrant, reranking, query rewrite, CRAG và Knowledge Graph.
- Frontend quản trị bot, chat, graph, settings.
- Gateway làm entrypoint thống nhất.
- Channel integrations cho Zalo Bot Platform và Facebook Messenger.

## Current baseline

| Area | Baseline |
| --- | --- |
| Backend | FastAPI, JWT auth, SQLAlchemy sync/async, MongoDB, Redis |
| Workers | Celery document ingestion |
| Storage | PostgreSQL, MongoDB, MinIO, Qdrant |
| RAG | OpenRouter RAG service, LightRAG, Redis cache |
| Frontend | React 19, React Router 7, Zustand, Tailwind 4 |
| Gateway | Go proxy with CORS, rate limit, GET cache, metrics |
| Observability | `structlog`, Prometheus, request id, SlowAPI |

## Near-term roadmap

1. Fix frontend/backend API gaps.
   - Add or remove document update/preview flow.
   - Fix `folders.ts` prefix `/api/v1`.
   - Align frontend route constants with `App.tsx`.

2. Harden ingestion operations.
   - Improve document status visibility.
   - Surface Celery failures in UI.
   - Add retry/backoff policy docs for parsing/provider failures.

3. Strengthen production readiness.
   - Secret management.
   - TLS and public webhook URL handling.
   - Backups for PostgreSQL, MongoDB, MinIO and Qdrant.
   - Alerting on `/metrics`.

4. Improve channel admin UX.
   - Zalo Bot connect/status UI polish.
   - Facebook worker health/status UX.
   - Clear separation between official bot platform channels and future personal-account channels.

5. Expand automated verification.
   - API contract tests from route inventory.
   - Gateway cache behavior tests already exist; keep extending dynamic exclusion cases.
   - Frontend smoke tests for protected routes.

## Future/pending

- Zalo Personal/ZCA integration is pending/future and not documented as current capability on this branch.
- Additional channels such as Telegram/Slack/WhatsApp should remain roadmap items unless code lands.
- WebSocket APIs should not be listed as supported until backend/frontend implement them.

## Docs maintenance rule

When code changes, update docs in the same PR:

- Router changes -> `docs/API_REFERENCE.md`.
- Frontend route/API client changes -> `docs/FRONTEND_INTEGRATION.md`.
- Docker/ports/env changes -> `README.md`, `docs/QUICK_START.md`, `docs/STARTUP_GUIDE.md`.
- Gateway behavior changes -> `docs/GATEWAY_QUICKSTART.md`, `gateway/README.md`.
- RAG/parser changes -> `docs/ADVANCED_RAG_FEATURES.md`, `docs/PDF_PARSING.md`.
- Channel behavior changes -> channel-specific docs.
