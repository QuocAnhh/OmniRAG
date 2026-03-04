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

- **400+ AI Models** via OpenRouter (GPT-4o, Claude, Gemini, Llama, ...)
- **Hybrid RAG**: semantic + keyword search with re-ranking
- **Knowledge Graph** powered by LightRAG (entity/relationship extraction)
- **Persistent Memory** via Mem0 (cross-session conversation context)
- **Multi-tenancy**: full data isolation per organisation
- **Document Processing**: PDF, DOCX, PPTX, TXT via Celery async jobs
- **Zalo Bot Integration**: webhook-based channel support
- **Go API Gateway**: caching (1h TTL), rate limiting (100 rps), structured logging

## Documentation

All detailed guides live in `docs/`:

| File | Description |
|------|-------------|
| [QUICK_START.md](docs/QUICK_START.md) | 5-minute workflow walkthrough |
| [STARTUP_GUIDE.md](docs/STARTUP_GUIDE.md) | Full setup & env config |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design & components |
| [FEATURES.md](docs/FEATURES.md) | Complete feature list |
| [API_REFERENCE.md](docs/API_REFERENCE.md) | All API endpoints |
| [ADVANCED_RAG_FEATURES.md](docs/ADVANCED_RAG_FEATURES.md) | RAG pipeline deep-dive |
| [GATEWAY_QUICKSTART.md](docs/GATEWAY_QUICKSTART.md) | Go Gateway setup |
| [DATABASE_GUIDE.md](docs/DATABASE_GUIDE.md) | Database access & queries |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common fixes |

## Scripts

```bash
cd scripts
python validate_env.py        # Check env variables
python test_full_system.py    # End-to-end API test suite
bash test_all_apis.sh         # Test all endpoints via curl
```

## License
MIT
