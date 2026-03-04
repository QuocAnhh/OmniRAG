# OmniRAG Features

## Core Platform

| Feature | Status | Description |
|---------|--------|-------------|
| Multi-tenancy | ✅ | Full data isolation per organisation |
| JWT Authentication | ✅ | 30-minute token expiry, auto-refresh on frontend |
| Role-Based Access (RBAC) | ✅ | owner / admin / member roles |
| Bot Management | ✅ | Create, configure, clone, delete bots |
| Bot Templates | ✅ | Pre-built templates for common use-cases |
| Bot Wizard | ✅ | Step-by-step bot creation flow |
| Bot Studio | ✅ | Advanced visual editor for bot configuration |
| Folder Organisation | ✅ | Group documents/bots into folders |
| Document Upload | ✅ | PDF, DOCX, PPTX, TXT — async via Celery |
| Analytics Dashboard | ✅ | Conversation stats, usage charts |
| User Management | ✅ | Invite/manage users per tenant |

## AI & RAG

| Feature | Status | Description |
|---------|--------|-------------|
| OpenRouter Integration | ✅ | 400+ models: GPT-4o, Claude, Gemini, Llama, ... |
| Default Chat Model | ✅ | `openai/gpt-4o-mini` (configurable per bot) |
| Default Embedding Model | ✅ | `openai/text-embedding-3-small` via OpenRouter |
| Local Embeddings | ✅ | `sentence-transformers` (opt-in, `USE_LOCAL_EMBEDDINGS=true`) |
| Hybrid Search | ✅ | Vector (semantic) + keyword search combined |
| HyDE Query Transform | ✅ | Hypothetical Document Embeddings for better retrieval |
| Multi-Query Generation | ✅ | Multiple query rephrasing for wider net |
| Recursive Chunking | ✅ | 800 chars / 200 overlap — default, general-purpose |
| Semantic Chunking | ✅ | 500 chars / 100 overlap — structured documents |
| Document Re-ranking | ✅ | Cross-encoder re-sort after initial retrieval |
| Knowledge Graph RAG | ✅ | LightRAG entity/relationship extraction + graph queries |
| Knowledge Graph UI | ✅ | Interactive visualisation (sigma.js + graphology) |
| Persistent Memory | ✅ | Mem0 — cross-session memory, fact extraction via LLM |
| Conversation History | ✅ | Last N messages kept for contextual follow-ups |
| Redis Response Cache | ✅ | 1-hour TTL, keyed on `bot_id + query` hash |

## Infrastructure

| Component | Technology | Port | Notes |
|-----------|------------|------|-------|
| API Gateway | Go 1.21 + Gin | 8080 | Rate limit 100 rps, Redis cache |
| Backend API | Python 3.11 + FastAPI | 8000 | SQLAlchemy, Pydantic v2, Celery |
| Frontend | React 19 + TypeScript 5.9 + Vite | 5173 | Tailwind CSS 4, Zustand, TanStack Query |
| PostgreSQL | 15-alpine | 5433 | Primary relational store |
| MongoDB | 7.0 | 27017 | Chat logs, conversation history |
| Redis | 7-alpine | 6380 | Celery broker, gateway cache, rate limiting |
| Qdrant | latest | 6333 | Vector DB with HNSW indexing |
| MinIO | latest | 9000/9001 | S3-compatible document storage |
| Celery | — | — | Async document processing worker |

## Integrations & Channels

| Feature | Status | Description |
|---------|--------|-------------|
| Zalo Bot | ✅ | Webhook-based Zalo OA integration via Func.vn Hub |
| Zalo Bot Async Tasks | ✅ | Celery tasks for Zalo message handling |
| External Integrations | ✅ | `/integrations` endpoint for third-party hooks |
| OpenRouter Provider Fallback | ✅ | Automatic model fallback on failure |

## Frontend Pages

| Page | Route | Description |
|------|-------|-------------|
| Landing | `/` | Marketing / intro page |
| Auth | `/auth` | Login / Register |
| Dashboard | `/dashboard` | Stats overview |
| Bots | `/bots` | Bot list & management |
| Bot Wizard | `/bots/new` | Guided bot creation |
| Bot Config | `/bots/:id/config` | Detailed bot configuration |
| Bot Studio | `/bots/:id/studio` | Visual bot editor |
| Chat | `/bots/:id/chat` | RAG chat interface |
| Knowledge Graph | `/bots/:id/knowledge-graph` | Graph visualisation |
| Documents | `/documents` | Document management |
| Analytics | `/analytics` | Usage analytics |
| Settings | `/settings` | User & tenant settings |
