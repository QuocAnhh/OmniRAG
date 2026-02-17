# 🔧 Troubleshooting

## Backend Issues

### ImportError: No module named 'fastapi'
```bash
cd backend
pip install -r requirements.txt
```

### Database connection error
```bash
# Check if services are running
docker-compose ps

# Restart services
docker-compose restart db mongodb redis
```

### Alembic migration errors
```bash
# Reset database (WARNING: deletes all data)
alembic downgrade base
alembic upgrade head
```

### Port conflict (Redis 6379 already in use)
**Error**: `failed to bind host port 0.0.0.0:6379/tcp: address already in use`

**Fix**: The default configuration uses internal port 6379 but external port 6380 for Redis to avoid conflicts.
```yaml
redis:
  ports:
    - "6380:6379"  # External:Internal
```

## Frontend Issues

### Module not found errors
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### API connection issues
- Check if backend is running on port 8000
- Verify CORS settings in `backend/app/core/config.py`
- Check browser console for CORS errors

### Vite proxy not working
```bash
# Make sure vite.config.ts has proxy configuration
# Restart dev server
npm run dev
```

## RAG & AI Issues

### OpenAI API Error: "Invalid API key"
**Fix**: Check `.env` file:
```bash
cat backend/.env | grep OPENAI_API_KEY
```

### Qdrant collection not found
**Fix**: Collection is created automatically on first upload. If error persists:
```bash
docker compose restart qdrant
```

### Document upload failed
**Possible causes**:
- File too large (>100MB)
- Unsupported format
- MinIO unavailable

**Fix**: Check logs
```bash
docker logs omnirag-celery_worker-1
```

### Slow RAG response
**Optimization checklist**:
- ✅ Redis cache working? (check logs for "Cache hit")
- ✅ Qdrant indexing OK? (HNSW with m=16)
- ✅ Chunking strategy suitable? (try "recursive")
- ✅ Limit number of retrieved docs (default: top_k=5)
