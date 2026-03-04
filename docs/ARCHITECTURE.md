# OmniRAG Architecture

## Request Flow

```
Browser
  │
  ↓
Go API Gateway  (port 8080)
  │  CORS  │  Rate Limiting (100 rps)  │  Redis Cache (1h TTL)  │  Logging
  ↓
FastAPI Backend  (port 8000)
  │
  ├── Auth API          /api/v1/auth/*
  ├── Bot API           /api/v1/bots/*
  ├── Bot Templates     /api/v1/bot-templates/*
  ├── Folders           /api/v1/folders/*
  ├── Documents         /api/v1/bots/{id}/documents
  ├── OpenRouter RAG    /api/v1/openrouter/*
  ├── Analytics         /api/v1/analytics/*
  ├── Dashboard         /api/v1/dashboard/*
  ├── Users             /api/v1/users/*
  ├── Integrations      /api/v1/integrations/*
  ├── Zalo Hub          /api/v1/channels/zalo/*
  └── Zalo Bot          /api/v1/channels/zalo-bot/*
  │
  ├── PostgreSQL  (port 5433) — Users, Bots, Documents metadata, Folders
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
│       ├── bots.py          — Bot CRUD + chat + document endpoints
│       ├── bot_templates.py — Pre-built bot templates
│       ├── folders.py       — Document/bot folder management
│       ├── openrouter.py    — Direct OpenRouter: chat, embed, RAG
│       ├── analytics.py     — Conversation & usage analytics
│       ├── dashboard.py     — Dashboard stats
│       ├── users.py         — User management
│       ├── tenants.py       — Tenant settings
│       ├── integrations.py  — External integration hooks
│       ├── data_grid.py     — Paginated data grid
│       └── channels/
│           ├── zalo_hub.py  — Zalo Hub webhook receiver
│           └── zalo_bot.py  — Zalo bot task dispatcher
├── services/
│   ├── openrouter_rag_service.py  — Main RAG pipeline (hybrid search, rerank, LightRAG, Mem0)
│   ├── openrouter_service.py      — OpenRouter HTTP wrapper (chat + embeddings)
│   ├── lightrag_service.py        — LightRAG knowledge graph (entity/rel extraction)
│   ├── memory_service.py          — Mem0 persistent conversation memory
│   ├── bot_templates.py           — Bot template business logic
│   ├── cache_service.py           — Redis cache wrapper
│   ├── storage_service.py         — MinIO file storage
│   └── channels/                  — Zalo message handling services
├── models/                  — SQLAlchemy ORM (Bot, Document, Folder, Tenant, User)
├── schemas/                 — Pydantic v2 schemas (request/response)
├── tasks/
│   ├── document_tasks.py    — Celery: chunk → embed → store in Qdrant
│   ├── zalo_bot_tasks.py    — Celery: Zalo bot async message tasks
│   └── zalo_tasks.py        — Celery: Zalo integration tasks
├── db/                      — DB connections (PostgreSQL, MongoDB, Redis)
└── core/
    ├── config.py            — Settings (pydantic-settings, reads .env)
    └── security.py          — JWT utilities
```

## RAG Pipeline

Main endpoint: `POST /api/v1/openrouter/rag/chat` (also accessible via `POST /api/v1/bots/{id}/chat`)

```
User Query
  │
  ├─► Query Transformation
  │     ├── HyDE (hypothetical answer → embed)
  │     └── Multi-query (rephrase × N)
  │
  ├─► Hybrid Search (Qdrant)
  │     ├── Vector search (cosine similarity)
  │     └── Keyword/metadata filter
  │
  ├─► Re-ranking (cross-encoder sort)
  │
  ├─► Knowledge Graph Query (LightRAG, optional)
  │     └── Entity/relationship context injection
  │
  ├─► Memory Retrieval (Mem0, top-K facts)
  │
  ├─► LLM Generation (OpenRouter)
  │     └── 400+ models available
  │
  └─► Memory Update (Mem0 fact extraction)
```

## Knowledge Graph (LightRAG)

- Triggered during document ingestion — extracts entities & relationships
- Stored in `backend/rag_storage/lightrag_{bot_id}/` (local, untracked)
- LLM for extraction: configurable via `LIGHTRAG_LLM_MODEL` (default `openai/gpt-4.1-mini`)
- Embeddings: OpenRouter `text-embedding-3-small`
- Frontend visualisation: `KnowledgeGraphPage` using `@react-sigma/core` + `graphology`

## Authentication

```
POST /api/v1/auth/login
  → JWT token (HS256, 30-min expiry)
  → Stored in Zustand + localStorage (frontend)
  → All requests: Authorization: Bearer <token>
  → Gateway passes token through to backend
```

## Go Gateway

Key behaviours (`gateway/`):

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
├── api/          — Axios clients (client.ts auto-attaches Bearer token)
├── pages/        — 14 page components
├── components/
│   ├── chat/     — ChatWindow, MessageBubble, KnowledgeGraphPanel
│   ├── bots/     — Bot cards, config forms
│   ├── documents/— Upload, list, status
│   └── ui/       — Primitives (button, modal, etc.)
├── store/        — Zustand (authStore)
├── hooks/        — Custom React hooks
├── types/        — TypeScript interfaces
└── lib/          — Utilities
```
