# Zalo Personal Integration

OmniRAG supports Zalo Personal Account messaging through an isolated worker
service named `zalo-personal-worker`. The worker logs in to Zalo Web through
QR code using `zca-js`, keeps long-lived session credentials in a Docker
volume, listens for direct and group messages, and forwards signed inbound
events to the backend RAG pipeline.

This integration is experimental and unofficial. Use it only for
controlled deployments with a dedicated Zalo account.

---

## Current Capabilities

| Capability | Status | Notes |
|------------|--------|-------|
| QR login | Supported | Login starts from the OmniRAG UI and is completed in the Zalo mobile app |
| Multiple accounts per bot | Supported | Accounts are stored in `channel_accounts` |
| Direct message replies | Supported | DMs are accepted without mention checks |
| Group replies | Supported | Default policy is `mention_only`; `all` and thread whitelist are available |
| HMAC-protected inbound webhook | Supported | Worker signs each backend POST with `ZALO_PERSONAL_INBOUND_SECRET` |
| Session persistence | Supported | Worker stores credentials under `/sessions/{account_id}.json` |
| Rate limiting | Supported | Default 200 replies/day/account and 5 replies/30s/account |
| Circuit breaker | Supported | Pauses noisy sessions on disconnect storms or backend failures |
| Text-only sending | Supported | Replies are sent as Zalo text messages |
| Image/audio/file handling | Not yet | Worker currently ignores non-text inbound messages |

---

## Architecture

```
Zalo app / Zalo Web
  |
  | WebSocket events through zca-js
  v
zalo-personal-worker  (port 9200, internal only)
  |
  | POST /api/v1/channels/zalo-personal/inbound/{bot_id}
  | x-zalo-personal-signature: HMAC-SHA256(body, ZALO_PERSONAL_INBOUND_SECRET)
  v
FastAPI Backend
  |
  | RAG + memory
  v
OpenRouter RAG pipeline
  |
  | POST /accounts/{account_id}/send
  v
zalo-personal-worker
  |
  v
Zalo thread
```

The backend never imports `zca-js` directly. All Zalo Web state lives in the
Node worker, and backend-to-worker calls are authenticated with a bearer token.

### Code Ownership

| Area | Path | Responsibility |
|------|------|----------------|
| Backend API | `backend/app/api/v1/endpoints/channels/zalo_personal.py` | Account CRUD, QR status, legacy routes, signed inbound webhook |
| Backend service | `backend/app/services/channels/zalo_personal_service.py` | Worker facade, DB sync, inbound RAG processing, sending replies |
| Account models | `backend/app/models/channel_account.py` | `channel_accounts` and `channel_account_access` tables |
| Account schemas | `backend/app/schemas/channel_account.py` | Request/response DTOs |
| Migration | `backend/alembic/versions/a1b2c3d4_add_channel_accounts.py` | Creates channel account tables and backfills legacy config |
| Worker API | `services/zalo-personal-worker/src/main.js` | Internal REST API on port 9200 |
| Worker manager | `services/zalo-personal-worker/src/manager.js` | QR login, credential storage, listener lifecycle, send/inbound flow |
| Worker policy | `services/zalo-personal-worker/src/policy.js` | DM/group accept rules and mention stripping |
| Worker safety | `services/zalo-personal-worker/src/rate-limiter.js`, `services/zalo-personal-worker/src/circuit-breaker.js` | Per-account send limits and pause logic |

---

## Configuration

Set these values for the backend and worker. In Docker Compose the backend
reads the `ZALO_PERSONAL_*` variables, while the worker receives the token and
secret as `WORKER_API_TOKEN` and `INBOUND_SECRET`.

```env
ZALO_PERSONAL_ENABLED=true
ZALO_PERSONAL_WORKER_URL=http://zalo-personal-worker:9200
ZALO_PERSONAL_WORKER_API_TOKEN=replace-with-strong-random-token
ZALO_PERSONAL_INBOUND_SECRET=replace-with-strong-random-hmac-secret
VITE_ENABLE_ZALO_PERSONAL=true
```

Generate strong shared secrets with:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Worker-specific optional variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `BACKEND_URL` | `http://backend:8000` | Backend base URL reached from the worker |
| `SESSIONS_DIR` | `/sessions` | Directory for saved Zalo session credentials |
| `LOG_LEVEL` | `info` | Fastify/Pino log level |
| `RATE_LIMIT_DAILY` | `200` | Max sent replies per account per day |
| `RATE_LIMIT_BURST` | `5` | Max sent replies per account per 30 seconds |
| `DISCONNECT_THRESHOLD` | `5` | Disconnects in 5 minutes before relogin is required |
| `BACKEND_FAILURE_THRESHOLD` | `10` | Failed backend inbound posts before the worker pauses messages |

---

## Docker Setup

Development:

```bash
docker compose build backend frontend zalo-personal-worker
docker compose up -d backend frontend zalo-personal-worker
docker compose logs -f zalo-personal-worker
```

Production:

```bash
docker compose -f docker-compose.prod.yml build backend frontend zalo-personal-worker
docker compose -f docker-compose.prod.yml up -d backend frontend zalo-personal-worker
```

The `zalo_personal_sessions` Docker volume persists QR login credentials across
worker restarts. Deleting the volume forces every connected Zalo account to
scan QR again.

---

## User Flow

1. Enable `ZALO_PERSONAL_ENABLED=true` on the backend and
   `VITE_ENABLE_ZALO_PERSONAL=true` for the frontend build.
2. Open a bot's config page.
3. In the Zalo Personal card, choose `Manage Accounts`.
4. Choose `Add Account`.
5. Scan the QR code with the dedicated Zalo mobile account.
6. After the worker reports `connected`, the account appears in the accounts
   table and begins listening for accepted messages.

Use a dedicated Zalo account. Do not keep the same account open in Zalo Web or
Zalo PC while the worker is running, because Zalo normally allows only one web
listener for the same account.

---

## Message Policy

Direct messages are always accepted when the account is connected.

Group messages use account policy:

| Policy | Behavior |
|--------|----------|
| `mention_only` | Reply only when the message contains `@<account display name>` or the group thread is whitelisted |
| `all` | Reply to every text message in groups |

When a group message starts with the account mention, the worker strips that
mention before sending the query into RAG. This keeps prompts cleaner while
still requiring an explicit mention by default.

---

## Backend API

All frontend-facing backend routes require the normal OmniRAG authenticated
user session. Paths below are relative to `/api/v1`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/channels/zalo-personal/bots/{bot_id}/accounts` | List Zalo Personal accounts for a bot |
| `POST` | `/channels/zalo-personal/bots/{bot_id}/accounts` | Create an account and start QR login |
| `GET` | `/channels/zalo-personal/accounts/{account_id}` | Get saved account metadata |
| `PUT` | `/channels/zalo-personal/accounts/{account_id}` | Update reply policy or thread whitelist |
| `DELETE` | `/channels/zalo-personal/accounts/{account_id}` | Unload worker session and delete account |
| `GET` | `/channels/zalo-personal/accounts/{account_id}/login-status` | Poll QR login state |
| `GET` | `/channels/zalo-personal/accounts/{account_id}/status` | Return DB config plus live worker status |
| `GET` | `/channels/zalo-personal/accounts/{account_id}/access` | List account access grants |
| `POST` | `/channels/zalo-personal/accounts/{account_id}/access` | Grant a tenant user access to the account |
| `DELETE` | `/channels/zalo-personal/accounts/{account_id}/access/{access_id}` | Revoke one access grant |
| `POST` | `/channels/zalo-personal/inbound/{bot_id}` | Internal HMAC-protected worker webhook |

Create account body:

```json
{
  "channel_type": "zalo_personal",
  "reply_policy": "mention_only",
  "thread_whitelist": []
}
```

Update account body:

```json
{
  "reply_policy": "all",
  "thread_whitelist": ["1234567890"]
}
```

Legacy single-account routes remain for backward compatibility:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/channels/zalo-personal/connect/start` | Start QR login using `bot.config.zalo_personal` |
| `GET` | `/channels/zalo-personal/login-status/{bot_id}` | Poll legacy QR login |
| `GET` | `/channels/zalo-personal/status/{bot_id}` | Legacy status |
| `POST` | `/channels/zalo-personal/disconnect/{bot_id}` | Legacy disconnect |

---

## Internal Worker API

Worker base URL is normally `http://zalo-personal-worker:9200`. All non-health
routes require `Authorization: Bearer <ZALO_PERSONAL_WORKER_API_TOKEN>`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness and loaded session count |
| `POST` | `/accounts/{account_id}/login/start` | Start QR login for one account |
| `GET` | `/accounts/{account_id}/login/status` | Current QR/login state |
| `GET` | `/accounts/{account_id}/status` | Current listener/session state |
| `POST` | `/accounts/{account_id}/send` | Send a text reply |
| `POST` | `/accounts/{account_id}/unload` | Stop listener and optionally remove saved credentials |

Legacy `/bots/{bot_id}/...` worker routes remain for older single-account
configuration.

---

## Troubleshooting

### The Zalo Personal card is missing in the UI

Set `VITE_ENABLE_ZALO_PERSONAL=true` before building or starting the frontend.
For production Docker, rebuild `frontend` after changing the variable.

### Backend returns "Zalo Personal channel is disabled"

Set `ZALO_PERSONAL_ENABLED=true` in the backend environment and restart the
backend container.

### Backend returns "not configured"

Both `ZALO_PERSONAL_WORKER_API_TOKEN` and `ZALO_PERSONAL_INBOUND_SECRET` must
be non-empty and shared by backend and worker.

### QR code expires

Close the QR dialog and create a new login attempt. If the account is already
logged in from Zalo Web or Zalo PC, log it out there first.

### Account becomes `duplicate_connection`

Another Zalo Web/PC session took over the account listener. Close the other
session and reconnect from OmniRAG.

### Account becomes `relogin_required`

The worker detected too many disconnects in a short window or credentials are
no longer valid. Delete/recreate the account or start a fresh QR login.

### Worker starts but no messages arrive

Check:

```bash
docker compose logs --tail=120 zalo-personal-worker
docker compose logs --tail=120 backend
```

Then confirm that the account status is `connected`, the group policy accepts
the message, and the account display name matches the mention text used in
group chats.

---

## Security Notes

- Treat saved Zalo session files like credentials. They allow the worker to
  operate the Zalo account.
- Keep `zalo-personal-worker` internal to the Docker network. Do not expose
  port `9200` publicly.
- Use high-entropy values for both worker bearer token and inbound HMAC secret.
- Rotate secrets and delete the `zalo_personal_sessions` volume if credentials
  may have leaked.
- Prefer a dedicated Zalo account with limited privileges.

---

## Pre-Merge Checklist

- Run `npm test` in `services/zalo-personal-worker`.
- Run `python3 -m compileall` on the backend Zalo Personal endpoint/service.
- Run frontend build/typecheck when the broader frontend tree is clean.
- Apply the Alembic migration before enabling the channel in shared
  environments.
- Verify one QR login, one direct message, and one mention-only group message
  in staging before production rollout.
