# Quick Start Guide - OmniRAG

Hướng dẫn nhanh để bắt đầu sử dụng OmniRAG trong 5 phút.

## 🚀 Bước 1: Setup môi trường (2 phút)

### 1.1. Clone và setup

```bash
cd OmniRAG
```

### 1.2. Tạo file `.env`

Tạo file `backend/.env` với nội dung:

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
SECRET_KEY=your-secret-key-minimum-32-characters-long
```

**Generate SECRET_KEY**:
```bash
openssl rand -hex 32
```

### 1.3. Start services

```bash
# Build và start
docker compose build backend
docker compose up -d

# Check status
docker compose ps
```

Đợi ~30 giây để các services khởi động.

## 🧪 Bước 2: Test API (3 phút)

### 2.1. Import Postman Collection

1. Mở Postman
2. Click **Import**
3. Chọn file `POSTMAN_COLLECTION.json`
4. Collection "OmniRAG API" sẽ xuất hiện

### 2.2. Workflow test cơ bản

**A. Register** → **B. Login** → **C. Create Bot** → **D. Upload Document** → **E. Chat**

#### A. Register (tạo tài khoản)

```
POST http://localhost:8000/api/v1/auth/register
```

Body (JSON):
```json
{
  "email": "test@example.com",
  "password": "Test123456!",
  "full_name": "Test User",
  "tenant_name": "Test Company"
}
```

✅ Response → Copy `id` (user_id)

#### B. Login (lấy token)

```
POST http://localhost:8000/api/v1/auth/login
```

Body (x-www-form-urlencoded):
```
username=test@example.com
password=Test123456!
```

✅ Response → **Copy `access_token`** (dùng cho tất cả request sau)

**⚠️ Quan trọng**: Thêm vào tất cả request sau:
```
Header: Authorization: Bearer <access_token>
```

#### C. Create Bot

```
POST http://localhost:8000/api/v1/bots
Header: Authorization: Bearer <token>
```

Body (JSON):
```json
{
  "name": "My First Bot",
  "description": "Test bot",
  "config": {
    "llm_model": "gpt-3.5-turbo",
    "temperature": 0.7
  }
}
```

✅ Response → **Copy `id`** (bot_id) và `api_key`

#### D. Upload Document

```
POST http://localhost:8000/api/v1/bots/<bot_id>/documents
Header: Authorization: Bearer <token>
```

Body (form-data):
```
file: [Chọn file PDF/DOCX/TXT]
chunking_strategy: recursive
```

✅ Response → Kiểm tra `status: "completed"`

#### E. Chat với Bot

```
POST http://localhost:8000/api/v1/bots/<bot_id>/chat
Header: Authorization: Bearer <token>
```

Body (JSON):
```json
{
  "message": "Summarize the document for me",
  "history": []
}
```

✅ Response → Nhận câu trả lời từ RAG system!

## 🎯 Test Advanced Features

### Test 1: Caching (response nhanh hơn)

Gửi **exact same query** 2 lần:
- Lần 1: ~2-3 giây (query + LLM)
- Lần 2: <500ms (từ cache) ⚡

### Test 2: Conversation History

```json
{
  "message": "What are the pricing options?",
  "history": [
    {"role": "user", "content": "Tell me about features"},
    {"role": "assistant", "content": "Features include..."}
  ]
}
```

Bot sẽ hiểu context từ history.

### Test 3: Semantic vs Recursive Chunking

Upload cùng 1 file với 2 strategies khác nhau:

**Recursive** (default):
```
chunking_strategy=recursive
```

**Semantic** (tối ưu cho docs có cấu trúc):
```
chunking_strategy=semantic
```

So sánh độ chính xác của câu trả lời.

## 📊 Monitor & Debug

### View logs realtime

```bash
# Backend logs
docker compose logs -f backend

# Check for "Cache hit" messages
docker compose logs backend | grep "Cache"
```

### Check services health

```bash
# API docs
open http://localhost:8000/docs

# Qdrant dashboard
open http://localhost:6333/dashboard

# MinIO console
open http://localhost:9001
# Login: minioadmin / minioadmin
```

### Database inspection

```bash
# PostgreSQL - check bots
docker exec -it omnirag-db-1 psql -U postgres -d omnirag -c "SELECT id, name, api_key FROM bots;"

# Redis - check cache keys
docker exec -it omnirag-redis-1 redis-cli KEYS "rag_cache:*"

# Qdrant - check collections
curl http://localhost:6333/collections
```

## 🔥 Common Issues

### Issue 1: "Invalid API key"

**Fix**: Check `.env` file:
```bash
cat backend/.env | grep OPENAI_API_KEY
```

### Issue 2: Token expired (401)

**Fix**: Login lại và lấy token mới (TTL = 30 phút).

### Issue 3: Port conflict (Redis)

**Fix**: Đã đổi sang port 6380. Nếu vẫn conflict:
```bash
# Edit docker-compose.yml
redis:
  ports:
    - "6381:6379"  # Đổi sang 6381
```

### Issue 4: Backend không start

**Fix**:
```bash
# Rebuild without cache
docker compose build --no-cache backend
docker compose up -d backend

# Check logs
docker compose logs backend
```

## 📚 Next Steps

1. **Đọc full docs**: Xem `README.md` để hiểu rõ hơn về Architecture và Advanced Features
2. **Try different configs**: Thử GPT-4, đổi temperature, system_prompt
3. **Upload multiple documents**: Test RAG với knowledge base lớn hơn
4. **Monitor performance**: Xem logs để optimize chunking strategy

## 🎓 Tips

✅ **Security**: Đổi passwords mặc định trong production
✅ **Performance**: Enable caching bằng cách dùng exact same queries
✅ **Cost**: Dùng GPT-3.5-turbo cho queries đơn giản, GPT-4 cho complex reasoning
✅ **Accuracy**: Thử cả 2 chunking strategies và chọn cái tốt hơn cho use case của bạn

---

**Ready to build?** 🚀

Nếu có issues, check [Troubleshooting section trong README.md](README.md#troubleshooting)
