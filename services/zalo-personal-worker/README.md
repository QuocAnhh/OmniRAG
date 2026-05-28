# zalo-personal-worker

Isolated OmniRAG channel worker for Zalo Personal Account sessions via
`zca-js`. It runs separately from the Python backend because `zca-js` is an
unofficial Zalo Web automation library with long-lived cookie/WebSocket state.

## Runtime Responsibilities

- Start a QR login flow per OmniRAG channel account.
- Store `cookie + imei + userAgent` under `/sessions/{account_id}.json`.
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
| `POST` | `/accounts/{account_id}/login/start` | Start QR login for a channel account |
| `GET` | `/accounts/{account_id}/login/status` | Get QR/login state |
| `GET` | `/accounts/{account_id}/status` | Current session status |
| `POST` | `/accounts/{account_id}/send` | Send a text reply |
| `POST` | `/accounts/{account_id}/unload` | Stop listener and remove saved session |
| `POST` | `/bots/{bot_id}/login/start` | Start QR login |
| `GET` | `/bots/{bot_id}/login/status` | Get QR/login state |
| `GET` | `/bots/{bot_id}/status` | Current session status |
| `POST` | `/bots/{bot_id}/send` | Send a text reply |
| `POST` | `/bots/{bot_id}/unload` | Stop listener and remove saved session |

`/bots/{bot_id}/...` routes are legacy compatibility routes for older
single-account bot config.

## Environment

| Var | Description |
|-----|-------------|
| `BACKEND_URL` | Backend base URL, normally `http://backend:8000` |
| `WORKER_API_TOKEN` | Bearer token accepted by privileged routes |
| `INBOUND_SECRET` | HMAC secret used to sign backend inbound POSTs |
| `SESSIONS_DIR` | Session credential directory, default `/sessions` |
| `PORT` | Worker port, default `9200` |
| `LOG_LEVEL` | Fastify/Pino log level, default `info` |
| `RATE_LIMIT_DAILY` | Per-account daily send limit, default `200` |
| `RATE_LIMIT_BURST` | Per-account burst send limit per 30s, default `5` |
| `DISCONNECT_THRESHOLD` | Disconnects in 5 min before relogin is required, default `5` |
| `BACKEND_FAILURE_THRESHOLD` | Backend failures before pausing inbound messages, default `10` |

Use a dedicated Zalo account. Do not open Zalo Web/PC for the same account while
the worker is running because Zalo allows only one web listener at a time.
