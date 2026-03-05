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
  - `openrouter_rag_service.py` — Main RAG pipeline (hybrid search, reranking, query transformation)
  - `lightrag_service.py` — Knowledge graph RAG (entity/relationship extraction via LightRAG-HKU)
  - `memory_service.py` — Persistent conversation memory via Mem0
- `models/` — SQLAlchemy ORM models
- `schemas/` — Pydantic v2 request/response schemas
- `tasks/` — Celery async tasks (document processing, Zalo bot tasks)
- `core/config.py` — All configuration via `Settings` class (reads from `backend/.env`)

### Frontend Structure (`frontend/src/`)
- `api/` — Axios-based API client with JWT interceptors (`client.ts` auto-attaches Bearer token)
- `pages/` — 14 page components (Dashboard, Bots, Documents, Chat, KnowledgeGraph, Analytics, etc.)
- `store/` — Zustand store (`authStore` for JWT + user state)
- `components/` — Layout, UI primitives, forms

### Key RAG Pipeline Details
The main chat endpoint is `POST /api/v1/openrouter/rag/chat`. It:
1. Performs hybrid search (keyword + semantic) in Qdrant
2. Applies multi-stage ranking/reranking
3. Optionally queries LightRAG knowledge graph
4. Queries OpenRouter LLM API (400+ models available)
5. Updates Mem0 memory with conversation context

### Authentication
- JWT tokens, 30-minute expiry
- Frontend stores token in Zustand + localStorage via `authStore`
- All API requests auto-attach `Authorization: Bearer <token>` via Axios interceptor in `api/client.ts`

## Environment Configuration

Backend config lives in `backend/.env`. Key variables in `backend/app/core/config.py`:
- `OPENROUTER_API_KEY` — Primary LLM provider
- `DATABASE_URL` — PostgreSQL connection
- `REDIS_URL` — Redis connection
- `QDRANT_HOST/PORT` — Vector DB
- `MINIO_*` — Object storage credentials
- `SECRET_KEY` — JWT signing key (required in production)
- `MEM0_*` — Memory service configuration
- `ZALO_*` — Zalo integration webhook credentials

## Important Patterns

### Adding a New API Endpoint
1. Create route handler in `backend/app/api/v1/endpoints/`
2. Add Pydantic schemas in `backend/app/schemas/`
3. Register router in `backend/app/api/api.py`
4. Add corresponding API call in `frontend/src/api/`

### Background Tasks
Use Celery tasks in `backend/app/tasks/` for long-running operations (document embedding, external API calls). Redis is the broker.

### Document Processing Pipeline
Documents are uploaded to MinIO → Celery task chunks and embeds via `sentence-transformers` → stored in Qdrant with metadata → available for RAG retrieval.

### Knowledge Graph
LightRAG stores graph data in `backend/rag_storage/` (untracked, local). The `KnowledgeGraphPage` component visualizes entities/relationships using `@react-sigma/core` + `graphology`.

## Tech Stack Quick Reference
- **Backend**: FastAPI, SQLAlchemy 2.0, Pydantic v2, LangChain, LightRAG-HKU, Mem0, sentence-transformers, Celery
- **Frontend**: React 19, TypeScript 5.9, Vite (rolldown-vite), Tailwind CSS 4, Zustand, TanStack Query, Framer Motion
- **Gateway**: Go 1.21, Gin, go-redis, zap logger
