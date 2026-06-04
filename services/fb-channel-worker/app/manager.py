import asyncio
import json
import logging
import os
import random
import re
import time
from contextlib import AsyncExitStack
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from fbchat_muqit import Client, Mention
from fbchat_muqit.models.thread import ThreadType

from . import inbound
from .config import settings

log = logging.getLogger(__name__)
_MEDIA_INTENT_RE = re.compile(
    r"\b(ảnh|hình|photo|image|picture|pic|video|clip|file|đính kèm)\b|"
    r"(cái này|này là|đây là|trên có|trong này|này có)",
    re.IGNORECASE,
)
_URL_KEY_NAMES = {
    "url", "uri", "src", "imageurl", "animatedimageurl",
    "playableurl", "downloadurl",
}
_PREVIEW_URL_KEY_NAMES = {
    "previewurl", "thumbnailurl", "largepreviewurl",
}
_IMAGE_HINT_KEY_NAMES = {
    "image", "imageurl", "animatedimageurl", "preview",
    "largepreview", "thumbnail",
}
_ID_KEY_NAMES = {
    "id", "attachmentid", "attachmentfbid", "fbid", "stickerid",
    "targetid", "uid",
}
_MIME_KEY_NAMES = {
    "mimetype", "attachmentmimetype", "contenttype", "typeattachment",
}
_FILE_NAME_KEY_NAMES = {
    "filename", "file_name", "name", "title",
}
_WIDTH_KEY_NAMES = {
    "width", "previewwidth", "imagewidth",
}
_HEIGHT_KEY_NAMES = {
    "height", "previewheight", "imageheight",
}
_DURATION_KEY_NAMES = {
    "durationms", "duration_ms", "playabledurationms", "playable_duration_ms",
    "duration",
}


@dataclass
class SessionStatus:
    bot_id: str
    uid: str = ""
    name: str = ""
    loaded: bool = False
    mqtt_connected: bool = False
    connected_at: Optional[str] = None
    last_event_at: Optional[str] = None
    last_probe_ok_at: Optional[str] = None
    last_error: Optional[str] = None
    error_count: int = 0
    reply_policy: str = "mention_only"
    thread_whitelist: Optional[list[str]] = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "bot_id": self.bot_id,
            "uid": self.uid,
            "name": self.name,
            "loaded": self.loaded,
            "mqtt_connected": self.mqtt_connected,
            "connected_at": self.connected_at,
            "last_event_at": self.last_event_at,
            "last_probe_ok_at": self.last_probe_ok_at,
            "last_error": self.last_error,
            "error_count": self.error_count,
            "reply_policy": self.reply_policy,
            "thread_whitelist": self.thread_whitelist,
        }


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _safe(v: Any) -> Any:
    if v is None or isinstance(v, (str, int, float, bool)):
        return v
    if isinstance(v, dict):
        return {str(k): _safe(val) for k, val in v.items()}
    if isinstance(v, list):
        return [_safe(x) for x in v]
    if hasattr(v, "__struct_fields__"):
        return {f: _safe(getattr(v, f, None)) for f in v.__struct_fields__}
    if hasattr(v, "__dict__"):
        return {
            str(k): _safe(val)
            for k, val in vars(v).items()
            if not str(k).startswith("_")
        }
    if hasattr(v, "name") and hasattr(v, "value"):  # Enum
        return v.name
    return str(v)


def _key_name(value: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value).lower())


def _walk_values(value: Any, path: tuple[str, ...] = ()):
    if isinstance(value, dict):
        for key, nested in value.items():
            next_path = (*path, str(key))
            yield next_path, nested
            yield from _walk_values(nested, next_path)
    elif isinstance(value, list):
        for nested in value:
            yield from _walk_values(nested, path)


def _first_scalar(data: dict[str, Any], key_names: set[str]) -> Any:
    for path, value in _walk_values(data):
        if path and _key_name(path[-1]) in key_names and isinstance(value, (str, int, float)):
            return value
    return None


def _first_int(data: dict[str, Any], key_names: set[str]) -> Optional[int]:
    value = _first_scalar(data, key_names)
    if isinstance(value, bool) or value is None:
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _collect_attachment_urls(data: dict[str, Any]) -> tuple[Optional[str], Optional[str], bool]:
    urls: list[str] = []
    previews: list[str] = []
    image_hint = False

    for path, value in _walk_values(data):
        if not path:
            continue
        path_names = {_key_name(part) for part in path}
        last = _key_name(path[-1])
        if path_names & _IMAGE_HINT_KEY_NAMES:
            image_hint = True
        if not isinstance(value, str) or not value.startswith("http"):
            continue
        if last in _PREVIEW_URL_KEY_NAMES or path_names & {"preview", "thumbnail", "largepreview"}:
            if value not in previews:
                previews.append(value)
        elif last in _URL_KEY_NAMES:
            if value not in urls:
                urls.append(value)

    return (urls[0] if urls else None, previews[0] if previews else None, image_hint)


def _attachment_type(raw_type: str, data: dict[str, Any], image_hint: bool) -> str:
    hints = [raw_type.lower()]
    for path, value in _walk_values(data):
        if path and _key_name(path[-1]) in {"type", "typename", "attachmenttype", *_MIME_KEY_NAMES}:
            if isinstance(value, (str, int, float)):
                hints.append(str(value).lower())
    hint = " ".join(hints)
    mime_type = str(_first_scalar(data, _MIME_KEY_NAMES) or "").lower()
    file_name = str(_first_scalar(data, _FILE_NAME_KEY_NAMES) or "").lower()

    if "sticker" in hint:
        return "sticker"
    if "voice" in hint or "soundbite" in hint:
        return "voice"
    if "audio" in hint or mime_type.startswith("audio/"):
        return "audio"
    if "video" in hint or mime_type.startswith("video/"):
        return "video"
    if "gif" in hint or "animatedimage" in hint or file_name.endswith(".gif"):
        return "gif"
    if "file" in hint or "document" in hint or mime_type.startswith("application/"):
        return "file"
    if "link" in hint or "share" in hint or "xma" in hint:
        return "link"
    if "image" in hint or mime_type.startswith("image/"):
        return "image"
    if image_hint:
        return "image"
    return "unknown"


def _normalize_attachment(raw_attachment: Any) -> dict[str, Any]:
    data = _safe(raw_attachment)
    if not isinstance(data, dict):
        data = {"value": data}

    raw_type = type(raw_attachment).__name__ if raw_attachment is not None else None
    url, preview_url, image_hint = _collect_attachment_urls(data)
    normalized_type = _attachment_type(raw_type or "", data, image_hint)

    if normalized_type in {"image", "gif"} and url is None:
        url = preview_url

    attachment_id = _first_scalar(data, _ID_KEY_NAMES)
    if attachment_id is not None:
        attachment_id = str(attachment_id)

    return {
        "type": normalized_type,
        "url": url,
        "preview_url": preview_url,
        "file_name": _first_scalar(data, _FILE_NAME_KEY_NAMES),
        "mime_type": _first_scalar(data, _MIME_KEY_NAMES),
        "width": _first_int(data, _WIDTH_KEY_NAMES),
        "height": _first_int(data, _HEIGHT_KEY_NAMES),
        "duration_ms": _first_int(data, _DURATION_KEY_NAMES),
        "attachment_id": attachment_id,
        "raw_type": raw_type,
    }


def _normalize_attachments(raw_attachments: list[Any]) -> list[dict[str, Any]]:
    return [_normalize_attachment(att) for att in raw_attachments if att is not None]


def _sent_message_id(result: Any) -> str:
    if result is None:
        return ""
    if isinstance(result, dict):
        value = result.get("message_id") or result.get("messageId") or result.get("id")
        return str(value or "")
    return str(result)


def _serialize_message(msg: Any) -> dict[str, Any]:
    """Turn a fbchat_muqit Message struct into a JSON-safe dict for the backend."""
    fields = ("id", "text", "sender_id", "thread_id", "thread_type",
              "message_type", "mentions", "attachments", "timestamp",
              "replied_to_message_id", "replied_to_message")
    out: dict[str, Any] = {}
    for f in fields:
        if hasattr(msg, f):
            out[f] = _safe(getattr(msg, f))
    return out


class BotSession:
    def __init__(
        self,
        bot_id: str,
        cookies_payload: list[dict[str, Any]] | dict[str, Any],
        reply_policy: str = "mention_only",
        thread_whitelist: Optional[list[str]] = None,
    ):
        self.bot_id = bot_id
        self.reply_policy = reply_policy
        self.thread_whitelist = set(thread_whitelist) if thread_whitelist else None
        self.status = SessionStatus(
            bot_id=bot_id,
            reply_policy=reply_policy,
            thread_whitelist=list(self.thread_whitelist) if self.thread_whitelist else None,
        )
        self._cookies_path = self._write_cookies(cookies_payload)
        self._client: Optional[Client] = None
        self._stack: Optional[AsyncExitStack] = None
        self._listen_task: Optional[asyncio.Task] = None
        self._probe_task: Optional[asyncio.Task] = None
        self._consecutive_probe_fails = 0
        self._stopped = False
        self._user_cache: dict[str, str] = {}  # uid → display name
        # Event coalescing: FB sends text and image as separate MQTT events ~300ms apart.
        # In practice image events can lag text by several seconds, so media-looking
        # prompts use a longer delay and image-only events can be stashed briefly.
        self._msg_buffer: dict[str, list] = {}          # thread_id → [raw message objects]
        self._pending_flush: dict[str, asyncio.Task] = {}  # thread_id → flush task
        self._media_stash: dict[str, list[tuple[float, str, Any]]] = {}
        self._last_bot_message_by_thread: dict[str, str] = {}

    def _write_cookies(self, payload: Any) -> str:
        os.makedirs(settings.COOKIES_DIR, exist_ok=True)
        # Accept either flat list (preferred) or Cookie-Editor dict {"cookies": [...]}.
        cookies = payload["cookies"] if isinstance(payload, dict) and "cookies" in payload else payload
        if not isinstance(cookies, list) or not cookies:
            raise ValueError("cookies payload must be a non-empty list")
        path = os.path.join(settings.COOKIES_DIR, f"{self.bot_id}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(cookies, f)
        os.chmod(path, 0o600)
        return path

    def _delete_cookies(self) -> None:
        try:
            if self._cookies_path and os.path.exists(self._cookies_path):
                os.remove(self._cookies_path)
        except Exception:
            log.exception("failed to delete cookies file bot=%s", self.bot_id)

    @staticmethod
    def _decode_name(raw: str) -> str:
        """fbchat-muqit returns names with unicode-escape literals (e.g. 'Ang Nguy\\u1ec5n')
        instead of decoded chars ('Ang Nguyễn'). Decode them so text-based mention
        matching works against what users actually type."""
        if not raw:
            return ""
        try:
            return raw.encode("latin-1", "backslashreplace").decode("unicode_escape")
        except Exception:
            return raw

    async def start(self) -> None:
        client = Client(cookies_file_path=self._cookies_path)
        stack = AsyncExitStack()
        await stack.enter_async_context(client)
        self._client = client
        self._stack = stack

        self._register_handlers()

        self.status.uid = str(client.uid or "")
        self.status.name = self._decode_name(str(client.name or ""))
        self.status.loaded = True
        self.status.connected_at = _now_iso()
        self.status.last_error = None

        self._listen_task = asyncio.create_task(self._listen_loop(), name=f"listen:{self.bot_id}")
        self._probe_task = asyncio.create_task(self._probe_loop(), name=f"probe:{self.bot_id}")

        log.info("session started bot=%s uid=%s name=%s policy=%s",
                 self.bot_id, self.status.uid, self.status.name, self.reply_policy)

    async def _listen_loop(self) -> None:
        assert self._client is not None
        try:
            await self._client.listen()
            self.status.mqtt_connected = True
        except asyncio.CancelledError:
            raise
        except Exception as e:
            self.status.mqtt_connected = False
            self.status.last_error = f"listen: {type(e).__name__}: {e}"
            log.exception("listen loop crashed bot=%s", self.bot_id)

    def _register_handlers(self) -> None:
        assert self._client is not None
        client = self._client

        @client.event
        async def on_message(message):
            try:
                self.status.mqtt_connected = True
                self.status.last_event_at = _now_iso()

                sender = str(getattr(message, "sender_id", "") or "")
                thread_id = str(getattr(message, "thread_id", "") or "")
                text_raw = (getattr(message, "text", "") or "").strip()
                has_attachments = bool(getattr(message, "attachments", None))
                mentions_dump = [
                    {"user_id": getattr(m, "user_id", None),
                     "offset": getattr(m, "offset", None),
                     "length": getattr(m, "length", None)}
                    for m in (getattr(message, "mentions", None) or [])
                ]
                log.info("on_message bot=%s sender=%s text=%r has_att=%s mentions=%s thread=%s",
                         self.bot_id, sender, text_raw[:80], has_attachments,
                         mentions_dump, thread_id)

                # Echo guard
                if sender and sender == self.status.uid:
                    log.info("  → SKIP echo guard")
                    return

                # Thread whitelist filter
                if self.thread_whitelist and thread_id not in self.thread_whitelist:
                    log.info("  → SKIP thread not in whitelist")
                    return

                # Mention / DM policy check
                thread_type_val = getattr(message, "thread_type", None)
                is_dm = (thread_type_val == ThreadType.USER)
                is_mentioned = self._is_mentioned(message)
                thread_has_pending = bool(self._msg_buffer.get(thread_id))

                if self.reply_policy == "mention_only" and not is_dm:
                    # Allow image-only events that piggyback a just-mentioned thread (within buffer window)
                    if not is_mentioned and not (has_attachments and thread_has_pending):
                        if has_attachments:
                            self._stash_media(thread_id, sender, message)
                            log.info("  → STASH media awaiting mention (thread=%s)", thread_id)
                            return
                        log.info("  → SKIP not mentioned (uid=%s)", self.status.uid)
                        return

                if is_mentioned:
                    stashed = self._pop_stashed_media(thread_id, sender)
                    if stashed:
                        self._msg_buffer.setdefault(thread_id, []).extend(stashed)
                        log.info("  → MERGED stashed media (thread=%s, count=%d)", thread_id, len(stashed))

                # Buffer the event; flush after 600ms so text+image arrive together
                self._msg_buffer.setdefault(thread_id, []).append(message)
                existing = self._pending_flush.pop(thread_id, None)
                if existing:
                    existing.cancel()
                delay = self._flush_delay(message)
                self._pending_flush[thread_id] = asyncio.create_task(
                    self._flush_thread(thread_id, delay)
                )
                log.info("  → BUFFERED (thread=%s, buf_size=%d, flush_in=%.1fs)",
                         thread_id, len(self._msg_buffer[thread_id]), delay)

            except Exception:
                self.status.error_count += 1
                self.status.last_error = "on_message handler exception"
                log.exception("on_message handler failed bot=%s", self.bot_id)

        # Optional: forward listening event so we know MQTT is healthy
        @client.event
        async def on_listening():
            self.status.mqtt_connected = True
            log.info("MQTT listening confirmed bot=%s", self.bot_id)

        @client.event
        async def on_disconnect(*_args, **_kwargs):
            self.status.mqtt_connected = False
            log.warning("MQTT disconnected bot=%s", self.bot_id)

    def _is_mentioned(self, message: Any) -> bool:
        """Two-tier mention check:
        1. Structured mention (FB autocomplete dropdown → mentions list has user_id)
        2. Text fallback: message text starts with @<bot_display_name>
           (handles users typing "@<name>" manually without picking from dropdown,
            which is the common real-world pattern).
        """
        uid = self.status.uid
        if not uid:
            return False

        # Tier 1: structured mention from MQTT prng payload
        mentions = getattr(message, "mentions", None) or []
        for m in mentions:
            mid = getattr(m, "user_id", None)
            if mid is not None and str(mid) == uid:
                return True

        # Tier 2: text-based fallback — match "@<display_name>" at start (case-insensitive)
        name = (self.status.name or "").strip()
        text = (getattr(message, "text", "") or "").strip()
        if name and text.lower().startswith(f"@{name.lower()}"):
            return True

        return False

    async def _probe_loop(self) -> None:
        assert self._client is not None
        while not self._stopped:
            try:
                await asyncio.sleep(settings.PROBE_INTERVAL_SECONDS)
            except asyncio.CancelledError:
                return
            if self._stopped:
                return
            try:
                await self._client.fetch_user_info(self._client.uid)
                self._consecutive_probe_fails = 0
                self.status.last_probe_ok_at = _now_iso()
            except asyncio.CancelledError:
                return
            except Exception as e:
                self._consecutive_probe_fails += 1
                self.status.last_error = f"probe: {type(e).__name__}: {e}"
                log.warning("probe failed bot=%s fails=%d err=%s",
                            self.bot_id, self._consecutive_probe_fails, e)
                if self._consecutive_probe_fails >= settings.PROBE_MAX_CONSECUTIVE_FAILS:
                    log.error("session expired bot=%s — stopping", self.bot_id)
                    self.status.last_error = "session_expired"
                    asyncio.create_task(self.stop())
                    return

    def _flush_delay(self, message: Any) -> float:
        text = (getattr(message, "text", "") or "").strip()
        if getattr(message, "attachments", None):
            return settings.FB_COALESCE_DELAY_SECONDS
        if text and _MEDIA_INTENT_RE.search(text):
            return settings.FB_MEDIA_COALESCE_DELAY_SECONDS
        return settings.FB_COALESCE_DELAY_SECONDS

    def _stash_media(self, thread_id: str, sender: str, message: Any) -> None:
        if not thread_id:
            return
        expires_at = time.monotonic() + settings.FB_MEDIA_STASH_SECONDS
        self._media_stash.setdefault(thread_id, []).append((expires_at, sender, message))

    def _pop_stashed_media(self, thread_id: str, sender: str) -> list[Any]:
        now = time.monotonic()
        kept: list[tuple[float, str, Any]] = []
        matched: list[Any] = []
        for expires_at, stashed_sender, msg in self._media_stash.get(thread_id, []):
            if expires_at <= now:
                continue
            if not sender or not stashed_sender or stashed_sender == sender:
                matched.append(msg)
            else:
                kept.append((expires_at, stashed_sender, msg))
        if kept:
            self._media_stash[thread_id] = kept
        else:
            self._media_stash.pop(thread_id, None)
        return matched

    async def _flush_thread(self, thread_id: str, delay: float) -> None:
        """After the coalescing delay, merge text + attachments and push once."""
        await asyncio.sleep(delay)
        msgs = self._msg_buffer.pop(thread_id, [])
        self._pending_flush.pop(thread_id, None)
        if not msgs:
            return

        # Merge: pick text from the text-bearing message, collect all attachments
        base_msg = msgs[0]
        merged_text = ""
        merged_sender_id = ""
        merged_attachments: list = []

        for msg in msgs:
            t = (getattr(msg, "text", "") or "").strip()
            if t and not merged_text:
                merged_text = t
                base_msg = msg
                merged_sender_id = str(getattr(msg, "sender_id", "") or "")
            atts = getattr(msg, "attachments", None) or []
            merged_attachments.extend([a for a in atts if a is not None])

        if not merged_sender_id:
            merged_sender_id = str(getattr(base_msg, "sender_id", "") or "")

        sender_name = await self.resolve_user_name(merged_sender_id) if merged_sender_id else ""

        payload = _serialize_message(base_msg)
        normalized_attachments = _normalize_attachments(merged_attachments)
        if merged_text:
            payload["text"] = merged_text
        if merged_attachments:
            payload["attachments"] = [_safe(a) for a in merged_attachments]
        payload["normalized_attachments"] = normalized_attachments
        payload["sender_name"] = sender_name

        log.info("  → FLUSH thread=%s events=%d text=%r attachments=%d normalized=%s",
                 thread_id, len(msgs), merged_text[:60], len(merged_attachments),
                 [att["type"] for att in normalized_attachments])
        await inbound.push_inbound(self.bot_id, "message", payload)

    async def resolve_user_name(self, uid: str) -> str:
        """Cached name lookup — calls fetch_user_info at most once per uid per session."""
        if uid in self._user_cache:
            return self._user_cache[uid]
        if not self._client:
            return ""
        try:
            users = await self._client.fetch_user_info(uid)
            user = users.get(uid)
            name = self._decode_name(str(getattr(user, "name", "") or ""))
            self._user_cache[uid] = name
            return name
        except Exception:
            log.warning("resolve_user_name failed uid=%s", uid)
            return ""

    async def get_participants(self, thread_id: str) -> list[dict[str, str]]:
        """Return [{user_id, name}] for all thread members, excluding the bot itself."""
        ctx = await self.get_thread_context(thread_id, message_limit=0)
        return ctx.get("participants", [])

    async def get_thread_context(
        self,
        thread_id: str,
        message_limit: int = 20,
    ) -> dict[str, Any]:
        """Fetch group metadata, member list, and recent message history in parallel."""
        if not self._client:
            return {}

        info_coro = self._client.fetch_thread_info([thread_id])
        msg_coro = (
            self._client.fetch_thread_messages(thread_id, message_limit)
            if message_limit > 0
            else asyncio.sleep(0, result=None)
        )

        threads_result, messages_result = await asyncio.gather(
            info_coro, msg_coro, return_exceptions=True
        )

        context: dict[str, Any] = {
            "group_name": "",
            "description": "",
            "participants": [],
            "recent_messages": [],
        }

        # ── Thread metadata + participants ────────────────────────────────
        name_map: dict[str, str] = {self.status.uid: self.status.name or "Bot"}
        if isinstance(threads_result, Exception):
            log.warning("fetch_thread_info failed thread=%s: %s", thread_id, threads_result)
        elif threads_result:
            thread = threads_result[0]
            context["group_name"] = thread.name or ""
            context["description"] = thread.description or ""
            admin_ids = {str(a) for a in (thread.thread_admins or ())}
            nicknames: dict[str, str] = thread.participants_nickname or {}
            participants = []
            for user in (thread.all_participants or ()):
                uid = str(getattr(user, "id", "") or "")
                if not uid or uid == self.status.uid:
                    continue
                name = self._decode_name(str(getattr(user, "name", "") or ""))
                first_name = self._decode_name(str(getattr(user, "first_name", "") or ""))
                nickname = nicknames.get(uid, "")
                if name:
                    self._user_cache[uid] = name
                    name_map[uid] = name
                participants.append({
                    "user_id": uid,
                    "name": name,
                    "first_name": first_name or (name.split()[0] if name else ""),
                    "is_admin": uid in admin_ids,
                    "nickname": nickname,
                })
            context["participants"] = participants

        # ── Recent messages ───────────────────────────────────────────────
        if isinstance(messages_result, Exception):
            log.warning("fetch_thread_messages failed thread=%s: %s", thread_id, messages_result)
        elif messages_result:
            msgs = []
            for msg in reversed(messages_result):  # oldest → newest for LLM context
                text = (getattr(msg, "text", "") or "").strip()
                if not text:
                    continue
                uid = str(getattr(msg, "sender_id", "") or "")
                sender_name = name_map.get(uid) or uid
                msgs.append({
                    "sender_id": uid,
                    "sender_name": sender_name,
                    "text": text,
                    "timestamp": getattr(msg, "timestamp", 0),
                })
            context["recent_messages"] = msgs

        return context

    async def send_typing(self, thread_id: str) -> None:
        """Send typing indicator — fire and forget, never raises."""
        if not self._client:
            return
        thread_type = ThreadType.GROUP if self.reply_policy == "mention_only" else ThreadType.USER
        try:
            await self._client.typing(thread_id, True, thread_type)
        except Exception:
            pass  # best-effort

    async def send(
        self,
        thread_id: str,
        text: str,
        reply_to_id: Optional[str] = None,
        mentions: Optional[list[dict]] = None,
    ) -> dict[str, Any]:
        if not self._client:
            raise RuntimeError("session not loaded")

        # Determine thread type for typing indicator (group vs DM)
        thread_type = ThreadType.GROUP if self.reply_policy == "mention_only" else ThreadType.USER

        # Random delay (1–3s) so replies feel more human
        await asyncio.sleep(random.uniform(1.0, 3.0))

        # Show typing indicator while "composing"
        try:
            await self._client.typing(thread_id, True, thread_type)
        except Exception:
            pass  # typing indicator is best-effort

        # Simulate typing time proportional to message length (max 5s)
        typing_delay = min(len(text) / 200, 5.0)
        await asyncio.sleep(typing_delay)

        # Stop typing indicator
        try:
            await self._client.typing(thread_id, False, thread_type)
        except Exception:
            pass

        mention_objs: Optional[list[Mention]] = None
        if mentions:
            objs = [
                Mention(
                    user_id=str(m["user_id"]),
                    offset=int(m["offset"]),
                    length=int(m["length"]),
                )
                for m in mentions
                if m.get("user_id") and int(m.get("length", 0)) > 0
            ]
            mention_objs = objs or None

        result = await self._client.send_message(
            text=text,
            thread_id=thread_id,
            reply_to_message=reply_to_id,
            mentions=mention_objs,
        )
        message_id = _sent_message_id(result)
        if message_id:
            self._last_bot_message_by_thread[thread_id] = message_id
            log.info("sent message bot=%s thread=%s message_id=%s",
                     self.bot_id, thread_id, message_id)
        return {
            "message_id": result,
            "last_bot_message_id": self._last_bot_message_by_thread.get(thread_id),
        }

    async def react(self, message_id: str, thread_id: str, emoji: str) -> None:
        if not self._client:
            raise RuntimeError("session not loaded")
        await self._client.react(emoji, message_id, thread_id)

    async def leave_thread(self, thread_id: str) -> None:
        if not self._client:
            raise RuntimeError("session not loaded")
        if not self.status.uid:
            raise RuntimeError("missing bot uid")

        pending = self._pending_flush.pop(thread_id, None)
        if pending and not pending.done():
            pending.cancel()
        self._msg_buffer.pop(thread_id, None)
        self._media_stash.pop(thread_id, None)

        await self._client.remove_participant(thread_id, self.status.uid)
        self._last_bot_message_by_thread.pop(thread_id, None)
        log.info("left thread bot=%s thread=%s uid=%s", self.bot_id, thread_id, self.status.uid)

    async def stop(self) -> None:
        if self._stopped:
            return
        self._stopped = True
        self.status.loaded = False
        self.status.mqtt_connected = False
        if self._client is not None:
            try:
                await self._client.stop_listening()
            except Exception:
                log.exception("stop_listening failed bot=%s", self.bot_id)
        for t in (self._listen_task, self._probe_task, *self._pending_flush.values()):
            if t and not t.done():
                t.cancel()
                try:
                    await t
                except asyncio.CancelledError:
                    pass
                except Exception:
                    pass
        if self._stack is not None:
            try:
                await self._stack.aclose()
            except Exception:
                log.exception("session stack close failed bot=%s", self.bot_id)
        self._delete_cookies()
        log.info("session stopped bot=%s", self.bot_id)


class BotManager:
    def __init__(self) -> None:
        self._sessions: dict[str, BotSession] = {}
        self._lock = asyncio.Lock()

    async def load(
        self,
        bot_id: str,
        cookies_payload: Any,
        reply_policy: str = "mention_only",
        thread_whitelist: Optional[list[str]] = None,
    ) -> SessionStatus:
        async with self._lock:
            existing = self._sessions.pop(bot_id, None)
        if existing is not None:
            await existing.stop()

        session = BotSession(bot_id, cookies_payload, reply_policy, thread_whitelist)
        try:
            await session.start()
        except Exception:
            session._delete_cookies()
            raise

        async with self._lock:
            self._sessions[bot_id] = session
        return session.status

    async def unload(self, bot_id: str) -> bool:
        async with self._lock:
            session = self._sessions.pop(bot_id, None)
        if session is None:
            return False
        await session.stop()
        return True

    def get(self, bot_id: str) -> Optional[BotSession]:
        return self._sessions.get(bot_id)

    def list_ids(self) -> list[str]:
        return list(self._sessions.keys())

    async def auto_restore(self) -> None:
        """Restore all saved bot sessions from cookies dir on startup."""
        import glob
        if not os.path.isdir(settings.COOKIES_DIR):
            return
        for path in glob.glob(os.path.join(settings.COOKIES_DIR, "*.json")):
            bot_id = os.path.splitext(os.path.basename(path))[0]
            try:
                with open(path, "r") as f:
                    cookies = json.load(f)
                # Use default reply_policy — will be updated by backend on next status sync
                await self.load(bot_id, cookies, reply_policy="mention_only")
                log.info("auto_restore: loaded saved session bot=%s", bot_id)
            except Exception:
                log.exception("auto_restore: failed to restore bot=%s, removing stale cookies", bot_id)
                try:
                    os.remove(path)
                except Exception:
                    pass

    async def stop_all(self) -> None:
        async with self._lock:
            sessions = list(self._sessions.values())
            self._sessions.clear()
        for s in sessions:
            try:
                await s.stop()
            except Exception:
                log.exception("stop_all: session %s failed to stop cleanly", s.bot_id)


manager = BotManager()
