# Startup Guide — OmniRAG

Hướng dẫn chi tiết để setup và chạy OmniRAG ở môi trường local/production.

---

## Prerequisites

- Docker 24+ & Docker Compose v2
- OpenRouter API Key (bắt buộc) — đăng ký tại openrouter.ai
- macOS/Linux (Windows: dùng WSL2)

---

## 1. Environment Configuration

Tạo file `backend/.env` từ template:

```bash
cd backend
cp .env.example .env
```

### Biến bắt buộc

```env
# AI Provider — đây là key chính, thay thế OpenAI
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxx

# JWT secret — generate với: openssl rand -hex 32
SECRET_KEY=your_64_char_hex_string_here

# Môi trường
ENVIRONMENT=development
```

### Biến tuỳ chọn (có default)

```env
# Models (có thể override per-bot trong config)
OPENROUTER_CHAT_MODEL=openai/gpt-4o-mini
OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small

# Knowledge Graph — LLM dùng để extract entities
LIGHTRAG_LLM_MODEL=openai/gpt-4.1-mini

# Mem0 — persistent memory
MEM0_ENABLED=true
MEM0_MEMORY_MODEL=openai/gpt-4o-mini
MEM0_TOP_K=5

# Local embeddings (thay thế OpenRouter cho embeddings, tốn RAM hơn)
USE_LOCAL_EMBEDDINGS=false
LOCAL_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2

# Database — default phù hợp với docker-compose
POSTGRES_SERVER=db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_DB=omnirag

MONGODB_URL=mongodb://admin:password@mongodb:27017
REDIS_URL=redis://redis:6379/0

MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

QDRANT_HOST=qdrant
QDRANT_PORT=6333

# Zalo Integration (chỉ cần nếu dùng Zalo bot)
PUBLIC_URL=https://your-domain.com
FUNC_API_URL=https://func.vn/api/...
FUNC_API_TOKEN=your_func_token
```

> **Production:** Bắt buộc đổi `POSTGRES_PASSWORD`, `MINIO_SECRET_KEY`, `SECRET_KEY`. Set `ENVIRONMENT=production`.

---

## 2. Chạy với Docker Compose (Recommended)

### Development

```bash
# Từ root project
docker compose up -d --build

# Xem logs
docker compose logs -f backend
docker compose logs -f gateway
docker compose logs -f celery_worker
```

### Chỉ build lại backend (khi sửa requirements)

```bash
docker compose build backend celery_worker
docker compose up -d backend celery_worker
```

### Production

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 3. Chạy local (không Docker)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Chạy migrations
alembic upgrade head

# Start API server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Start Celery worker (terminal riêng)
celery -A app.worker worker --loglevel=info
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # Dev server tại :5173
npm run build      # Production build → dist/
npm run lint       # ESLint check
```

### Gateway

```bash
cd gateway
go mod download
go run main.go
# Hoặc build binary
go build -o gateway && ./gateway
```

---

## 4. Port Map

| Service | External Port | Internal Port | Notes |
|---------|--------------|--------------|-------|
| Frontend | 5173 | 5173 | Vite dev server |
| Gateway | 8080 | 8080 | Điểm vào chính cho client |
| Backend | 8000 | 8000 | FastAPI |
| PostgreSQL | **5433** | 5432 | Dùng 5433 để tránh conflict |
| MongoDB | 27017 | 27017 | |
| Redis | **6380** | 6379 | Dùng 6380 để tránh conflict |
| Qdrant | 6333 | 6333 | Vector DB UI tại /dashboard |
| MinIO API | 9000 | 9000 | S3-compatible endpoint |
| MinIO UI | 9001 | 9001 | Web console |

> Client (frontend/postman) cần gọi qua **Gateway (:8080)**. Backend (:8000) là internal.

---

## 5. Database Migrations

```bash
cd backend
source venv/bin/activate

# Apply all pending migrations
alembic upgrade head

# Rollback 1 migration
alembic downgrade -1

# Tạo migration mới (sau khi sửa models)
alembic revision --autogenerate -m "add_new_field_to_bots"

# Xem lịch sử
alembic history
```

---

## 6. Health Checks

```bash
# Gateway (kiểm tra cả Redis + Backend)
curl http://localhost:8080/health

# Backend trực tiếp
curl http://localhost:8000/api/v1/health

# PostgreSQL
docker exec omnirag-db-1 pg_isready -U postgres -d omnirag

# Redis
docker exec omnirag-redis-1 redis-cli ping

# Qdrant
curl http://localhost:6333/collections
```

Expected khi mọi thứ healthy:
```json
{
  "status": "healthy",
  "redis": "healthy",
  "backend": "healthy",
  "service": "omnirag-gateway"
}
```

---

## 7. Ollama (Local LLM — Optional)

Dự án có hỗ trợ Ollama cho môi trường không có internet hoặc muốn chạy model local.

**macOS (M1/M2/M3 — Recommended, Metal GPU):**
```bash
brew install ollama
ollama serve
ollama pull qwen2.5:14b  # Hoặc model khác
```

**Linux (Docker):** Uncomment block `ollama` trong `docker-compose.yml`.

Sau đó set env:
```env
LIGHTRAG_LLM_MODEL=qwen2.5:14b
```
Và cấu hình backend trỏ về `http://localhost:11434`.

---

## 8. Logs & Debugging

```bash
# Tất cả services
docker compose logs -f

# Chỉ backend
docker compose logs -f backend

# Celery worker (document processing)
docker compose logs -f celery_worker

# Filter lỗi
docker compose logs backend 2>&1 | grep -i "error\|exception"

# LightRAG knowledge graph
docker compose logs backend 2>&1 | grep -i "lightrag\|graph"
```

---

## 9. Reset & Clean

```bash
# Restart một service
docker compose restart backend

# Rebuild + restart
docker compose up -d --build backend

# Xoá toàn bộ (WARNING: mất dữ liệu)
docker compose down -v
docker system prune -a --volumes

# Xoá chỉ knowledge graph data
rm -rf backend/rag_storage/
```

---

Gặp lỗi? Xem [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
