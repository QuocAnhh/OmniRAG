# OmniRAG Gateway

Go gateway cho OmniRAG. Service này chạy ở port `8080` và là entrypoint chính của frontend trong Docker.

## Responsibilities

- Reverse proxy tới FastAPI backend.
- CORS.
- Structured logging bằng zap.
- Redis-backed rate limiting.
- Health, readiness và metrics endpoints.
- Redis cache cho `GET` response đủ điều kiện.
- SSE streaming support cho chat-stream.

Gateway không cache `POST` chat/RAG responses. Backend RAG service tự quản lý cache chat, embeddings, rewrite và CRAG.

## Routes

| Route | Mô tả |
| --- | --- |
| `GET /` | Service info |
| `GET /health` | Liveness |
| `GET /readiness` | Readiness, gồm Redis/backend checks |
| `GET /metrics` | Gateway metrics |
| `ANY /api/*path` | Proxy API tới backend |
| `ANY /docs` | Proxy Swagger |
| `ANY /redoc` | Proxy ReDoc |
| `ANY /openapi.json` | Proxy OpenAPI schema |

## Local Docker usage

Từ root repo:

```bash
docker compose up -d gateway backend redis
```

Kiểm tra:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/docs
```

Backend host port khi chạy Docker là `8001`, nhưng gateway trong Docker gọi backend bằng service URL `http://backend:8000`.

## Configuration

| Env | Default | Description |
| --- | --- | --- |
| `GATEWAY_PORT` | `8080` | Listening port |
| `ENVIRONMENT` | `development` | `development` hoặc `production` |
| `PYTHON_BACKEND_URL` | `http://backend:8000` | FastAPI upstream |
| `REDIS_URL` | `redis://redis:6379/0` | Redis cache/rate limit |
| `CACHE_TTL` | `3600` | GET cache TTL in seconds |
| `RATE_LIMIT_ENABLED` | `true` | Enable rate limiter |
| `RATE_LIMIT_RPS` | `100` | RPS limit |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Allowed origins |
| `JWT_SECRET` | dev fallback | Required strong secret in production |

## Cache behavior

Gateway cache applies only to eligible `GET` requests.

Excluded:

- Streaming endpoints.
- Sessions/history/memory.
- Analytics.
- Knowledge Graph.
- Documents.
- Requests with `Cache-Control: no-cache` or `Pragma: no-cache`.

Cache key includes the path, body and `Authorization` header, then hashes with SHA-256.

Writes invalidate the exact matching GET cache key for the same path. This is intentionally narrow and conservative.

## Request limits

- Normal API request body: `10MB`.
- Document uploads: `20MB`.
- SSE stream max duration: 30 minutes.

## Development

```bash
cd gateway
go test ./...
go run .
```

For local `go run`, set:

```env
PYTHON_BACKEND_URL=http://localhost:8000
REDIS_URL=redis://localhost:6380/0
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

## Debug

```bash
docker compose logs -f gateway
curl -i http://localhost:8080/readiness
curl -i http://localhost:8080/api/v1/bot-templates/
```

Nếu muốn kiểm tra chat cache, xem backend Redis keys `rag:chat:*`; gateway sẽ không trả `X-Cache: HIT` cho `POST /chat`.
