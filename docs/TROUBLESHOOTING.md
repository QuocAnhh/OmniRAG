# Troubleshooting

Các lỗi phổ biến và cách fix.

---

## Backend

### ImportError: No module named 'fastapi'

```bash
cd backend
pip install -r requirements.txt
```

Hoặc trong Docker:
```bash
docker compose build --no-cache backend
```

---

### Database connection error

```bash
# Kiểm tra services đang chạy
docker compose ps

# Restart DB services
docker compose restart db mongodb redis
```

Nếu dùng local (không Docker), đảm bảo `POSTGRES_SERVER=localhost` trong `.env`.

---

### Alembic migration errors

```bash
# Reset hoàn toàn (WARNING: mất dữ liệu)
cd backend
alembic downgrade base
alembic upgrade head
```

---

### Port conflict — Redis 6379 already in use

Redis được map sang port **6380** (external) để tránh conflict:
```yaml
redis:
  ports:
    - "6380:6379"  # External:Internal
```

Nếu vẫn conflict, đổi sang 6381:
```yaml
  ports:
    - "6381:6379"
```

---

### Port conflict — PostgreSQL 5432 already in use

Tương tự, PostgreSQL dùng port **5433** (external):
```yaml
db:
  ports:
    - "5433:5432"
```

---

### Backend không start — "SECRET_KEY must be set in production"

```bash
# Generate key
openssl rand -hex 32

# Thêm vào backend/.env
SECRET_KEY=<output trên>
```

---

## Frontend

### Module not found errors

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

---

### API connection issues (CORS, 401, Network Error)

1. Kiểm tra `VITE_API_URL` trong `docker-compose.yml` hoặc `frontend/.env`:
   ```env
   VITE_API_URL=http://localhost:8080  # Phải trỏ tới Gateway, không phải 8000
   ```
2. Kiểm tra Gateway đang chạy: `curl http://localhost:8080/health`
3. Xem browser console để xem CORS error cụ thể

---

### Vite proxy / hot reload không hoạt động

```bash
docker compose restart frontend
# hoặc local:
npm run dev
```

---

## RAG & AI

### "Invalid API key" / OpenRouter 401

```bash
# Kiểm tra key trong .env
cat backend/.env | grep OPENROUTER_API_KEY
```

Đảm bảo key có prefix `sk-or-`. Lấy key mới tại openrouter.ai.

---

### Qdrant collection not found

Collection được tạo tự động khi upload document đầu tiên. Nếu lỗi:
```bash
docker compose restart qdrant
```

---

### Document upload / processing failed

```bash
# Xem Celery worker logs (document xử lý ở đây)
docker compose logs -f celery_worker
```

Nguyên nhân phổ biến:
- File quá lớn (>100MB)
- Format không hỗ trợ (chỉ hỗ trợ PDF, DOCX, PPTX, TXT)
- MinIO unavailable — `docker compose restart minio`
- OpenRouter embedding API lỗi — kiểm tra API key

---

### RAG response chậm

Checklist:
1. Redis cache đang hoạt động? `docker compose logs gateway | grep -i "cache"`
2. Qdrant indexing OK? Xem `http://localhost:6333/dashboard`
3. Knowledge graph bật không cần thiết? Thử disable: `"enable_knowledge_graph": false`
4. Giảm `top_k` xuống 3

---

### Knowledge Graph không hiển thị dữ liệu

1. Kiểm tra document đã được xử lý xong chưa (`status: "completed"`)
2. Xem logs LightRAG:
   ```bash
   docker compose logs backend 2>&1 | grep -i "lightrag"
   ```
3. Kiểm tra `rag_storage/` directory có data không:
   ```bash
   ls backend/rag_storage/
   ```
4. `LIGHTRAG_LLM_MODEL` trong `.env` có hợp lệ không

---

### Mem0 memory không hoạt động

```bash
# Kiểm tra config
cat backend/.env | grep MEM0

# Expected:
# MEM0_ENABLED=true
# MEM0_MEMORY_MODEL=openai/gpt-4o-mini
```

Mem0 cần `session_id` nhất quán để link memories giữa các sessions.

---

## Docker

### Port already in use

```bash
# Tìm process đang dùng port
lsof -ti:8080 | xargs kill  # macOS/Linux

# Hoặc đổi port trong docker-compose.yml
```

---

### Build fails / OOM during build

```bash
# Clean rebuild
docker compose down -v
docker system prune -a
docker compose build --no-cache
docker compose up -d
```

---

### Tên container không đúng (docker exec fails)

```bash
# Kiểm tra tên container thực tế
docker ps --format "table {{.Names}}\t{{.Image}}"
```

Tên container thường có dạng `omnirag-<service>-1`.

---

## Database Access

### PostgreSQL

```bash
docker exec -it omnirag-db-1 psql -U postgres -d omnirag

# Useful queries:
\dt                               -- list tables
SELECT id, name FROM bots;
SELECT filename, status FROM documents WHERE status='failed';
```

### MongoDB

```bash
docker exec -it omnirag-mongodb-1 mongosh -u admin -p password --authenticationDatabase admin

use omnirag
show collections
db.conversations.find().sort({timestamp: -1}).limit(5).pretty()
```

### Redis

```bash
docker exec -it omnirag-redis-1 redis-cli

KEYS rag_cache:*        # RAG response cache
KEYS *                  # All keys
FLUSHALL                # Clear all (WARNING)
```

### Qdrant

```bash
# List collections
curl http://localhost:6333/collections

# Collection details
curl http://localhost:6333/collections/omnirag_advanced
```

### MinIO

Web Console: http://localhost:9001 (minioadmin / minioadmin)
