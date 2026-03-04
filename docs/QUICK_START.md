# Quick Start Guide — OmniRAG

5 phút để chạy OmniRAG từ đầu.

## Bước 1: Cấu hình môi trường

```bash
cd backend
cp .env.example .env
```

Sửa `backend/.env`, tối thiểu cần 2 biến:

```env
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxx   # Lấy tại openrouter.ai
SECRET_KEY=<output của: openssl rand -hex 32>
```

## Bước 2: Start services

```bash
cd ..
docker compose up -d --build

# Kiểm tra trạng thái
docker compose ps
```

Đợi ~30 giây. Các services sẽ start theo thứ tự: DB → Redis → Qdrant → MinIO → Backend → Gateway → Frontend.

## Bước 3: Verify

```bash
# Gateway health
curl http://localhost:8080/health

# Expected:
# {"status":"healthy","redis":"healthy","backend":"healthy"}
```

Truy cập:
- **UI**: http://localhost:5173
- **Swagger**: http://localhost:8000/docs
- **MinIO**: http://localhost:9001 (minioadmin / minioadmin)
- **Qdrant**: http://localhost:6333/dashboard

---

## Workflow cơ bản qua API

### A. Đăng ký tài khoản

```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "password": "Demo123456!",
    "full_name": "Demo User",
    "tenant_name": "Demo Corp"
  }'
```

### B. Đăng nhập — lấy token

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=demo@example.com&password=Demo123456!"
```

Lưu `access_token` từ response. Tất cả request sau cần header:
```
Authorization: Bearer <access_token>
```

### C. Tạo bot

```bash
curl -X POST http://localhost:8080/api/v1/bots \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First Bot",
    "description": "Demo bot",
    "config": {
      "llm_model": "openai/gpt-4o-mini",
      "temperature": 0.7,
      "enable_knowledge_graph": true,
      "enable_memory": true
    }
  }'
```

Lưu `id` (bot_id) từ response.

### D. Upload tài liệu

```bash
curl -X POST http://localhost:8080/api/v1/bots/$BOT_ID/documents \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/document.pdf" \
  -F "chunking_strategy=recursive"
```

Chờ `status: "completed"` — Celery sẽ xử lý async (thường 10–60 giây tuỳ file size).

Kiểm tra trạng thái:
```bash
curl http://localhost:8080/api/v1/bots/$BOT_ID/documents \
  -H "Authorization: Bearer $TOKEN"
```

### E. Chat với bot

```bash
curl -X POST http://localhost:8080/api/v1/bots/$BOT_ID/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Tóm tắt nội dung tài liệu cho tôi",
    "history": []
  }'
```

---

## Test nhanh qua UI

1. Mở http://localhost:5173
2. Đăng ký / Đăng nhập
3. Tạo bot ở trang **Bots**
4. Upload tài liệu ở tab **Documents** trong bot config
5. Chat tại trang **Chat**
6. Xem Knowledge Graph tại **Knowledge Graph** (nếu `enable_knowledge_graph: true`)

---

## Test advanced features

### Caching (request nhanh hơn lần 2)

```bash
# Lần 1 — ~1-3 giây, header X-Cache: MISS
# Lần 2 (cùng query) — <50ms, header X-Cache: HIT
curl -v -X POST http://localhost:8080/api/v1/bots/$BOT_ID/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "What is this document about?", "history": []}'
```

### Knowledge Graph

```bash
# Xem entities/relationships đã extract
curl http://localhost:8080/api/v1/bots/$BOT_ID/knowledge-graph \
  -H "Authorization: Bearer $TOKEN"
```

Hoặc mở http://localhost:5173/bots/$BOT_ID/knowledge-graph để xem đồ thị tương tác.

### Conversation Memory (Mem0)

Gửi nhiều tin nhắn — bot sẽ nhớ context qua các session nhờ Mem0:

```bash
curl -X POST http://localhost:8080/api/v1/bots/$BOT_ID/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Các điểm chính của chương 2 là gì?",
    "history": [
      {"role":"user","content":"Tài liệu này nói về gì?"},
      {"role":"assistant","content":"Tài liệu này nói về ..."}
    ],
    "session_id": "user-abc-session-1"
  }'
```

---

## Monitor & Debug

```bash
# Backend logs
docker compose logs -f backend

# Xem cache hit
docker compose logs backend | grep -i "cache"

# Celery worker (document processing)
docker compose logs -f celery_worker

# Redis cache keys
docker exec -it omnirag-redis-1 redis-cli KEYS "rag_cache:*"

# Qdrant collections
curl http://localhost:6333/collections

# PostgreSQL
docker exec -it omnirag-db-1 psql -U postgres -d omnirag -c "SELECT name, id FROM bots;"
```

---

## Tips

- Dùng `openai/gpt-4o-mini` cho queries thông thường (nhanh + rẻ)
- Dùng `openai/gpt-4o` hoặc `anthropic/claude-3.5-sonnet` cho reasoning phức tạp
- `chunking_strategy=semantic` tốt hơn cho tài liệu có cấu trúc (FAQ, manual)
- `chunking_strategy=recursive` là default, tốt cho văn bản thông thường
- Bật `enable_knowledge_graph=true` để extract entities — hữu ích cho tài liệu nhiều khái niệm

---

Gặp lỗi? Xem [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
