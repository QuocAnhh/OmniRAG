# 🚀 OmniRAG Quick Start Guide

## Prerequisites
- Docker & Docker Compose
- Python 3.10+
- Node.js 18+
- OpenAI API Key

---

## 🔧 Setup Instructions

### 1. Environment Configuration

Create `.env` file in `backend/` directory:

```bash
# Database
POSTGRES_SERVER=localhost
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_DB=omnirag

# MongoDB
MONGODB_URL=mongodb://admin:password@localhost:27017

# Redis
REDIS_URL=redis://localhost:6380/0

# MinIO
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# Qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6333

# OpenAI
OPENAI_API_KEY=your-openai-api-key-here

# Security
SECRET_KEY=your-secret-key-here-generate-with-openssl-rand-hex-32
```

### 2. Start Infrastructure Services

```bash
docker-compose up -d db mongodb redis minio qdrant
```

This starts:
- PostgreSQL (port 5432)
- MongoDB (port 27017)
- Redis (port 6380)
- MinIO (port 9000, 9001)
- Qdrant (port 6333)

### 3. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start backend server
uvicorn app.main:app --reload --port 8000
```

Backend will be available at: http://localhost:8000
API Documentation: http://localhost:8000/docs

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend will be available at: http://localhost:5173

---

## 🐳 Docker Compose (Full Stack)

To run everything in Docker:

```bash
docker-compose up --build
```

Access:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- MinIO Console: http://localhost:9001

---

## 📝 First Steps After Setup

### 1. Register a User

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "secure_password",
    "full_name": "Admin User",
    "tenant_name": "My Company"
  }'
```

Or use the frontend at http://localhost:5173/auth

### 2. Login

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@example.com&password=secure_password"
```

Save the `access_token` from the response.

### 3. Create a Bot

```bash
curl -X POST http://localhost:8000/api/v1/bots \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Support Bot",
    "description": "Customer support assistant",
    "config": {
      "llm_model": "gpt-3.5-turbo",
      "temperature": 0.7,
      "system_prompt": "You are a helpful customer support assistant."
    }
  }'
```

### 4. Upload a Document

```bash
curl -X POST http://localhost:8000/api/v1/bots/BOT_ID/documents \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "file=@/path/to/document.pdf" \
  -F "chunking_strategy=recursive"
```

### 5. Chat with Your Bot

```bash
curl -X POST http://localhost:8000/api/v1/bots/BOT_ID/chat \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is this document about?",
    "history": []
  }'
```

---

## 🔍 Verify Integration

### Check Dashboard Stats
```bash
curl http://localhost:8000/api/v1/dashboard/stats \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Should return real-time statistics:
```json
{
  "total_bots": 1,
  "active_sessions": 0,
  "messages_today": 0,
  "avg_response_time": "0.0s"
}
```

### Check Analytics
```bash
curl http://localhost:8000/api/v1/analytics/stats \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### View Recent Conversations
```bash
curl http://localhost:8000/api/v1/analytics/conversations?limit=10 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 🛠️ Troubleshooting

### Backend Issues

**ImportError: No module named 'fastapi'**
```bash
cd backend
pip install -r requirements.txt
```

**Database connection error**
```bash
# Check if services are running
docker-compose ps

# Restart services
docker-compose restart db mongodb redis
```

**Alembic migration errors**
```bash
# Reset database (WARNING: deletes all data)
alembic downgrade base
alembic upgrade head
```

### Frontend Issues

**Module not found errors**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

**API connection issues**
- Check if backend is running on port 8000
- Verify CORS settings in `backend/app/core/config.py`
- Check browser console for CORS errors

**Vite proxy not working**
```bash
# Make sure vite.config.ts has proxy configuration
# Restart dev server
npm run dev
```

### Docker Issues

**Port already in use**
```bash
# Change ports in docker-compose.yml
# Or stop conflicting services
lsof -ti:8000 | xargs kill
```

**Build fails**
```bash
# Clean rebuild
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

---

## 📊 Monitoring & Logs

### Backend Logs
```bash
# Local development
tail -f backend/logs/app.log

# Docker
docker-compose logs -f backend
```

### MongoDB Queries
```bash
# Connect to MongoDB
docker exec -it omnirag-mongodb-1 mongosh -u admin -p password

# View conversations
use omnirag
db.conversations.find().limit(5)
```

### Redis Cache
```bash
# Connect to Redis
docker exec -it omnirag-redis-1 redis-cli

# View cached keys
KEYS dashboard:stats:*
GET dashboard:stats:YOUR_TENANT_ID
```

### Qdrant Collections
```bash
# View collections
curl http://localhost:6333/collections

# View collection info
curl http://localhost:6333/collections/omnirag_advanced
```

---

## 🧪 Testing

### Run Backend Tests
```bash
cd backend
pytest tests/ -v
```

### Run Frontend Tests
```bash
cd frontend
npm test
```

### Test API Endpoints
Use the interactive API documentation at http://localhost:8000/docs

---

## 📚 Additional Resources

- [Backend README](backend/README.md)
- [Frontend README](frontend/README.md)
- [Integration Documentation](INTEGRATION_COMPLETE.md)
- [API Documentation](http://localhost:8000/docs)

---

## 🎯 Quick Commands Cheat Sheet

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# Restart backend
docker-compose restart backend

# Rebuild and restart
docker-compose up --build -d

# Clean everything (WARNING: deletes data)
docker-compose down -v
docker system prune -a
```

---

## ✅ Health Checks

All services healthy when:

```bash
# Backend
curl http://localhost:8000/api/v1/health
# Expected: {"status": "healthy"}

# PostgreSQL
docker exec omnirag-db-1 pg_isready
# Expected: accepting connections

# MongoDB
docker exec omnirag-mongodb-1 mongosh --eval "db.adminCommand('ping')"
# Expected: { ok: 1 }

# Redis
docker exec omnirag-redis-1 redis-cli ping
# Expected: PONG

# Qdrant
curl http://localhost:6333/collections
# Expected: {"collections": [...]}
```

---

## 🚀 You're Ready!

Your OmniRAG instance is now fully integrated and ready to use. Visit http://localhost:5173 to start building your RAG applications!
