# zalo-personal-worker

Isolated OmniRAG channel worker for Zalo Personal Account sessions via
`zca-js`. It runs separately from the Python backend because `zca-js` is an
unofficial Zalo Web automation library with long-lived cookie/WebSocket state.

## Runtime Responsibilities

- Start a QR login flow per OmniRAG bot.
- Store `cookie + imei + userAgent` under `/sessions/{bot_id}.json`.
- Auto-load saved sessions on startup.
- Listen for text messages from Zalo direct messages and groups.
- Ignore self messages and group messages that do not match mention/whitelist policy.
- Forward HMAC-signed inbound payloads to the backend.
- Send text-only replies back through `zca-js`.

## Internal Endpoints

All non-health routes require `Authorization: Bearer <ZALO_PERSONAL_WORKER_API_TOKEN>`.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Liveness and loaded session count |
| `POST` | `/bots/{bot_id}/login/start` | Start QR login |
| `GET` | `/bots/{bot_id}/login/status` | Get QR/login state |
| `GET` | `/bots/{bot_id}/status` | Current session status |
| `POST` | `/bots/{bot_id}/send` | Send a text reply |
| `POST` | `/bots/{bot_id}/unload` | Stop listener and remove saved session |

## Environment

| Var | Description |
|-----|-------------|
| `BACKEND_URL` | Backend base URL, normally `http://backend:8000` |
| `WORKER_API_TOKEN` | Bearer token accepted by privileged routes |
| `INBOUND_SECRET` | HMAC secret used to sign backend inbound POSTs |
| `SESSIONS_DIR` | Session credential directory, default `/sessions` |
| `PORT` | Worker port, default `9200` |

Use a dedicated Zalo account. Do not open Zalo Web/PC for the same account while
the worker is running because Zalo allows only one web listener at a time.
