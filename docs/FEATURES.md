# OmniRAG Features

## Core Platform

| Feature | Status | Description |
|---------|--------|-------------|
| Multi-tenancy | ✅ | Full data isolation per organisation |
| JWT Authentication | ✅ | 30-minute token expiry, auto-refresh on frontend |
| Role-Based Access (RBAC) | ✅ | owner / admin / member roles |
| Bot Management | ✅ | Create, configure, clone, delete bots |
| Bot Templates | ✅ | Pre-built templates for common use-cases with domain badges |
| Bot Wizard | ✅ | Multi-step creation: template → domain selector → config → review |
| Domain Selection | ✅ | 4 domains: General / Education / Legal / Sales |
| Document Upload | ✅ | PDF, DOCX, PPTX, TXT — async via Celery |
| Dashboard | ✅ | Real-time stats, recent conversations, agent status panel |
| User Management | ✅ | Invite/manage users per tenant |

## AI & RAG Pipeline

| Feature | Status | Description |
|---------|--------|-------------|
| OpenRouter Integration | ✅ | 400+ models: GPT-4o, Claude, Gemini, Llama, ... |
| Default Chat Model | ✅ | `openai/gpt-4o-mini` (configurable per bot) |
| Default Embedding Model | ✅ | `openai/text-embedding-3-small` via OpenRouter |
| Query Rewriting | ✅ | Rewrites user query for search optimization before retrieval |
| HyDE | ✅ | Hypothetical Document Embedding — domain-aware, improves semantic recall |
| Multi-Query Fusion | ✅ | 2 extra query variants → 3× parallel search → RRF merge |
| Hybrid Search | ✅ | Vector (HyDE embed) + BM25 keyword → RRF → Cross-Encoder rerank |
| Contextual Retrieval | ✅ | Anthropic technique: situating prefix per chunk at index time |
| Parent-Child Chunking | ✅ | Child chunks for matching, parent text returned to LLM |
| CRAG | ✅ | Corrective RAG: classify retrieval quality, prevent hallucination |
| Recursive Chunking | ✅ | Default — hierarchy split, general-purpose |
| Sentence Chunking | ✅ | Rolling-window accumulator — Education domain |
| Article Chunking | ✅ | Vietnamese legal article (`Điều N`) boundary split — Legal domain |
| Domain Profiles | ✅ | Per-domain chunking, retrieval K, LightRAG mode, system prompt suffix |
| Cross-Encoder Reranking | ✅ | `BAAI/bge-reranker-v2-m3` multilingual model |
| Knowledge Graph RAG | ✅ | LightRAG entity/relationship extraction + graph queries |
| Knowledge Graph UI | ✅ | Interactive visualisation (sigma.js + graphology) |
| Persistent Memory | ✅ | Mem0 — cross-session fact extraction & retrieval |
| Conversation History | ✅ | Last N messages kept for contextual follow-ups |
| Redis Response Cache | ✅ | 1-hour TTL, keyed on `bot_id + query` hash |

## Infrastructure

| Component | Technology | Port | Notes |
|-----------|------------|------|-------|
| API Gateway | Go 1.21 + Gin | 8080 | Rate limit 100 rps, Redis cache |
| Backend API | Python 3.11 + FastAPI | 8000 | SQLAlchemy, Pydantic v2, Celery |
| Frontend | React 19 + TypeScript 5.9 + Vite | 5173 | Tailwind CSS 4, Zustand, Framer Motion |
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
| OpenRouter Provider Fallback | ✅ | Automatic model fallback on API failure |

## Frontend Pages

| Page | Route | Description |
|------|-------|-------------|
| Landing | `/` | Marketing / intro page |
| Auth | `/auth` | Login / Register |
| Dashboard | `/dashboard` | Stats tiles, recent conversations, agent status |
| Bots | `/bots` | Bot list — Chat is primary CTA |
| Bot Wizard | `/bots/new` | Template → Domain → Config → Review |
| Bot Config | `/bots/:id/config` | Full advanced controls, domain badge, KG auto-enable |
| Chat | `/bots/:id/chat` | Streaming RAG chat interface |
| Knowledge Graph | `/bots/:id/graph` | Interactive entity/relationship visualisation |
| Settings | `/settings` | User & tenant settings |
| Zalo Bot Guide | `/docs/zalo-bot` | Public integration guide |
