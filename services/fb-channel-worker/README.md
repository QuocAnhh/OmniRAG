# fb-channel-worker

`fb-channel-worker` is the isolated Facebook Messenger bridge for OmniRAG. It
logs in with Facebook web cookies through `fbchat-muqit`, listens to Messenger
realtime events, coalesces split text/media events, and forwards signed inbound
payloads to the backend.

For the full integration guide, see
[`docs/FACEBOOK_MESSENGER_INTEGRATION.md`](../../docs/FACEBOOK_MESSENGER_INTEGRATION.md).

## Why This Is a Separate Service

`fbchat-muqit` is licensed under GPL v3. To avoid license entanglement with the
rest of OmniRAG, this worker runs as its own Docker container with its own
Python interpreter and communicates with the backend only over HTTP.

This subfolder is distributed under **GPL v3** (see `LICENSE`). The rest of
OmniRAG is not.

## Runtime Responsibilities

- Load and unload one Messenger session per OmniRAG bot.
- Store cookie files under `/tmp/fb-cookies` with `0600` permissions.
- Enforce echo guard, optional thread whitelist, and `mention_only` group policy.
- Buffer and merge Facebook's split text/image MQTT events.
- Forward raw `attachments` plus stable `normalized_attachments` to the backend.
- Send replies, reactions, typing indicators, and group leave actions.
- Track the last bot message id per thread in memory.

## Endpoints (Internal, Port 9100)

All authenticated routes require `Authorization: Bearer <FB_WORKER_API_TOKEN>`.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Liveness probe and loaded bot count |
| `GET` | `/bots` | List loaded bot ids |
| `POST` | `/bots/{bot_id}/load` | Start a Facebook session with exported cookies |
| `POST` | `/bots/{bot_id}/unload` | Stop and remove a Facebook session |
| `GET` | `/bots/{bot_id}/status` | Current session status |
| `POST` | `/bots/{bot_id}/send` | Send a message, optionally with reply id and mentions |
| `POST` | `/bots/{bot_id}/react` | React to a message |
| `POST` | `/bots/{bot_id}/threads/leave` | Remove the bot account from a group thread |
| `GET` | `/bots/{bot_id}/threads/{thread_id}/participants` | Fetch participant list |
| `GET` | `/bots/{bot_id}/threads/{thread_id}/context` | Fetch metadata, participants, and recent messages |

## Backend Inbound Contract

After filtering and coalescing, the worker posts events to:

```http
POST {BACKEND_URL}/api/v1/channels/facebook/inbound/{bot_id}
X-FB-Worker-Signature: hmac_sha256(FB_INBOUND_SECRET, body)
```

The backend verifies the HMAC before creating an async inbound processing task.

Inbound payloads keep the raw serialized Messenger message and add:

```json
{
  "normalized_attachments": [
    {
      "type": "image",
      "url": "https://...",
      "preview_url": "https://...",
      "file_name": null,
      "mime_type": "image/jpeg",
      "width": 1080,
      "height": 1440,
      "duration_ms": null,
      "attachment_id": "123456",
      "raw_type": "ImageAttachment"
    }
  ],
  "sender_name": "Nguyen Van A"
}
```

## Environment

| Var | Description |
|-----|-------------|
| `BACKEND_URL` | Backend base URL, normally `http://backend:8000` |
| `FB_WORKER_API_TOKEN` | Bearer token accepted by worker privileged routes |
| `FB_INBOUND_SECRET` | HMAC secret used to sign worker-to-backend POSTs |
| `WORKER_API_TOKEN` | Legacy alias for `FB_WORKER_API_TOKEN` |
| `INBOUND_SECRET` | Legacy alias for `FB_INBOUND_SECRET` |
| `LOG_LEVEL` | Default `INFO` |
| `FB_COALESCE_DELAY_SECONDS` | Short merge delay for split events |
| `FB_MEDIA_COALESCE_DELAY_SECONDS` | Longer delay for media-looking prompts |
| `FB_MEDIA_STASH_SECONDS` | Time to stash image-only events awaiting a mention |

## Run Locally Without Docker

```bash
pip install -e .
FB_WORKER_API_TOKEN=dev \
FB_INBOUND_SECRET=dev \
BACKEND_URL=http://localhost:8000 \
uvicorn app.main:app --host 0.0.0.0 --port 9100 --reload
```

## Useful Logs

```bash
docker compose logs --tail=120 fb-channel-worker \
  | grep -E "on_message|BUFFERED|STASH|FLUSH|sent message|left thread"
```

Expected image + mention flow:

```text
on_message ... text='@Bot ảnh này có ý nghĩa gì' has_att=False
  -> BUFFERED ...
on_message ... text='' has_att=True
  -> BUFFERED ...
  -> FLUSH ... attachments=1 normalized=['image']
```
