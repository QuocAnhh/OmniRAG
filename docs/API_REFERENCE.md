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

## Chat — `/bots/{id}/chat` and `/bots/{id}/chat-stream`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/bots/{id}/chat` | Chat with bot — standard JSON response |
| `POST` | `/bots/{id}/chat-stream` | Chat with bot — SSE streaming response |

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

The streaming endpoint (`/chat-stream`) returns `text/event-stream` SSE. Each event is JSON:
```json
{"type": "metadata", "sources": [...], "retrieved_chunks": [...], "agent_logs": [...], "session_id": "..."}
{"type": "content",  "content": "chunk of text..."}
{"type": "done"}
{"type": "error",    "message": "..."}
```

## Sessions & History — `/bots/{id}/sessions` and `/bots/{id}/history`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/bots/{id}/sessions` | List conversation sessions |
| `DELETE` | `/bots/{id}/sessions/{session_id}` | Delete a session |
| `GET` | `/bots/{id}/history` | Full conversation history |
| `DELETE` | `/bots/{id}/history` | Clear all history for bot |

## Memory — `/bots/{id}/memory`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/bots/{id}/memory` | Get Mem0 stored facts for a user |
| `DELETE` | `/bots/{id}/memory` | Clear Mem0 memory for a user |

Both endpoints accept `?user_id=<user_id>` query param.

## Retrieval Debug — `/bots/{id}/retrieve` and `/bots/{id}/debug-retrieval`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/bots/{id}/retrieve` | Run hybrid search and return raw results |
| `GET` | `/bots/{id}/debug-retrieval` | Debug retrieval pipeline (scores, reranking) |

## Feedback — `/bots/{id}/chat/{message_id}/feedback`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/bots/{id}/chat/{message_id}/feedback` | Submit thumbs up/down feedback on a message |

## Generate Prompt — `/bots/generate-prompt`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/bots/generate-prompt` | AI-generate a system prompt for a bot description |

---

## OpenRouter — `/openrouter`

Direct access to OpenRouter services. Note: primary chat endpoints are on `/bots/{id}/chat` and `/bots/{id}/chat-stream`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/openrouter/test` | Test OpenRouter API connection |
| `POST` | `/openrouter/chat` | Direct LLM chat completion (no RAG) |
| `POST` | `/openrouter/embeddings` | Generate text embeddings |
| `POST` | `/openrouter/rag/ingest` | Ingest a document into RAG (low-level) |
| `POST` | `/openrouter/rag/chat` | RAG-powered chat — low-level direct call |
| `GET` | `/openrouter/models/chat` | List available chat models from OpenRouter |
| `GET` | `/openrouter/models/embeddings` | List available embedding models |

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

### Zalo Hub (central OA hub via Func.vn)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/channels/zalo/hub-webhook` | Zalo Hub webhook receiver (verifies `x-hub-secret` header) |

### Zalo Bot Platform (direct `bot-api.zapps.me` integration)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/channels/zalo-bot/webhook/{bot_id}` | Receive events from Zalo Bot Platform (verifies `x-bot-api-secret-token` header) |
| `POST` | `/channels/zalo-bot/connect` | Connect a bot token — calls `getMe` + `setWebhook` automatically |
| `POST` | `/channels/zalo-bot/disconnect` | Disconnect and remove Zalo credentials from bot config |
| `GET` | `/channels/zalo-bot/status/{bot_id}` | Zalo bot connection status |

---

## Channels — Facebook Messenger

Facebook Messenger uses an isolated internal worker. Frontend clients should
call the backend routes below; worker routes are for backend-to-worker traffic
inside the Docker network.

### Backend API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/channels/facebook/connect` | Connect an OmniRAG bot to Messenger using exported Facebook cookies |
| `POST` | `/channels/facebook/disconnect/{bot_id}` | Unload the worker session and remove Facebook config from the bot |
| `GET` | `/channels/facebook/status/{bot_id}` | Return stored Facebook config plus worker runtime status |
| `POST` | `/channels/facebook/inbound/{bot_id}` | HMAC-protected worker webhook; not intended for frontend calls |

`POST /channels/facebook/connect` body:

```json
{
  "bot_id": "aafae6f3-0a76-45a8-aa56-61bd5749da71",
  "cookies": [
    {"name": "c_user", "value": "..."},
    {"name": "xs", "value": "..."}
  ],
  "thread_whitelist": ["1280823117452427"]
}
```

`cookies` may be a flat Cookie-Editor-style list or an object containing a
`cookies` list. The backend validates critical cookies: `c_user`, `xs`, `fr`,
`datr`, and `sb`.

### Internal Worker API

Worker base URL is normally `http://fb-channel-worker:9100`.
Authenticated worker routes require `Authorization: Bearer <FB_WORKER_API_TOKEN>`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Worker liveness, version, uptime, and loaded bot count |
| `GET` | `/bots` | List loaded bot ids |
| `POST` | `/bots/{bot_id}/load` | Start a Messenger session from cookies |
| `POST` | `/bots/{bot_id}/unload` | Stop and remove a Messenger session |
| `GET` | `/bots/{bot_id}/status` | Worker runtime status for one bot |
| `POST` | `/bots/{bot_id}/send` | Send a reply, optionally with reply id and real mention metadata |
| `POST` | `/bots/{bot_id}/react` | React to a message |
| `POST` | `/bots/{bot_id}/threads/leave` | Remove the bot account from a group thread |
| `GET` | `/bots/{bot_id}/threads/{thread_id}/participants` | Fetch participants |
| `GET` | `/bots/{bot_id}/threads/{thread_id}/context` | Fetch group metadata, participants, and recent messages |

See [FACEBOOK_MESSENGER_INTEGRATION.md](FACEBOOK_MESSENGER_INTEGRATION.md) for
the event flow, normalized attachment payload, and troubleshooting.

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
