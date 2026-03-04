# API Reference

**Base URL (via Gateway):** `http://localhost:8080/api/v1`
**Base URL (direct):** `http://localhost:8000/api/v1`

All endpoints (except `/auth/register` and `/auth/login`) require:
```
Authorization: Bearer <jwt_token>
```

Interactive docs: http://localhost:8000/docs

---

## Authentication — `/auth`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/register` | Register a new tenant + user |
| `POST` | `/auth/login` | Login — returns JWT token (form-urlencoded) |
| `GET` | `/auth/me` | Get current user info |

### Register
```json
POST /auth/register
{
  "email": "user@example.com",
  "password": "StrongPass123!",
  "full_name": "Nguyen Van A",
  "tenant_name": "My Company"
}
```

### Login
```
POST /auth/login
Content-Type: application/x-www-form-urlencoded

username=user@example.com&password=StrongPass123!
```
Response: `{ "access_token": "...", "token_type": "bearer" }`

---

## Tenants — `/tenants`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/tenants/me` | Get current tenant info |
| `PUT` | `/tenants/me` | Update tenant settings |

---

## Users — `/users`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/users` | List users in current tenant |
| `GET` | `/users/{id}` | Get a specific user |
| `PUT` | `/users/{id}` | Update user info |
| `DELETE` | `/users/{id}` | Remove a user |

---

## Bots — `/bots`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/bots` | List all bots in tenant |
| `POST` | `/bots` | Create a new bot |
| `GET` | `/bots/{id}` | Get bot details |
| `PUT` | `/bots/{id}` | Update bot config |
| `DELETE` | `/bots/{id}` | Delete bot |

### Create Bot
```json
POST /bots
{
  "name": "Support Bot",
  "description": "Customer support assistant",
  "config": {
    "llm_model": "openai/gpt-4o-mini",
    "temperature": 0.7,
    "max_tokens": 2048,
    "system_prompt": "You are a helpful assistant.",
    "top_k": 5,
    "chunking_strategy": "recursive",
    "enable_knowledge_graph": true,
    "enable_memory": true
  }
}
```
Response includes `api_key` (auto-generated).

---

## Documents — `/bots/{id}/documents`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/bots/{id}/documents` | Upload document (PDF/DOCX/PPTX/TXT) |
| `GET` | `/bots/{id}/documents` | List documents for bot |
| `DELETE` | `/bots/{id}/documents/{doc_id}` | Delete a document |

### Upload Document
```
POST /bots/{id}/documents
Content-Type: multipart/form-data

file=<file>
chunking_strategy=recursive   # or "semantic"
```

### Document Status
```json
{
  "id": "...",
  "filename": "report.pdf",
  "status": "completed",      // "processing" | "completed" | "failed"
  "doc_metadata": {
    "num_chunks": 42,
    "chunking_strategy": "recursive"
  }
}
```

---

## Chat — `/bots/{id}/chat`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/bots/{id}/chat` | Chat with bot (RAG-powered) |

```json
POST /bots/{id}/chat
{
  "message": "What is the refund policy?",
  "history": [
    {"role": "user", "content": "Hi"},
    {"role": "assistant", "content": "Hello! How can I help?"}
  ],
  "session_id": "optional-session-uuid"
}
```

---

## OpenRouter — `/openrouter`

Direct access to OpenRouter services and advanced RAG pipeline.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/openrouter/test` | Test OpenRouter API connection |
| `POST` | `/openrouter/chat` | Direct LLM chat completion |
| `POST` | `/openrouter/embeddings` | Generate text embeddings |
| `POST` | `/openrouter/rag/ingest` | Ingest a document into RAG |
| `POST` | `/openrouter/rag/chat` | RAG-powered chat (full pipeline) |

### RAG Chat (full pipeline)
```json
POST /openrouter/rag/chat
{
  "bot_id": "uuid",
  "query": "Summarise the key findings",
  "bot_config": {
    "llm_model": "openai/gpt-4o",
    "temperature": 0.5,
    "enable_knowledge_graph": true
  },
  "conversation_history": [],
  "session_id": "optional-uuid",
  "top_k": 5
}
```

### Direct Chat
```json
POST /openrouter/chat
{
  "messages": [{"role": "user", "content": "Hello"}],
  "model": "openai/gpt-4o-mini",
  "temperature": 0.7,
  "stream": false
}
```

### Embeddings
```json
POST /openrouter/embeddings
{
  "texts": ["First sentence", "Second sentence"],
  "model": "openai/text-embedding-3-small"
}
```

---

## Bot Templates — `/bot-templates`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/bot-templates` | List all available templates |
| `GET` | `/bot-templates/{id}` | Get template details |
| `POST` | `/bot-templates/{id}/apply` | Create bot from template |

---

## Folders — `/folders`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/folders` | List folders |
| `POST` | `/folders` | Create folder |
| `PUT` | `/folders/{id}` | Update folder |
| `DELETE` | `/folders/{id}` | Delete folder |

---

## Analytics — `/analytics`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/analytics/stats` | Overall usage statistics |
| `GET` | `/analytics/conversations` | Conversation list (paginated) |
| `GET` | `/analytics/conversations/{id}` | Single conversation detail |

```json
GET /analytics/stats
Response:
{
  "total_messages": 1240,
  "total_conversations": 80,
  "avg_response_time_ms": 1850,
  "messages_today": 34
}
```

---

## Dashboard — `/dashboard`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/dashboard/stats` | Dashboard summary stats (cached) |

---

## Integrations — `/integrations`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/integrations` | List configured integrations |
| `POST` | `/integrations` | Register new integration |
| `DELETE` | `/integrations/{id}` | Remove integration |

---

## Channels — Zalo

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/channels/zalo/webhook` | Zalo Hub webhook receiver |
| `GET` | `/channels/zalo/status` | Zalo connection status |
| `POST` | `/channels/zalo-bot/send` | Send message via Zalo bot |
| `GET` | `/channels/zalo-bot/bots` | List configured Zalo bots |

---

## Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `http://localhost:8080/health` | Gateway health (Redis + Backend status) |
| `GET` | `http://localhost:8080/readiness` | Kubernetes readiness probe |
| `GET` | `http://localhost:8000/api/v1/health` | Backend health |

```json
GET http://localhost:8080/health
{
  "status": "healthy",
  "redis": "healthy",
  "backend": "healthy",
  "service": "omnirag-gateway",
  "version": "1.0.0"
}
```

---

## Error Responses

| Status | Meaning |
|--------|---------|
| 400 | Bad request / validation error |
| 401 | Missing or expired JWT token |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 422 | Unprocessable entity (schema validation) |
| 429 | Rate limit exceeded (100 rps via gateway) |
| 500 | Internal server error |
