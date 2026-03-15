# OmniRAG

OmniRAG is a production-ready RAG (Retrieval-Augmented Generation) platform that lets you create, manage, and chat with AI agents grounded in your own data.

## Architecture Overview

```
Browser → Go Gateway (:8080) → FastAPI Backend (:8000) → Data Stores
```

| Service | Port | Description |
|---------|------|-------------|
| Frontend (React + Vite) | 5173 | Main UI |
| Go API Gateway | 8080 | CORS, caching, rate limiting |
| FastAPI Backend | 8000 | Core API & RAG logic |
| PostgreSQL 15 | 5433 | Users, bots, documents metadata |
| MongoDB 7 | 27017 | Chat logs, conversation history |
| Redis 7 | 6380 | Celery broker, gateway cache |
| Qdrant | 6333 | Vector embeddings |
| MinIO | 9000/9001 | File storage (S3-compatible) |

## Quick Start

### Prerequisites
- Docker & Docker Compose
- OpenRouter API Key (get one at openrouter.ai)

### 1. Configure

```bash
cd backend
cp .env.example .env
# Edit .env — at minimum set:
#   OPENROUTER_API_KEY=sk-or-...
#   SECRET_KEY=$(openssl rand -hex 32)
```

### 2. Run

```bash
cd ..
docker compose up -d --build
```

### 3. Access

| URL | Description |
|-----|-------------|
| http://localhost:5173 | Frontend UI |
| http://localhost:8080 | API Gateway |
| http://localhost:8000/docs | Swagger / ReDoc |
| http://localhost:9001 | MinIO Console (minioadmin/minioadmin) |
| http://localhost:6333/dashboard | Qdrant Dashboard |

## Key Features

### AI & RAG
- **Domain-Aware RAG** — 4 specialized domains: General, Education (sentence chunking + KG), Legal (article chunking + hybrid KG), Sales (dense retrieval)
- **HyDE** — Hypothetical Document Embedding: embed a generated passage instead of the raw query for better semantic recall
- **Multi-Query Fusion** — 3 query variants searched in parallel, merged via Reciprocal Rank Fusion
- **Contextual Retrieval** — Anthropic technique: situating context prepended to each chunk at index time
- **CRAG** — Corrective RAG: classify retrieval quality, prevent hallucination when KB lacks an answer
- **Parent-Child Chunking** — child chunks for precise matching, parent text returned to LLM for full context
- **Hybrid Search** — vector (semantic) + BM25 keyword, merged via RRF, reranked by Cross-Encoder (`BAAI/bge-reranker-v2-m3`)
- **Knowledge Graph** — LightRAG entity/relationship extraction + interactive graph visualisation
- **Persistent Memory** — Mem0 cross-session fact extraction and retrieval
- **400+ AI Models** via OpenRouter (GPT-4o, Claude, Gemini, Llama, ...)

### Platform
- **Bot Wizard** — guided creation with domain selector (General / Education / Legal / Sales)
- **Dashboard** — real-time stats, recent conversations, agent status panel
- **Streaming Chat** — SSE-based streaming responses
- **Document Processing** — PDF, DOCX, PPTX, TXT via Celery async jobs
- **Multi-tenancy** — full data isolation per organisation
- **Zalo Bot Integration** — webhook-based channel support
- **Go API Gateway** — Redis caching (1h TTL), rate limiting (100 rps), structured logging

## Documentation

All detailed guides live in `docs/`:

| File | Description |
|------|-------------|
| [QUICK_START.md](docs/QUICK_START.md) | 5-minute workflow walkthrough |
| [STARTUP_GUIDE.md](docs/STARTUP_GUIDE.md) | Full setup & env config |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, RAG pipeline, ingestion flow |
| [FEATURES.md](docs/FEATURES.md) | Complete feature list |
| [ADVANCED_RAG_FEATURES.md](docs/ADVANCED_RAG_FEATURES.md) | RAG pipeline deep-dive (HyDE, CRAG, Multi-Query, etc.) |
| [API_REFERENCE.md](docs/API_REFERENCE.md) | All API endpoints |
| [GATEWAY_QUICKSTART.md](docs/GATEWAY_QUICKSTART.md) | Go Gateway setup |
| [DATABASE_GUIDE.md](docs/DATABASE_GUIDE.md) | Database access & queries |
| [ZALO_BOT_INTEGRATION_PLAN.md](docs/ZALO_BOT_INTEGRATION_PLAN.md) | Zalo channel integration |
