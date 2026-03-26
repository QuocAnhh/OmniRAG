# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OmniRAG is a production-ready RAG (Retrieval-Augmented Generation) platform with three main services:
- **Backend**: Python 3.11 + FastAPI (port 8000)
- **Frontend**: React 19 + TypeScript + Vite (port 5173)
- **Gateway**: Go + Gin (port 8080) - API gateway with Redis caching and rate limiting

## Common Commands

### Docker (Recommended)
```bash
# Start all services
docker-compose up -d --build

# Production
docker-compose -f docker-compose.prod.yml up -d

# Logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f gateway
```

### Backend (local)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (local)
```bash
cd frontend
npm install
npm run dev       # Dev server
npm run build     # Production build
npm run lint      # ESLint
```

### Gateway (local)
```bash
cd gateway
go mod download
go run main.go
```

### Database Migrations
```bash
cd backend
alembic upgrade head                              # Apply migrations
alembic downgrade -1                              # Rollback last
alembic revision --autogenerate -m "description"  # New migration
```

### Testing
```bash
cd scripts
python test_full_system.py    # Full API test suite
python validate_env.py        # Check env variables
bash test_all_apis.sh         # Test all endpoints
```

## Architecture

### Request Flow
```
Browser → Go Gateway (:8080) → FastAPI Backend (:8000) → Data Stores
```
The gateway handles CORS, rate limiting (100 req/s dev / 200 prod), and Redis caching (1hr TTL) before proxying to the backend.

### Data Stores (all run in Docker Compose)
| Store | Port | Purpose |
|-------|------|---------|
| PostgreSQL 15 | 5433 | Primary relational data (users, bots, documents) |
| MongoDB 7 | 27017 | Logs, events, conversation history |
| Redis 7 | 6380 | Celery broker, gateway caching, rate limiting |
| Qdrant | 6333 | Vector embeddings for semantic search |
| MinIO | 9000/9001 | S3-compatible file storage (documents) |

### Backend Structure (`backend/app/`)
- `api/v1/endpoints/` — FastAPI route handlers (auth, bots, documents, openrouter, analytics, integrations, channels)
- `services/` — Business logic; key services:
  - `openrouter_rag_service.py` — Main RAG pipeline (see Advanced RAG Pipeline below)
  - `domain_config.py` — Domain profile registry (general/education/legal/sales)
  - `lightrag_service.py` — Knowledge graph RAG (entity/relationship extraction via LightRAG-HKU)
  - `memory_service.py` — Persistent conversation memory via Mem0
- `models/` — SQLAlchemy ORM models
- `schemas/` — Pydantic v2 request/response schemas
- `tasks/` — Celery async tasks (document processing, Zalo bot tasks)
- `core/config.py` — All configuration via `Settings` class (reads from `backend/.env`)

### Frontend Structure (`frontend/src/`)
- `api/` — Axios-based API client with JWT interceptors (`client.ts` auto-attaches Bearer token)
- `pages/` — Active pages: Dashboard, Bots, BotWizard, BotConfig, Chat, KnowledgeGraph, Settings, Auth, Landing, Docs/ZaloBot
- `store/` — Zustand store (`authStore` for JWT + user state)
- `components/` — Layout, UI primitives, forms
- `utils/domainHelpers.ts` — Shared domain metadata (label, icon, color) used across pages

---

## Advanced RAG Pipeline

The main chat endpoints are:
- `POST /api/v1/openrouter/rag/chat` — standard (non-streaming)
- `POST /api/v1/openrouter/rag/stream` — SSE streaming

### Pipeline Steps (per request)

All steps are parallelised for minimum latency (~3.5s to first token):

```
t=0:    embed(query) + rewrite(query) + memory_search  ← all concurrent
t=~0.4: embed done → hybrid_search + lightRAG start   ← no waiting for rewrite
t=~1.5: search done → CRAG starts                     ← lightRAG still running
t=~2.5: CRAG + lightRAG done → context assembled      ← concurrent
t=~3.5: LLM streaming begins
```

1. **Embed + Rewrite** — concurrent at request start; embed uses original query (no HyDE), rewrite (`_rewrite_query()`) runs alongside for use in CRAG + LLM prompt. Model: `INTERNAL_LLM_MODEL = openai/gpt-5.4-nano`
2. **Hybrid Search** — `_hybrid_search()`: vector (semantic) + full-text search (Qdrant BM25-style), merged via RRF, re-ranked by Cross-Encoder. Starts as soon as embedding is ready.
3. **LightRAG** (optional) — entity/relationship graph query, runs concurrently with hybrid search, capped at 10s timeout
4. **CRAG** — `_crag_classify()`: classifies retrieval quality as `relevant` / `ambiguous` / `no_context`. Starts immediately after search (not waiting for LightRAG). Model: `gpt-5.4-nano`
5. **Context Assembly** — builds `[[n]]`-cited context blocks; uses `parent_text` if Parent-Child chunking was used
6. **Answer Synthesis** — OpenRouter LLM call with domain-specific system prompt suffix + CRAG signal + memory block

> **`INTERNAL_LLM_MODEL`** constant (`openai/gpt-5.4-nano`) is used for all internal pipeline calls (rewrite, CRAG, contextual prefix, session title). The user-facing answer model is set separately via `bot_config["model"]`.

### Domain Profiles (`backend/app/services/domain_config.py`)
Each bot has a `domain` field (default: `general`). The domain profile controls chunking, retrieval, and LightRAG behavior:

| Domain | Chunk Strategy | Chunk Size | Retrieval K | LightRAG | LightRAG Mode |
|--------|---------------|------------|-------------|----------|---------------|
| `general` | recursive | 512 | 10 | No | naive |
| `education` | sentence | 384 | 12 | Yes | local |
| `legal` | article | 1024 | 8 | Yes | hybrid |
| `sales` | recursive | 256 | 15 | No | naive |

- **article** chunking splits at Vietnamese legal article markers (`Điều N`) then sub-splits oversized articles
- **sentence** chunking uses a rolling-window accumulator preserving paragraph coherence
- **parent_child** chunking creates small child chunks (1/4 of chunk_size) for precise matching; parent text is stored and returned to the LLM for richer context
- `enable_knowledge_graph` is auto-set to `true` when domain is `education` or `legal`

### Document Processing Pipeline
```
Upload → MinIO storage → Celery task dispatched
  → domain profile resolved (chunk_size, chunk_overlap, strategy)
  → _chunk_documents() (recursive | sentence | article | parent_child)
  → Contextual Retrieval: _generate_contextual_prefix_batch()
      generates 1-2 sentence situating context per chunk via gpt-5.4-nano
      enriched text (prefix + chunk) used for embedding; original stored for display
  → embed_batch_async() → Qdrant upsert
      payload: { text, parent_text, context_prefix, source, bot_id, metadata }
  → LightRAG ingestion (if domain uses KG)
```

### BotConfig Schema Fields (relevant to RAG)
```python
domain: str = "general"              # general | education | legal | sales
chunking_strategy: str | None        # override domain default
chunk_size: int | None               # override domain default
chunk_overlap: int | None            # override domain default
enable_knowledge_graph: bool         # auto-true for education/legal
similarity_threshold: float = 0.15  # min hybrid_score to include in context
top_k: int                           # overrides domain's retrieval_k
```

---

## Frontend Pages & Routes

| Route | Page | Notes |
|-------|------|-------|
| `/` | LandingPage | Public |
| `/auth` | AuthPage | Public |
| `/dashboard` | DashboardPage | Stats tiles, recent convos, agent status |
| `/bots` | BotsPage | List all bots; Chat is primary CTA |
| `/bots/new` | BotWizardPage | Multi-step: template → domain selector → config → review |
| `/bots/:id/config` | BotConfigPage | Always shows full advanced controls |
| `/bots/:id/chat` | ChatPage | Streaming chat |
| `/bots/:id/graph` | KnowledgeGraphPage | LightRAG entity/relationship visualization |
| `/settings` | SettingsPage | User settings |
| `/docs/zalo-bot` | ZaloBotGuidePage | Public integration guide |

**Removed routes** (deleted, not just hidden): `/documents`, `/linear-showcase`, BotStudioPage (`/bots/:id` generic)

### Key Frontend Patterns
- **Domain selector**: step in BotWizardPage — 4 cards (General/Education/Legal/Sales) with descriptions
- **Domain badges**: shown on TemplateSelector cards and BotConfigPage header via `getDomainMeta()` from `utils/domainHelpers.ts`
- **KG auto-enable**: BotConfigPage derives `enable_knowledge_graph` from domain on load: `botData.config?.enable_knowledge_graph || ['education', 'legal'].includes(domain)`
- **BotConfigPage**: always shows advanced controls (no Simple/Advanced toggle); post-upload shows "Start Chatting" CTA
- **Dashboard**: calls `botsApi.list()`, `analyticsApi.getConversations(8)`, `analyticsApi.getStats()`, `documentsApi.list(botId)` in parallel; all wrapped in `.catch()` for graceful degradation

---

## Authentication
- JWT tokens, 30-minute expiry
- Frontend stores token in Zustand + localStorage via `authStore`
- All API requests auto-attach `Authorization: Bearer <token>` via Axios interceptor in `api/client.ts`

## Environment Configuration

Backend config lives in `backend/.env`. Key variables in `backend/app/core/config.py`:
- `OPENROUTER_API_KEY` — Primary LLM provider (used for both LLM and embeddings)
- `DATABASE_URL` — PostgreSQL connection
- `REDIS_URL` — Redis connection
- `QDRANT_HOST/PORT` — Vector DB
- `MINIO_*` — Object storage credentials
- `SECRET_KEY` — JWT signing key (required in production)
- `MEM0_*` — Memory service configuration
- `ZALO_*` — Zalo integration webhook credentials
- `RERANKER_MODEL` — Cross-encoder model for reranking (default: `cross-encoder/ms-marco-MiniLM-L-6-v2` — fast on CPU; set to `BAAI/bge-reranker-v2-m3` for multilingual quality when running natively on M1/M2 with MPS)

## Important Patterns

### Adding a New API Endpoint
1. Create route handler in `backend/app/api/v1/endpoints/`
2. Add Pydantic schemas in `backend/app/schemas/`
3. Register router in `backend/app/api/api.py`
4. Add corresponding API call in `frontend/src/api/`

### Adding a New Domain
1. Add entry to `DOMAIN_PROFILES` in `backend/app/services/domain_config.py`
2. Add to `Literal` type in `DomainProfile.chunk_strategy` if using a new chunking strategy
3. Add to `DOMAIN_META` in `frontend/src/utils/domainHelpers.ts`
4. Add domain card in BotWizardPage domain selector step

### Background Tasks
Use Celery tasks in `backend/app/tasks/` for long-running operations (document embedding, external API calls). Redis is the broker.

### Knowledge Graph
LightRAG stores graph data in `backend/rag_storage/` (untracked, local). The `KnowledgeGraphPage` component visualizes entities/relationships using `@react-sigma/core` + `graphology`.

## Tech Stack Quick Reference
- **Backend**: FastAPI, SQLAlchemy 2.0, Pydantic v2, LangChain, LightRAG-HKU, Mem0, sentence-transformers, Celery
- **Frontend**: React 19, TypeScript 5.9, Vite (rolldown-vite), Tailwind CSS 4, Zustand, TanStack Query, Framer Motion
- **Gateway**: Go 1.21, Gin, go-redis, zap logger
