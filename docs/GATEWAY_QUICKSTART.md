# Gateway Quickstart

Gateway là Go service tại `http://localhost:8080`, dùng làm entrypoint chính cho frontend và API khi chạy Docker.

## Vai trò

- Proxy `/api/*`, `/docs`, `/redoc`, `/openapi.json` tới FastAPI backend.
- CORS cho frontend.
- Request logging.
- Rate limit qua Redis.
- Health/readiness/metrics.
- Cache Redis cho `GET` response đủ điều kiện.
- Hỗ trợ SSE streaming cho chat-stream.

Gateway không cache `POST` chat responses. Chat/RAG cache nằm trong backend RAG service.

## Chạy bằng Docker

```bash
docker compose up -d gateway backend redis
```

Kiểm tra:

```bash
curl http://localhost:8080/
curl http://localhost:8080/health
curl http://localhost:8080/readiness
curl http://localhost:8080/metrics
curl http://localhost:8080/docs
```

## Config

| Env | Default | Mô tả |
| --- | --- | --- |
| `GATEWAY_PORT` | `8080` | Port gateway |
| `ENVIRONMENT` | `development` | Gin/zap mode |
| `PYTHON_BACKEND_URL` | `http://backend:8000` | Backend upstream |
| `REDIS_URL` | `redis://redis:6379/0` | Cache/rate limit Redis |
| `CACHE_TTL` | `3600` | TTL cache GET |
| `RATE_LIMIT_ENABLED` | `true` | Bật/tắt rate limit |
| `RATE_LIMIT_RPS` | `100` | Requests per second |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Allowed origins |
| `JWT_SECRET` | dev fallback | Bắt buộc strong secret ở production |

Compose set:

```env
PYTHON_BACKEND_URL=http://backend:8000
REDIS_URL=redis://redis:6379/0
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,...
```

## Proxy rules

Gateway nhận:

```text
http://localhost:8080/api/v1/...
```

và forward tới:

```text
http://backend:8000/api/v1/...
```

Các route Swagger cũng được proxy:

- `/docs`
- `/redoc`
- `/openapi.json`

## Cache behavior

Gateway cache chỉ chạy khi:

- Method là `GET`.
- Endpoint không phải streaming.
- Endpoint không thuộc nhóm dynamic: sessions, history, memory, analytics, knowledge-graph, documents.
- Request không có `Cache-Control: no-cache` hoặc `Pragma: no-cache`.

Cache key dùng SHA-256 và có tính `Authorization` header để tránh leak dữ liệu giữa users.

Ví dụ test cache với endpoint tương đối tĩnh:

```bash
curl -i http://localhost:8080/api/v1/bot-templates/ \
  -H "Authorization: Bearer <access_token>"
```

Response cache hit có:

```http
X-Cache: HIT
```

`POST /api/v1/bots/{bot_id}/chat` sẽ không hit gateway cache. Xem backend Redis keys `rag:chat:*` nếu cần debug chat cache.

## Body limits và streaming

- Default request body limit: `10MB`.
- Document upload body limit: `20MB` cho `POST` path chứa `/documents`.
- SSE stream timeout: tối đa 30 phút theo request context.
- Gateway server `WriteTimeout=0` để không cắt stream dài.

## Chạy test gateway

```bash
cd gateway
go test ./...
```

## Troubleshooting

Backend direct Docker là `http://localhost:8001`, nhưng gateway upstream trong container là `http://backend:8000`. Nếu gateway trả 502 hoặc proxy lỗi, kiểm tra:

```bash
docker compose ps gateway backend redis
docker compose logs --tail=100 gateway
docker compose logs --tail=100 backend
```

Nếu cache không hit:

- Kiểm tra request có phải `GET` không.
- Kiểm tra endpoint có nằm trong dynamic exclusion không.
- Kiểm tra Redis health.
- Kiểm tra header `Cache-Control`.
