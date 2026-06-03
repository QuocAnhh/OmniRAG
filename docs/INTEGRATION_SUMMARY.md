# Integration Summary

Tài liệu này tóm tắt trạng thái tích hợp hiện tại của OmniRAG sau audit ngày 2026-06-01.

## Runtime summary

| Layer | Current state |
| --- | --- |
| Frontend | React 19 SPA, gọi gateway `http://localhost:8080` |
| Gateway | Go proxy, CORS, rate limit, health/readiness/metrics, GET cache |
| Backend | FastAPI, SQLAlchemy sync/async, MongoDB, Redis, Celery, MinIO, Qdrant |
| RAG | OpenRouter/LightRAG, Qdrant v3 dense+sparse RRF retrieval, rerank/rewrite/CRAG, Redis cache |
| Parsing | OpenDataLoader local/hybrid CPU-only service build từ `backend/Dockerfile.hybrid` |
| Channels | Zalo Bot Platform, Zalo Hub webhook, Facebook Messenger worker |

## Ports

| Service | Host URL |
| --- | --- |
| Frontend | `http://localhost:5173` |
| Gateway | `http://localhost:8080` |
| API qua gateway | `http://localhost:8080/api/v1` |
| Backend direct Docker | `http://localhost:8001` |
| Backend local uvicorn | `http://localhost:8000` |
| PostgreSQL | `localhost:5433` |
| MongoDB | `localhost:27017` |
| Redis | `localhost:6380` |
| MinIO | `http://localhost:9000`, console `http://localhost:9001` |
| Qdrant | `http://localhost:6333` |
| OpenDataLoader hybrid | `http://localhost:5002` |

## Config summary

Nhánh này không có `backend/.env.example`. Tạo `backend/.env` thủ công khi cần override hoặc cung cấp secrets.

Các biến quan trọng:

```env
SECRET_KEY=change-me
SQLALCHEMY_DATABASE_URI=postgresql://postgres:password@db:5432/omnirag
MONGODB_URL=mongodb://admin:password@mongodb:27017
REDIS_URL=redis://redis:6379/0
OPENROUTER_API_KEY=sk-or-v1-your-key
OPENAI_API_KEY=sk-your-openai-key
PUBLIC_URL=https://your-public-domain.example.com
RAG_COLLECTION_NAME=omnirag_openrouter_collection_v3
```

Host ports có thể override bằng env như `GATEWAY_HOST_PORT`, `BACKEND_HOST_PORT`, `QDRANT_HOST_PORT` và `PDF_HYBRID_HOST_PORT`.

Compose override model:

```env
LIGHTRAG_LLM_MODEL=openai/gpt-4.1-mini
```

Code internal/default model vẫn là `openai/gpt-5.4-nano`.

## API coverage

API chính hiện có:

- Auth: `/api/v1/auth/register`, `/login`, `/me`
- Tenants: `/api/v1/tenants/me`
- Users/API keys: `/api/v1/users/me`, `/api/v1/users/me/api-keys`
- Bots/documents/chat/graph/memory/retrieval: `/api/v1/bots/*`
- Bot templates: `/api/v1/bot-templates/*`
- Folders: `/api/v1/folders/*`
- Dashboard: `/api/v1/dashboard/stats`, `/activity`, `/quick-stats`
- Analytics: `/api/v1/analytics/*`
- Integrations: `/api/v1/integrations/*`
- Channels: `/api/v1/channels/zalo/*`, `/zalo-bot/*`, `/facebook/*`
- OpenRouter utilities: `/api/v1/openrouter/*`

Chi tiết xem `docs/API_REFERENCE.md`.

## Channel status

### Zalo Bot Platform

Supported:

- Connect bằng bot token.
- Verify token qua `getMe`.
- Set webhook tự động.
- Secret header validation.
- Text inbound -> RAG -> reply.

### Zalo Personal

Supported:

- QR-login personal account worker.
- Multi-account CRUD theo bot.
- Login/status polling.
- Reply policy và thread whitelist.
- Per-account access grants.
- HMAC-protected inbound webhook.

Disabled by default unless `ZALO_PERSONAL_ENABLED=true` and `VITE_ENABLE_ZALO_PERSONAL=true`.

### Facebook Messenger

Supported:

- Worker riêng `fb-channel-worker`.
- Cookie login, group mention policy, DM replies, attachment normalization.
- Inbound event ký HMAC về backend.
- Image understanding qua OpenRouter vision.

## Known gaps

- Backend chưa có document update/preview endpoint dù frontend client có hàm gọi.
- `frontend/src/api/folders.ts` đang thiếu prefix `/api/v1` trong URL.
- Gateway cache chỉ GET, không cache POST chat.
- Một số utility OpenRouter route phục vụ test/debug, không phải flow chính của frontend.

## RAG/parser status

- Qdrant image pin: `qdrant/qdrant:v1.16.0`.
- Default collection: `omnirag_openrouter_collection_v3`.
- PDF parser: OpenDataLoader `format="markdown,json"`, external images, xycut reading order.
- Supported uploads: `.pdf`, `.txt`, `.md`, `.csv`, `.docx`, `.pptx`, `.xlsx`.
- Legacy `.doc`, `.ppt`, `.xls` return `415`.

## Verification commands

```bash
git grep '@router.' backend/app/api
git diff --check
docker compose ps
curl http://localhost:8080/health
curl http://localhost:8080/docs
```
