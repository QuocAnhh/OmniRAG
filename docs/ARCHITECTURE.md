# OmniRAG Architecture

## Request Flow

```
Browser
  │
  ↓
Go API Gateway  (port 8080)
  │  CORS  │  Rate Limiting (100 rps)  │  Redis Cache (1h TTL)  │  Structured Logging
  ↓
FastAPI Backend  (port 8000)
  │
  ├── Auth API          /api/v1/auth/*
  ├── Bot API           /api/v1/bots/*
  ├── Bot Templates     /api/v1/bot-templates/*
  ├── Documents         /api/v1/bots/{id}/documents
  ├── OpenRouter RAG    /api/v1/openrouter/*
  ├── Analytics         /api/v1/analytics/*
  ├── Dashboard         /api/v1/dashboard/*
  ├── Users             /api/v1/users/*
  ├── Integrations      /api/v1/integrations/*
  ├── Zalo Hub          /api/v1/channels/zalo/*
  ├── Zalo Bot          /api/v1/channels/zalo-bot/*
  └── Facebook          /api/v1/channels/facebook/*
  │
  ├── fb-channel-worker (port 9100) — isolated Messenger bridge
  ├── PostgreSQL  (port 5433) — Users, Bots, Documents metadata
  ├── MongoDB     (port 27017) — Chat logs, conversation history
  ├── Redis       (port 6380) — Celery broker, gateway cache
  ├── Qdrant      (port 6333) — Vector embeddings (HNSW)
  ├── MinIO       (port 9000) — File storage
  └── Celery Worker — Async document processing
```

## Services

| Service | Technology | Port | Description |
|---------|------------|------|-------------|
| Frontend | React 19 + TypeScript + Vite | 5173 | Main UI |
| Gateway | Go 1.21 + Gin | 8080 | API gateway |
| Backend | Python 3.11 + FastAPI | 8000 | Core API & logic |
| PostgreSQL | 15-alpine | 5433 | Relational data |
| MongoDB | 7.0 | 27017 | Logs & analytics |
| Redis | 7-alpine | 6380 | Cache & task broker |
| Qdrant | latest | 6333 | Vector DB |
| MinIO | latest | 9000/9001 | Object storage |
| fb-channel-worker | Python 3.11 + FastAPI | 9100 | Isolated Facebook Messenger bridge |

## Backend Structure (`backend/app/`)

```
app/
├── main.py                  — FastAPI app factory, CORS, lifespan
├── worker.py                — Celery worker entrypoint
├── api/
│   ├── api.py               — Router registration
│   ├── deps.py              — Shared dependencies (DB, auth)
│   └── v1/endpoints/
│       ├── auth.py          — Register, login, /me
│       ├── bots.py          — Bot CRUD + document upload (domain profile resolution)
│       ├── bot_templates.py — Pre-built templates (domain defaults propagated)
│       ├── openrouter.py    — RAG chat + streaming endpoints
│       ├── analytics.py     — Conversation & usage analytics
│       ├── dashboard.py     — Dashboard stats (stats, recent convos)
│       ├── users.py         — User management
│       ├── integrations.py  — External integration hooks
│       └── channels/
│           ├── zalo_hub.py  — Zalo Hub webhook receiver
│           ├── zalo_bot.py  — Zalo bot webhook receiver + connect/disconnect (in-process via asyncio.create_task)
│           └── facebook_messenger.py — Facebook connect/disconnect/status + signed worker inbound
├── services/
│   ├── openrouter_rag_service.py  — Main RAG pipeline (see RAG Pipeline below)
│   ├── domain_config.py           — Domain profile registry (general/education/legal/sales)
│   ├── openrouter_service.py      — OpenRouter HTTP wrapper (chat + embeddings)
│   ├── lightrag_service.py        — LightRAG knowledge graph (entity/rel extraction)
│   ├── memory_service.py          — Mem0 persistent conversation memory
│   ├── bot_templates.py           — Bot template business logic
│   ├── cache_service.py           — Redis cache wrapper
│   ├── storage_service.py         — MinIO file storage
│   └── channels/                  — Channel services (Zalo, Facebook Messenger)
├── models/                  — SQLAlchemy ORM (Bot, Document, Tenant, User)
├── schemas/                 — Pydantic v2 schemas; BotConfig includes domain + chunk fields
├── tasks/
│   ├── document_tasks.py    — Celery: chunk → contextual prefix → embed → Qdrant
│   ├── zalo_bot_tasks.py    — Celery: Zalo bot async message tasks
│   └── zalo_tasks.py        — Celery: Zalo integration tasks
├── db/                      — DB connections (PostgreSQL, MongoDB, Redis)
└── core/
    ├── config.py            — Settings (pydantic-settings, reads .env); includes RERANKER_MODEL
    └── security.py          — JWT utilities
```

## Facebook Messenger Worker Flow

Facebook Messenger is intentionally separated from the backend because it uses
the unofficial GPL-licensed `fbchat-muqit` library.

```
Messenger MQTT events
  ↓
fb-channel-worker
  ├─ echo guard / thread whitelist / mention-only policy
  ├─ text + image event coalescing
  ├─ raw + normalized attachment payload
  └─ HMAC-signed POST to backend inbound route
       ↓
FacebookMessengerService
  ├─ group context and participant lookup
  ├─ image description via OpenRouter vision
  ├─ RAG + memory pipeline
  └─ worker send/react/leave calls
```

See [FACEBOOK_MESSENGER_INTEGRATION.md](FACEBOOK_MESSENGER_INTEGRATION.md) for
operational details.

## Advanced RAG Pipeline

Main endpoints:
- `POST /api/v1/bots/{bot_id}/chat` — standard response
- `POST /api/v1/bots/{bot_id}/chat-stream` — SSE streaming

All steps are parallelised for minimum latency (~2.8s to first token):

```
t=0:    ┌─ embed(query)      ─────────────────────────────┐
        └─ rewrite(query)    ───────────────────────────┐ │
                                                        │ ↓
t=~0.4: ┌─ hybrid_search()  ───────────────────────┐   │ (embed done)
        └─ lightrag_query() ─────────────────────┐ │   │ (if KG bot)
                                                 │ ↓   │
t=~1.7:   CRAG classify()   ─────────────────┐  │ ↓   │ (search done)
                                             ↓  ↓ ↓   ↓
t=~2.8:   context assembled ← all tasks done
  +       memory_search() ── concurrent with rag prep
t=~2.8:   LLM streaming begins
```

Pipeline steps:
1. **Embed + Rewrite** — concurrent at t=0; embed fires original query (no HyDE), rewrite runs alongside
2. **Hybrid Search + LightRAG** — start as soon as embedding is ready (not waiting for rewrite)
3. **CRAG** — starts immediately after search; LightRAG keeps running concurrently
4. **Memory Search** — runs concurrent with entire RAG prep via `asyncio.gather`
5. **Context Assembly** — `[[n]]`-cited blocks; uses `parent_text` if Parent-Child chunking
6. **LLM Generation** — OpenRouter with domain prompt suffix + CRAG signal injected
7. **Memory Update** — `asyncio.create_task` (non-blocking, after response)

## Document Ingestion Pipeline

```
File Upload (PDF/TXT)
  │
  ├── MinIO storage
  │
  └── Celery task dispatched
        │
        ├── PDF parsing: _load_pdf_opendataloader()  ← FULL MODE
        │     opendataloader-pdf with:
        │       format="markdown-with-images,json"
        │       table_method="cluster" (border + cluster detection)
        │       image_output="external" (extract PNG/JPEG)
        │       markdown_page_separator (preserve page boundaries)
        │       hybrid="docling-fast" (OCR, SmolVLM image descriptions, formulas)
        │     Fallback: hybrid→local→PyPDFLoader
        │     │
        │     ├── Markdown-with-images  → chunking pipeline (see below)
        │     ├── JSON (tables, bbox)   → MinIO upload
        │     └── Images (PNG/JPEG)     → MinIO upload
        │
        ├── domain profile resolved (chunk_size, strategy from bot.config.domain)
        │
        ├── _chunk_documents()
        │     recursive | sentence | article | parent_child
        │
        ├── Contextual Retrieval
        │     _generate_contextual_prefix_batch()
        │     → 1-2 sentence context per chunk (parallel, capped at 50)
        │     → enriched_text = prefix + "\n\n" + chunk_text (for embedding)
        │
        ├── embed_batch_async(enriched_texts)
        │     OpenRouter text-embedding-3-small
        │
        ├── Qdrant upsert
        │     payload: { text, parent_text, context_prefix, source, bot_id }
        │
        └── LightRAG ingestion (if enable_knowledge_graph)
```

> **PDF parsing chi tiết:** xem [PDF_PARSING.md](PDF_PARSING.md)

## Domain Profiles (`domain_config.py`)

| Domain | Strategy | Chunk | K | LightRAG | KG Auto |
|--------|----------|-------|---|----------|---------|
| `general` | recursive | 512 | 10 | naive | No |
| `education` | sentence | 384 | 12 | local | Yes |
| `legal` | article | 1024 | 8 | hybrid | Yes |
| `sales` | recursive | 256 | 15 | naive | No |

## Knowledge Graph (LightRAG)

- Triggered during document ingestion — extracts entities & relationships
- Stored in `backend/rag_storage/lightrag_{bot_id}/` (local, untracked by git)
- LLM for extraction: configurable via `LIGHTRAG_LLM_MODEL` (default `openai/gpt-5.4-nano`)
- Frontend visualisation: `KnowledgeGraphPage` using `@react-sigma/core` + `graphology`
- Query runs concurrently with hybrid search — no added latency

## Authentication

```
POST /api/v1/auth/login
  → JWT token (HS256, 30-min expiry)
  → Stored in Zustand + localStorage (frontend)
  → All requests: Authorization: Bearer <token>
  → Gateway passes token through to backend
```

## Go Gateway

| Feature | Detail |
|---------|--------|
| Proxy | All `/api/*` forwarded to backend:8000 |
| Cache | Redis-backed, 1-hour TTL, `X-Cache: HIT/MISS` header |
| Rate limit | 100 req/s per IP (dev), 200 req/s (prod) |
| Health | `GET /health`, `GET /readiness` |
| CORS | Handled at gateway layer |
| Logging | Structured JSON via Zap |

## Frontend Structure (`frontend/src/`)

```
src/
├── api/              — Axios clients (client.ts auto-attaches Bearer token)
├── pages/
│   ├── DashboardPage.tsx     — Stats tiles, recent convos, agent status
│   ├── BotsPage.tsx          — Bot list (Chat = primary CTA)
│   ├── BotWizardPage.tsx     — Template → Domain selector → Config → Review
│   ├── BotConfigPage.tsx     — Full advanced config, KG auto-enable from domain
│   ├── ChatPage.tsx          — SSE streaming chat
│   ├── KnowledgeGraphPage.tsx
│   ├── SettingsPage.tsx
│   ├── AuthPage.tsx
│   ├── LandingPage.tsx
│   └── Docs/ZaloBotGuidePage.tsx
├── components/
│   ├── Layout/               — Sidebar (Home+AI Agents+Settings nav), ChatLayout
│   ├── bots/                 — TemplateSelector (domain badges, Blueprint cards)
│   └── ui/                   — Primitives
├── store/            — Zustand (authStore: JWT + user)
├── utils/
│   └── domainHelpers.ts      — DOMAIN_META map + getDomainMeta() utility
└── types/
    └── api.ts                — BotConfig: domain, chunking_strategy, chunk_size, chunk_overlap
```
