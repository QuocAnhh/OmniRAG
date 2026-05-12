# fb-channel-worker

Isolated microservice that bridges Facebook Messenger (via [`fbchat-muqit`](https://github.com/togashigreat/fbchat-muqit), GPL v3) to the OmniRAG backend.

## Why a separate service?

`fbchat-muqit` is licensed under GPL v3. To avoid license entanglement with the rest of OmniRAG, this worker runs as its own Docker container with its own Python interpreter and communicates with the OmniRAG backend **only over HTTP**. Source files living next to each other in the same git repository do not create a "combined work" — only runtime linking (same process / same memory) does.

This subfolder is distributed under **GPL v3** (see `LICENSE`). The rest of OmniRAG is not.

## Endpoints (internal, port 9100)

All authenticated routes require `Authorization: Bearer <WORKER_API_TOKEN>`.

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/health` | Liveness probe (Docker healthcheck) |
| `POST` | `/bots/{bot_id}/load` | Start a Facebook session with given cookies |
| `POST` | `/bots/{bot_id}/unload` | Stop and remove a Facebook session |
| `POST` | `/bots/{bot_id}/send` | Send a message to a Messenger thread |
| `GET`  | `/bots/{bot_id}/status` | Current session status |
| `GET`  | `/bots` | List loaded bot ids |

## How it talks to the backend

When the worker receives a Messenger event (after applying mention-only + echo guard filters), it pushes the event to the OmniRAG backend:

```
POST {BACKEND_URL}/api/v1/channels/facebook/inbound/{bot_id}
X-FB-Worker-Signature: hmac_sha256(INBOUND_SECRET, body)
```

The backend verifies the HMAC and queues the message into the Celery RAG pipeline.

## Environment

| Var | Description |
|---|---|
| `BACKEND_URL` | Base URL to reach OmniRAG backend (e.g. `http://backend:8000`) |
| `WORKER_API_TOKEN` | Bearer token the backend must send when calling the worker |
| `INBOUND_SECRET` | HMAC secret used to sign worker→backend POSTs |
| `LOG_LEVEL` | Default `INFO` |

## Run locally (without Docker)

```bash
pip install -e .
WORKER_API_TOKEN=dev BACKEND_URL=http://localhost:8000 INBOUND_SECRET=dev \
    uvicorn app.main:app --host 0.0.0.0 --port 9100 --reload
```
