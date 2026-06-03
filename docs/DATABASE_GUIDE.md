# Database Guide

Tài liệu này mô tả các datastore đang được dùng trong OmniRAG và cách kiểm tra nhanh khi chạy bằng Docker Compose.

## PostgreSQL

Service compose: `db`.

Vai trò:

- Users, tenants, bots.
- Document metadata.
- Folders.
- Alembic migrations.

Kết nối trong Docker:

```bash
docker compose exec db psql -U postgres -d omnirag
```

Kết nối từ host:

| Field | Value |
| --- | --- |
| Host | `localhost` |
| Port | `5433` |
| User | `postgres` |
| Password | `password` |
| Database | `omnirag` |

URI local:

```env
SQLALCHEMY_DATABASE_URI=postgresql://postgres:password@localhost:5433/omnirag
```

Backend dùng sync URI này cho Alembic/Celery và tự derive async URI cho FastAPI endpoints.

SQL hữu ích:

```sql
select id, email, is_active from users order by created_at desc limit 10;
select id, name, is_active from bots order by created_at desc limit 10;
select id, filename, status, error_message from documents order by created_at desc limit 10;
select id, name, bot_id from folders order by created_at desc limit 10;
```

## MongoDB

Service compose: `mongodb`.

Vai trò:

- Conversations.
- Sessions.
- API keys.
- Integrations.
- Message feedback.
- Một phần context cho channel integrations.

Kết nối trong Docker:

```bash
docker compose exec mongodb mongosh -u admin -p password --authenticationDatabase admin
```

Kết nối từ host:

```text
mongodb://admin:password@localhost:27017
```

MQL hữu ích:

```javascript
use omnirag
show collections
db.conversations.find().sort({timestamp: -1}).limit(3).pretty()
db.sessions.find().sort({updated_at: -1}).limit(3).pretty()
db.integrations.find().limit(5).pretty()
db.api_keys.find().limit(5).pretty()
```

## Redis

Service compose: `redis`.

Vai trò:

- Gateway GET cache.
- Backend RAG cache.
- Celery broker/result backend.
- Embedding/rewrite/CRAG cache.

Kết nối:

```bash
docker compose exec redis redis-cli
```

Host port:

```text
localhost:6380
```

Lệnh hữu ích:

```redis
PING
KEYS gateway:cache:*
KEYS rag:chat:*
KEYS emb:*
KEYS rewrite:*
KEYS crag:*
```

Cẩn thận với `FLUSHALL` trên môi trường shared vì sẽ xóa cả cache và dữ liệu Celery runtime.

## Qdrant

Service compose: `qdrant`.

Vai trò:

- Vector collections cho chunks.
- Hybrid retrieval data: dense OpenRouter vectors và sparse BM25 vectors.

Collection mặc định hiện tại:

```text
omnirag_openrouter_collection_v3
```

Qdrant image được pin trong compose:

```text
qdrant/qdrant:v1.16.0
```

Kiểm tra:

```bash
curl http://localhost:6333/
curl http://localhost:6333/healthz
curl http://localhost:6333/collections
```

Dashboard:

```text
http://localhost:6333/dashboard
```

## MinIO

Service compose: `minio`.

Vai trò:

- Lưu file upload gốc.
- Lưu OpenDataLoader artifacts theo prefix `documents/{document_id}/extracted/...`.

Console:

```text
http://localhost:9001
```

Credential dev:

| Field | Value |
| --- | --- |
| User | `minioadmin` |
| Password | `minioadmin` |

Health:

```bash
curl http://localhost:9000/minio/health/live
```

## Container names

Không hardcode tên container kiểu `omnirag-db-1` trong script. Dùng Compose service name:

```bash
docker compose ps
docker compose exec db psql -U postgres -d omnirag
docker compose exec mongodb mongosh -u admin -p password --authenticationDatabase admin
docker compose exec redis redis-cli
```
