# OmniRAG - Multi-tenant RAG System with Advanced Features

Hệ thống RAG (Retrieval-Augmented Generation) đa thuê bao với các tính năng tối ưu hóa nâng cao.

## 📋 Mục lục

- [Tính năng](#tính-năng)
- [Kiến trúc hệ thống](#kiến-trúc-hệ-thống)
- [Cài đặt và Cấu hình](#cài-đặt-và-cấu-hình)
- [Chạy dự án](#chạy-dự-án)
- [API Documentation](#api-documentation)
- [Test với Postman](#test-với-postman)
- [Advanced RAG Features](#advanced-rag-features)
- [Troubleshooting](#troubleshooting)

## 🚀 Tính năng

### Core Features
- ✅ **Multi-tenancy**: Hỗ trợ nhiều tổ chức với dữ liệu được tách biệt hoàn toàn
- ✅ **JWT Authentication**: Xác thực người dùng với token-based authentication
- ✅ **Role-Based Access Control (RBAC)**: Phân quyền owner/admin/member
- ✅ **Bot Management**: Tạo và quản lý nhiều chatbot với API key riêng
- ✅ **Document Processing**: Upload và xử lý PDF, DOCX, PPTX, TXT

### Advanced RAG Features
- ✅ **Hybrid Search**: Kết hợp vector search (semantic) và keyword matching
- ✅ **Query Transformation**: 
  - HyDE (Hypothetical Document Embeddings)
  - Multi-query generation
- ✅ **Advanced Chunking Strategies**:
  - Recursive splitting (800 chars, 200 overlap)
  - Semantic splitting (500 chars, 100 overlap)
- ✅ **Document Re-ranking**: Sắp xếp lại documents theo độ liên quan
- ✅ **Redis Caching**: Cache responses với TTL 1 giờ
- ✅ **Conversation History**: Hỗ trợ ngữ cảnh hội thoại (5 messages cuối)
- ✅ **Multiple LLM Support**: GPT-3.5-turbo / GPT-4 configurable

### Infrastructure
- ✅ **PostgreSQL**: Database chính với Alembic migrations
- ✅ **MongoDB**: Lưu chat logs và analytics
- ✅ **Redis**: Caching và Celery broker
- ✅ **Qdrant**: Vector database với HNSW indexing
- ✅ **MinIO**: S3-compatible object storage
- ✅ **Celery**: Background task processing

## 🏗 Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                            │
│                    (Postman / React)                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                      FastAPI Backend                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Auth API     │  │ Bot API      │  │ Document API │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │        Advanced RAG Service                         │   │
│  │  - Hybrid Search   - Query Transform                │   │
│  │  - Re-ranking      - Caching                        │   │
│  └─────────────────────────────────────────────────────┘   │
└────┬────────┬─────────┬─────────┬────────┬────────┬────────┘
     │        │         │         │        │        │
     ↓        ↓         ↓         ↓        ↓        ↓
┌─────────┐ ┌────────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌────────┐
│PostgreSQL│ │MongoDB │ │Redis │ │Qdrant│ │MinIO │ │Celery  │
│  (Data) │ │ (Logs) │ │(Cache)│ │Vector││(Files)│ │Worker  │
└─────────┘ └────────┘ └──────┘ └──────┘ └──────┘ └────────┘
```

## 📦 Cài đặt và Cấu hình

### Prerequisites

- Docker & Docker Compose V2
- OpenAI API Key

### 1. Clone project

```bash
git clone <your-repo>
cd OmniRAG
```

### 2. Cấu hình Environment Variables

Tạo file `.env` trong thư mục `backend/`:

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here

# JWT Secret (generate với: openssl rand -hex 32)
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Database
POSTGRES_SERVER=db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_DB=omnirag

# MongoDB
MONGODB_URL=mongodb://admin:password@mongodb:27017

# Redis (lưu ý: container internal port là 6379, external là 6380)
REDIS_URL=redis://redis:6379/0

# MinIO
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=omnirag-documents

# Qdrant
QDRANT_HOST=qdrant
QDRANT_PORT=6333
```

### 3. Cấu hình Docker Compose

File `docker-compose.yml` đã được config sẵn với các services:

- **PostgreSQL**: Port 5432
- **MongoDB**: Port 27017
- **Redis**: Port **6380** (external) → 6379 (internal)
- **MinIO**: Ports 9000 (API), 9001 (Console)
- **Qdrant**: Port 6333
- **Backend**: Port 8000
- **Celery Worker**: Background tasks

### 4. Database Migrations

Migrations đã được setup sẵn với Alembic. Khi khởi động backend lần đầu, database sẽ tự động migrate.

Để tạo migration mới (nếu cần):

```bash
# Vào backend container
docker exec -it omnirag-backend-1 bash

# Tạo migration
alembic revision --autogenerate -m "Description"

# Apply migration
alembic upgrade head
```

## 🚀 Chạy dự án

### Build và start tất cả services

```bash
# Build backend image
docker compose build backend

# Start all services
docker compose up -d

# Xem logs
docker compose logs -f backend
docker compose logs -f celery_worker

# Check status
docker ps
```

### Stop services

```bash
docker compose down

# Xóa cả volumes (reset database)
docker compose down -v
```

## 📚 API Documentation

Khi backend đã chạy, truy cập:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### API Endpoints

#### Authentication

- `POST /api/v1/auth/register` - Đăng ký tenant + user mới
- `POST /api/v1/auth/login` - Đăng nhập (nhận JWT token)
- `GET /api/v1/auth/me` - Lấy thông tin user hiện tại

#### Tenants

- `GET /api/v1/tenants/me` - Lấy thông tin tenant
- `PUT /api/v1/tenants/me` - Cập nhật tenant settings

#### Bots

- `POST /api/v1/bots` - Tạo bot mới
- `GET /api/v1/bots` - Danh sách bots
- `GET /api/v1/bots/{id}` - Chi tiết bot
- `PUT /api/v1/bots/{id}` - Cập nhật bot
- `DELETE /api/v1/bots/{id}` - Xóa bot

#### Documents

- `POST /api/v1/bots/{id}/documents` - Upload document (PDF/DOCX/PPTX/TXT)
- `GET /api/v1/bots/{id}/documents` - Danh sách documents
- `DELETE /api/v1/bots/{id}/documents/{doc_id}` - Xóa document

#### Chat

- `POST /api/v1/bots/{id}/chat` - Chat với bot (RAG-powered)

## 🧪 Test với Postman

### 1. Import Collection

Tạo Postman collection với các request sau:

### 2. Workflow Test đầy đủ

#### Step 1: Đăng ký Tenant + User

**Request**: `POST http://localhost:8000/api/v1/auth/register`

**Headers**:
```
Content-Type: application/json
```

**Body** (raw JSON):
```json
{
  "email": "admin@mycompany.com",
  "password": "SecurePass123!",
  "full_name": "John Doe",
  "tenant_name": "My Company",
  "tenant_settings": {
    "industry": "Technology",
    "max_bots": 10
  }
}
```

**Expected Response** (201 Created):
```json
{
  "id": "uuid-here",
  "email": "admin@mycompany.com",
  "full_name": "John Doe",
  "role": "owner",
  "tenant_id": "tenant-uuid-here",
  "is_active": true
}
```

#### Step 2: Đăng nhập và lấy Access Token

**Request**: `POST http://localhost:8000/api/v1/auth/login`

**Headers**:
```
Content-Type: application/x-www-form-urlencoded
```

**Body** (x-www-form-urlencoded):
```
username=admin@mycompany.com
password=SecurePass123!
```

**Expected Response** (200 OK):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**⚠️ QUAN TRỌNG**: Copy `access_token` này để dùng cho các request sau!

#### Step 3: Setup Environment Variable trong Postman

1. Tạo Environment mới tên "OmniRAG Local"
2. Thêm variable:
   - `base_url`: `http://localhost:8000`
   - `access_token`: Paste token từ Step 2
   - `bot_id`: (sẽ set sau khi tạo bot)

#### Step 4: Test Authentication - Get Current User

**Request**: `GET {{base_url}}/api/v1/auth/me`

**Headers**:
```
Authorization: Bearer {{access_token}}
```

**Expected Response** (200 OK):
```json
{
  "id": "uuid",
  "email": "admin@mycompany.com",
  "full_name": "John Doe",
  "role": "owner",
  "tenant_id": "tenant-uuid"
}
```

#### Step 5: Tạo Bot

**Request**: `POST {{base_url}}/api/v1/bots`

**Headers**:
```
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Body** (raw JSON):
```json
{
  "name": "Customer Support Bot",
  "description": "AI assistant for customer inquiries",
  "config": {
    "llm_model": "gpt-4",
    "temperature": 0.7,
    "max_tokens": 500,
    "system_prompt": "You are a helpful customer support assistant. Be polite and professional."
  }
}
```

**Expected Response** (201 Created):
```json
{
  "id": "bot-uuid-here",
  "name": "Customer Support Bot",
  "description": "AI assistant for customer inquiries",
  "tenant_id": "tenant-uuid",
  "api_key": "rag_abc123def456...",
  "config": {
    "llm_model": "gpt-4",
    "temperature": 0.7,
    "max_tokens": 500,
    "system_prompt": "..."
  },
  "created_at": "2026-01-11T10:30:00",
  "updated_at": "2026-01-11T10:30:00"
}
```

**⚠️ Lưu `bot_id`** vào Postman Environment!

#### Step 6: Upload Document (PDF)

**Request**: `POST {{base_url}}/api/v1/bots/{{bot_id}}/documents`

**Headers**:
```
Authorization: Bearer {{access_token}}
```

**Body** (form-data):
```
file: [Select PDF file]
chunking_strategy: semantic
```

**Query Parameters** (optional):
- `chunking_strategy`: `recursive` (default) hoặc `semantic`

**Expected Response** (201 Created):
```json
{
  "id": "doc-uuid",
  "bot_id": "bot-uuid",
  "filename": "product_manual.pdf",
  "file_type": "application/pdf",
  "status": "completed",
  "doc_metadata": {
    "num_chunks": 47,
    "chunking_strategy": "semantic"
  },
  "created_at": "2026-01-11T10:35:00"
}
```

**⏱️ Lưu ý**: Document processing có thể mất vài giây tùy file size.

#### Step 7: List Documents

**Request**: `GET {{base_url}}/api/v1/bots/{{bot_id}}/documents`

**Headers**:
```
Authorization: Bearer {{access_token}}
```

**Expected Response** (200 OK):
```json
[
  {
    "id": "doc-uuid",
    "filename": "product_manual.pdf",
    "file_type": "application/pdf",
    "status": "completed",
    "doc_metadata": {
      "num_chunks": 47,
      "chunking_strategy": "semantic"
    },
    "created_at": "2026-01-11T10:35:00"
  }
]
```

#### Step 8: Chat với Bot (RAG Query)

**Request**: `POST {{base_url}}/api/v1/bots/{{bot_id}}/chat`

**Headers**:
```
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Body** (raw JSON):
```json
{
  "message": "What are the main features of the product?",
  "history": [
    {
      "role": "user",
      "content": "Hello"
    },
    {
      "role": "assistant",
      "content": "Hi! How can I help you today?"
    }
  ]
}
```

**Expected Response** (200 OK):
```json
{
  "response": "Based on the documentation, the main features include: 1) Advanced AI capabilities, 2) Multi-language support, 3) Real-time processing...",
  "sources": [
    "product_manual.pdf"
  ]
}
```

**🚀 Advanced Features tự động được áp dụng**:
- ✅ Query transformation (HyDE + multi-query)
- ✅ Hybrid search (semantic + keyword)
- ✅ Document re-ranking
- ✅ Redis caching (nếu query giống trước đó trong 1h)
- ✅ Conversation context (history)

#### Step 9: Test Caching

Gửi lại **exact same request** như Step 8. Response sẽ nhanh hơn đáng kể (từ cache):

**Response headers** sẽ có thêm:
```
X-Cache: HIT
```

#### Step 10: Update Bot Config

**Request**: `PUT {{base_url}}/api/v1/bots/{{bot_id}}`

**Headers**:
```
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Body** (raw JSON):
```json
{
  "name": "Customer Support Bot V2",
  "config": {
    "llm_model": "gpt-3.5-turbo",
    "temperature": 0.5,
    "system_prompt": "You are an expert customer support agent specializing in technical issues."
  }
}
```

#### Step 11: Delete Document

**Request**: `DELETE {{base_url}}/api/v1/bots/{{bot_id}}/documents/{{doc_id}}`

**Headers**:
```
Authorization: Bearer {{access_token}}
```

**Expected Response** (204 No Content)

### 3. Postman Tests Scripts

Thêm test scripts vào các request để tự động validate:

**Register Request - Tests tab**:
```javascript
pm.test("Status code is 201", function () {
    pm.response.to.have.status(201);
});

pm.test("Response has user id", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.id).to.exist;
});

pm.test("User role is owner", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.role).to.eql("owner");
});
```

**Login Request - Tests tab**:
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Has access token", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.access_token).to.exist;
    
    // Auto-save to environment
    pm.environment.set("access_token", jsonData.access_token);
});
```

**Create Bot - Tests tab**:
```javascript
pm.test("Status code is 201", function () {
    pm.response.to.have.status(201);
});

pm.test("Bot has API key", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.api_key).to.exist;
    
    // Auto-save bot_id
    pm.environment.set("bot_id", jsonData.id);
});
```

## 🎯 Advanced RAG Features

### 1. Hybrid Search

Kết hợp 2 phương pháp:
- **Vector Search**: Tìm documents có ngữ nghĩa tương tự (cosine similarity)
- **Keyword Matching**: Filter theo bot_id và metadata

```python
# Trong advanced_rag_service.py
results = self.qdrant_client.search(
    collection_name=f"bot_{bot_id}",
    query_vector=query_embedding,
    query_filter=Filter(
        must=[FieldCondition(key="bot_id", match={"value": bot_id})]
    ),
    limit=top_k * 2  # Lấy nhiều hơn để re-rank
)
```

### 2. Query Transformation

#### HyDE (Hypothetical Document Embeddings)

Tạo "câu trả lời giả định" từ query để cải thiện semantic search:

```python
hyde_prompt = f"Write a detailed answer to: {query}"
hypothetical_answer = llm.predict(hyde_prompt)
# Embed cả query và hypothetical answer
```

#### Multi-Query Generation

Tạo 3 variations của query:

```python
variations = [
    original_query,
    rephrased_query,  # "Rephrase this question: ..."
    hypothetical_answer  # HyDE
]
```

### 3. Chunking Strategies

**Recursive** (default):
- Chunk size: 800 characters
- Overlap: 200 characters
- Separators: `\n\n`, `\n`, `. `, ` `

**Semantic**:
- Chunk size: 500 characters
- Overlap: 100 characters
- Tối ưu cho documents có cấu trúc rõ ràng

Chọn strategy khi upload document:
```bash
POST /api/v1/bots/{id}/documents?chunking_strategy=semantic
```

### 4. Document Re-ranking

Sau khi retrieve documents, re-rank theo:
- Relevance score từ vector search
- LLM-based scoring (TODO: cross-encoder)

```python
def _rerank_documents(self, query: str, docs: List) -> List:
    # Sort by score descending
    return sorted(docs, key=lambda x: x.score, reverse=True)
```

### 5. Redis Caching

Cache responses với key = MD5(bot_id + query):

```python
cache_key = f"rag_cache:{bot_id}:{hashlib.md5(query.encode()).hexdigest()}"
# TTL = 3600 seconds (1 hour)
```

**Cache invalidation**: Tự động expire sau 1h hoặc khi upload document mới.

### 6. Conversation Memory

Hỗ trợ context từ 5 messages cuối:

```python
# Request body
{
  "message": "What about pricing?",
  "history": [
    {"role": "user", "content": "Tell me about features"},
    {"role": "assistant", "content": "Features include..."},
    {"role": "user", "content": "How does it work?"},
    {"role": "assistant", "content": "It works by..."}
  ]
}
```

Bot sẽ hiểu context và trả lời phù hợp.

## 🔧 Troubleshooting

### 1. Backend không khởi động được

**Error**: `ModuleNotFoundError: No module named 'xxx'`

**Fix**:
```bash
# Rebuild without cache
docker compose build --no-cache backend
docker compose up -d backend
```

### 2. Port conflict (Redis 6379 already in use)

**Error**: `failed to bind host port 0.0.0.0:6379/tcp: address already in use`

**Fix**: Đã được thay đổi sang port 6380 trong `docker-compose.yml`:
```yaml
redis:
  ports:
    - "6380:6379"  # External:Internal
```

Nếu vẫn conflict, đổi sang port khác (vd: 6381).

### 3. OpenAI API Error: "Invalid API key"

**Fix**: Kiểm tra file `.env`:
```bash
# Verify OpenAI key
cat backend/.env | grep OPENAI_API_KEY

# Test key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_KEY"
```

### 4. Qdrant collection not found

**Fix**: Collection tự động được tạo khi upload document đầu tiên. Nếu lỗi:

```bash
# Restart Qdrant
docker compose restart qdrant

# Check Qdrant UI
open http://localhost:6333/dashboard
```

### 5. Document upload failed

**Possible causes**:
- File quá lớn (>100MB)
- Format không support
- MinIO không khả dụng

**Fix**:
```bash
# Check MinIO
docker logs omnirag-minio-1

# Check Celery worker
docker logs omnirag-celery_worker-1

# Manual bucket creation
docker exec omnirag-backend-1 python -c "
from app.db.storage_service import storage_service
import asyncio
asyncio.run(storage_service.connect())
"
```

### 6. JWT Token expired

**Error**: `401 Unauthorized - Could not validate credentials`

**Fix**: Token có TTL 30 phút. Login lại để lấy token mới:
```bash
POST /api/v1/auth/login
```

### 7. Slow RAG response

**Optimization checklist**:
- ✅ Redis cache hoạt động? (check logs cho "Cache hit")
- ✅ Qdrant indexing OK? (HNSW với m=16)
- ✅ Chunking strategy phù hợp? (thử đổi sang "recursive")
- ✅ Limit number of retrieved docs (default: top_k=5)

**Debug**:
```python
# Trong advanced_rag_service.py, thêm logging
import logging
logger = logging.getLogger(__name__)

async def chat(...):
    start = time.time()
    # ... process
    logger.info(f"RAG took {time.time() - start:.2f}s")
```

### 8. Database migration issues

**Fix**:
```bash
# Check current revision
docker exec omnirag-backend-1 alembic current

# Reset and re-migrate
docker compose down -v
docker compose up -d db
docker compose up -d backend
```

## 📊 Monitoring & Logs

### View logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f celery_worker

# Last 100 lines
docker compose logs --tail=100 backend
```

### Health checks

```bash
# Backend API
curl http://localhost:8000/docs

# Qdrant
curl http://localhost:6333/collections

# MinIO Console
open http://localhost:9001
# Login: minioadmin / minioadmin
```

### Database inspection

```bash
# PostgreSQL
docker exec -it omnirag-db-1 psql -U postgres -d omnirag
\dt  # List tables
SELECT * FROM tenants;
SELECT * FROM users;
SELECT * FROM bots;

# MongoDB
docker exec -it omnirag-mongodb-1 mongosh -u admin -p password
use omnirag
db.chat_logs.find().limit(5)

# Redis
docker exec -it omnirag-redis-1 redis-cli
KEYS rag_cache:*
GET <key>
```

## 🎓 Best Practices

### 1. Security

- ✅ Đổi default passwords trong production
- ✅ Use strong SECRET_KEY (generate với `openssl rand -hex 32`)
- ✅ Enable HTTPS/TLS
- ✅ Implement rate limiting
- ✅ Rotate API keys định kỳ

### 2. Performance

- ✅ Enable Redis caching
- ✅ Use appropriate chunking strategy:
  - `recursive`: General documents
  - `semantic`: Structured docs (manuals, FAQs)
- ✅ Monitor Qdrant collection size
- ✅ Set reasonable `top_k` (5-10 documents)

### 3. Cost Optimization

- ✅ Use GPT-3.5-turbo for fast queries
- ✅ Use GPT-4 only when needed (complex reasoning)
- ✅ Cache frequently asked questions
- ✅ Implement token usage tracking

### 4. Data Management

- ✅ Regular backup PostgreSQL
- ✅ Archive old MongoDB logs
- ✅ Clean up MinIO unused files
- ✅ Monitor disk usage

## 📝 Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `OPENAI_API_KEY` | OpenAI API key | - | ✅ Yes |
| `SECRET_KEY` | JWT signing key | - | ✅ Yes |
| `ALGORITHM` | JWT algorithm | HS256 | No |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token TTL | 30 | No |
| `POSTGRES_SERVER` | PostgreSQL host | db | No |
| `POSTGRES_USER` | PostgreSQL user | postgres | No |
| `POSTGRES_PASSWORD` | PostgreSQL password | password | No |
| `POSTGRES_DB` | PostgreSQL database | omnirag | No |
| `MONGODB_URL` | MongoDB connection string | mongodb://admin:password@mongodb:27017 | No |
| `REDIS_URL` | Redis connection string | redis://redis:6379/0 | No |
| `MINIO_ENDPOINT` | MinIO endpoint | minio:9000 | No |
| `MINIO_ACCESS_KEY` | MinIO access key | minioadmin | No |
| `MINIO_SECRET_KEY` | MinIO secret key | minioadmin | No |
| `QDRANT_HOST` | Qdrant host | qdrant | No |
| `QDRANT_PORT` | Qdrant port | 6333 | No |

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/OmniRAG/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/OmniRAG/discussions)
- **Email**: support@omnirag.com

---

**Made with ❤️ by OmniRAG Team**
