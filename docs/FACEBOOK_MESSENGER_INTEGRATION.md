# Facebook Messenger Integration

OmniRAG supports Facebook Messenger through an isolated worker service named
`fb-channel-worker`. The worker logs in with Facebook web cookies through
`fbchat-muqit`, listens to Messenger realtime events, filters messages by bot
mention, and forwards signed inbound events to the backend RAG pipeline.

This integration is intended for internal/controlled deployments. It uses an
unofficial Messenger client library, not the official Meta Graph API.

---

## Current Capabilities

| Capability | Status | Notes |
|------------|--------|-------|
| Cookie-based Messenger login | Supported | Requires valid browser cookies from the bot Facebook account |
| Group chat replies | Supported | Default policy is `mention_only`; the bot only replies when mentioned |
| DM replies | Supported | Worker treats DMs as replyable without mention policy |
| Split text + image coalescing | Supported | Text and image MQTT events are buffered and merged before backend processing |
| Image understanding | Supported | Image URLs are sent to OpenRouter vision before RAG response generation |
| Normalized attachments | Supported | Worker sends both raw `attachments` and stable `normalized_attachments` |
| Group context | Supported | Backend can fetch group metadata, participants, and recent messages |
| Real Facebook mentions in replies | Supported | Backend maps `@Name` text to worker mention payloads |
| Reactions | Supported | Bot reacts with receipt/completion emojis on best effort |
| Typing indicator | Supported | Worker sends typing indicator before bot replies |
| Leave group command | Supported | Example: `@Bot mày cút khỏi nhóm` |
| Last bot message tracking | Supported | Worker stores last sent bot message id per thread in memory |
| Message unsend | Not exposed | State is ready, but no chat command/API is enabled yet |
| E2EE 1-on-1 bridge | Not integrated | Keep separate if added later due licensing/runtime risk |

---

## Architecture

```
Facebook Messenger
  |
  | MQTT/Web realtime events
  v
fb-channel-worker  (port 9100, isolated GPL service)
  |
  | POST /api/v1/channels/facebook/inbound/{bot_id}
  | X-FB-Worker-Signature: HMAC-SHA256(body, FB_INBOUND_SECRET)
  v
FastAPI Backend
  |
  | group context + image description + RAG + memory
  v
OpenRouter RAG pipeline
  |
  | POST /bots/{bot_id}/send
  v
fb-channel-worker
  |
  v
Facebook Messenger thread
```

The worker is isolated because `fbchat-muqit` is GPL v3. Backend and worker do
not import each other in-process; they communicate only over HTTP with bearer
auth and HMAC-signed inbound events.

### Code Ownership

| Area | Path | Responsibility |
|------|------|----------------|
| Public backend API | `backend/app/api/v1/endpoints/channels/facebook_messenger.py` | Connect, disconnect, status, signed inbound webhook |
| Backend service | `backend/app/services/channels/facebook_messenger_service.py` | Worker facade, inbound processing, image extraction, group context, leave command |
| Worker API | `services/fb-channel-worker/app/main.py` | Internal REST endpoints on port 9100 |
| Worker session manager | `services/fb-channel-worker/app/manager.py` | Cookie login, MQTT listener, coalescing, sending, reactions, leave group |
| Worker config | `services/fb-channel-worker/app/config.py` | Tokens, HMAC secret, coalescing/stash timings, logging |

---

## Configuration

Add these to `backend/.env`:

```env
# Facebook Messenger worker auth.
# Use strong random values in shared/staging/prod environments.
FB_WORKER_API_TOKEN=replace-with-random-token
FB_INBOUND_SECRET=replace-with-random-hmac-secret
```

`docker-compose.yml` and `docker-compose.prod.yml` pass `backend/.env` into
`fb-channel-worker`, so the same values configure both sides:

| Variable | Used by | Purpose |
|----------|---------|---------|
| `FB_WORKER_API_TOKEN` | Backend + worker | Backend bearer token for privileged worker endpoints |
| `FB_INBOUND_SECRET` | Backend + worker | HMAC secret for worker-to-backend inbound events |
| `BACKEND_URL` | Worker | Backend base URL, normally `http://backend:8000` |
| `LOG_LEVEL` | Worker | Worker log verbosity |
| `FB_COALESCE_DELAY_SECONDS` | Worker | Short merge window for same-message split events |
| `FB_MEDIA_COALESCE_DELAY_SECONDS` | Worker | Longer wait when text looks like an image/media question |
| `FB_MEDIA_STASH_SECONDS` | Worker | Time to keep image-only events waiting for a later mention |

The worker also accepts legacy aliases `WORKER_API_TOKEN` and
`INBOUND_SECRET`; prefer the `FB_*` names in shared env files.

---

## Connect Flow

1. User exports cookies from the Facebook bot account.
2. Frontend posts cookies to `POST /api/v1/channels/facebook/connect`.
3. Backend validates critical cookies: `c_user`, `xs`, `fr`, `datr`, `sb`.
4. Backend calls worker `POST /bots/{bot_id}/load`.
5. Worker writes cookies to `/tmp/fb-cookies/{bot_id}.json` with `0600`
   permissions and starts a Messenger session.
6. Worker confirms login, starts MQTT listening, and returns session status.
7. Backend stores `bot.config.facebook` with uid, display name, reply policy,
   optional thread whitelist, and status.

Example backend request body:

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

`thread_whitelist` is optional. When provided, the worker ignores events from
all other Messenger threads.

---

## Inbound Message Flow

Facebook often delivers text and image from one user action as separate MQTT
events. The worker handles this before the backend sees the event:

1. Text event arrives, for example `@Bot ảnh này là gì`.
2. Worker sees a media-looking prompt and buffers it.
3. Image event arrives shortly after with empty text and an attachment.
4. Worker merges both events into one payload.
5. Worker sends raw `attachments` plus stable `normalized_attachments`.
6. Backend extracts image URLs from `normalized_attachments`, describes the
   image via OpenRouter vision, then passes the enriched prompt into RAG.

Typical worker log:

```text
on_message ... text='@Ang Nguyễn ảnh này có ý nghĩa gì' has_att=False
  -> BUFFERED (thread=1280823117452427, buf_size=1, flush_in=5.0s)
on_message ... text='' has_att=True
  -> BUFFERED (thread=1280823117452427, buf_size=2, flush_in=0.8s)
  -> FLUSH thread=1280823117452427 events=2 text='@Ang Nguyễn ...' attachments=1 normalized=['image']
```

Typical backend log:

```text
fb_inbound_processing bot=... thread=1280823117452427 is_group=True history=20 has_images=1 has_web=False
```

### Normalized Attachment Shape

Worker payloads include a stable list:

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
  ]
}
```

Supported normalized types are:

```text
image, gif, video, audio, voice, file, sticker, link, unknown
```

The backend intentionally only treats `image`, `gif`, or `image/*` MIME
attachments as image input. This avoids accidentally sending video/file preview
thumbnails to the vision model.

---

## Group Chat Behavior

The default group policy is `mention_only`.

The bot replies when:

- The message contains a structured Facebook mention for the bot.
- The text starts with `@<bot display name>`, even if the user typed the tag
  manually instead of selecting the Facebook autocomplete mention.
- The event is a DM, where mention policy is not required.
- An image-only event arrives inside the current coalescing window or media
  stash window after a valid mention.

The bot ignores:

- Its own messages, via echo guard.
- Non-whitelisted threads when `thread_whitelist` is configured.
- Group messages that do not mention the bot.

For group responses, the backend can fetch:

- Group name and description.
- Participants, nicknames, and admin flags.
- Recent thread messages.

This context is injected into the RAG system prompt so the model can understand
who is in the group and can emit real `@Name` mentions when asked.

---

## Bot Actions

### Send Message

Backend calls worker:

```http
POST /bots/{bot_id}/send
Authorization: Bearer <FB_WORKER_API_TOKEN>
```

Body:

```json
{
  "thread_id": "1280823117452427",
  "text": "Nội dung trả lời",
  "reply_to_id": "mid.$...",
  "mentions": [
    {"user_id": "100034929460590", "offset": 0, "length": 10}
  ]
}
```

Response includes the latest tracked bot message:

```json
{
  "ok": true,
  "message_id": "mid.$...",
  "last_bot_message_id": "mid.$..."
}
```

`last_bot_message_id` is currently in-memory per loaded worker session. It is
cleared when the worker unloads/restarts or when the bot leaves the thread.

### Reactions

The backend uses reactions as best-effort UX signals:

- `👀` when the inbound message is accepted.
- `❤️` after a successful bot reply.

Reaction failures are logged but do not fail the main RAG response.

### Leave Group

The backend recognizes normalized Vietnamese/English leave commands after the
bot mention is stripped.

Examples:

```text
@Ang Nguyễn out nhóm
@Ang Nguyễn rời khỏi group đi
@Ang Nguyễn mày cút khỏi nhóm
```

The backend sends a short confirmation, then calls:

```http
POST /bots/{bot_id}/threads/leave
```

The worker clears pending buffers/stashed media for that thread and calls
`remove_participant(thread_id, bot_uid)`.

---

## Public Backend API

All public backend routes are under:

```text
/api/v1/channels/facebook
```

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/connect` | Connect a bot to Facebook Messenger using exported cookies |
| `POST` | `/disconnect/{bot_id}` | Unload worker session and remove Facebook config |
| `GET` | `/status/{bot_id}` | Return stored config and worker runtime status |
| `POST` | `/inbound/{bot_id}` | HMAC-protected worker webhook; not for frontend use |

---

## Internal Worker API

Worker routes are exposed only inside the Docker network on port `9100`.
Privileged endpoints require `Authorization: Bearer <FB_WORKER_API_TOKEN>`.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Liveness probe |
| `GET` | `/bots` | List loaded bot ids |
| `POST` | `/bots/{bot_id}/load` | Start a session from cookies |
| `POST` | `/bots/{bot_id}/unload` | Stop and remove a session |
| `GET` | `/bots/{bot_id}/status` | Runtime status for one bot |
| `POST` | `/bots/{bot_id}/send` | Send a text reply, optionally with reply id and mentions |
| `POST` | `/bots/{bot_id}/react` | React to a message |
| `POST` | `/bots/{bot_id}/threads/leave` | Remove the bot account from a thread |
| `GET` | `/bots/{bot_id}/threads/{thread_id}/participants` | Fetch thread participants |
| `GET` | `/bots/{bot_id}/threads/{thread_id}/context` | Fetch metadata, participants, and recent messages |

---

## Operations

### Start or Rebuild

```bash
docker compose build backend fb-channel-worker
docker compose up -d backend fb-channel-worker
```

### Logs

```bash
docker compose logs -f fb-channel-worker
docker compose logs -f backend
```

Useful worker log patterns:

```bash
docker compose logs --tail=120 fb-channel-worker \
  | grep -E "on_message|BUFFERED|STASH|FLUSH|sent message|left thread"
```

Useful backend log patterns:

```bash
docker compose logs --tail=120 backend \
  | grep -E "fb_inbound|has_images|fb_leave|fb_connect|fb_disconnect"
```

### Verify Image + Text in Group

1. Connect the Facebook bot in the UI.
2. In a Messenger group, send one message containing an image plus
   `@Bot ảnh này có ý nghĩa gì?`.
3. Confirm worker log has `events=2`, `attachments=1`, and
   `normalized=['image']`.
4. Confirm backend log has `has_images=1`.
5. Confirm the bot response references the visual content.

---

## Troubleshooting

### Worker returns `worker not configured`

The worker did not receive a bearer token.

Check:

```env
FB_WORKER_API_TOKEN=...
FB_INBOUND_SECRET=...
```

Then restart:

```bash
docker compose up -d backend fb-channel-worker
```

### Connect fails with missing cookies

The backend requires:

```text
c_user, xs, fr, datr, sb
```

Export cookies from a logged-in Facebook web session for the bot account.
Never paste cookies into logs, screenshots, or issue comments.

### Bot sees text but not the image

Check worker logs for `FLUSH ... normalized=['image']`.

If text and image arrive far apart:

- Increase `FB_MEDIA_COALESCE_DELAY_SECONDS`.
- Increase `FB_MEDIA_STASH_SECONDS`.
- Ask users to send image and mention close together.

### Bot replies in a group when it should not

Confirm `reply_policy` is `mention_only` in `bot.config.facebook` and worker
load payload. If needed, set `thread_whitelist` during connect.

### Bot does not leave group

The leave command is only valid in group/community threads. If the command is
matched but `remove_participant` fails, Facebook may be rejecting the action for
that account/session. Check worker logs around `leave thread failed`.

### `/health` is degraded because Qdrant health is 404

This is separate from Facebook Messenger. The backend process can still be
running while `/health` reports degraded if the configured Qdrant health URL
does not match the Qdrant version.

---

## Security and Maintenance Notes

- Treat Facebook cookies like credentials. They grant account access.
- Do not commit cookies or include them in logs.
- Worker logging redacts known sensitive cookie keys.
- Rotate `FB_WORKER_API_TOKEN` and `FB_INBOUND_SECRET` in shared environments.
- Worker sessions are in-memory. Restarting the worker requires reconnecting
  Facebook bots.
- `last_bot_message_id` is intentionally in-memory for now; do not build user
  visible unsend UX until an explicit unsend endpoint/command is implemented
  and tested.
- The integration is unofficial and may break if Facebook changes web/MQTT
  behavior.
