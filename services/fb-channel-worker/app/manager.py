import asyncio
import json
import logging
import os
import time
from contextlib import AsyncExitStack
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from fbchat_muqit import Client

from . import inbound
from .config import settings

log = logging.getLogger(__name__)


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


def _serialize_message(msg: Any) -> dict[str, Any]:
    """Turn a fbchat_muqit Message struct into a JSON-safe dict for the backend."""
    def _safe(v):
        if v is None or isinstance(v, (str, int, float, bool)):
            return v
        if isinstance(v, list):
            return [_safe(x) for x in v]
        if hasattr(v, "__struct_fields__"):
            return {f: _safe(getattr(v, f, None)) for f in v.__struct_fields__}
        if hasattr(v, "name") and hasattr(v, "value"):  # Enum
            return v.name
        return str(v)

    fields = ("id", "text", "sender_id", "thread_id", "thread_type",
              "message_type", "mentions", "attachments", "timestamp",
              "replied_to_message_id")
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
                text_preview = (getattr(message, "text", "") or "")[:80]
                mentions_dump = [
                    {"user_id": getattr(m, "user_id", None),
                     "name": getattr(m, "name", None),
                     "offset": getattr(m, "offset", None),
                     "length": getattr(m, "length", None)}
                    for m in (getattr(message, "mentions", None) or [])
                ]
                log.info("on_message bot=%s sender=%s text=%r mentions=%s thread=%s",
                         self.bot_id, sender, text_preview, mentions_dump,
                         getattr(message, "thread_id", None))

                if sender and sender == self.status.uid:
                    log.info("  → SKIP echo guard")
                    return

                if self.thread_whitelist:
                    thread_id = str(getattr(message, "thread_id", "") or "")
                    if thread_id not in self.thread_whitelist:
                        log.info("  → SKIP thread not in whitelist")
                        return

                if self.reply_policy == "mention_only":
                    if not self._is_mentioned(message):
                        log.info("  → SKIP not mentioned (uid=%s)", self.status.uid)
                        return

                log.info("  → PUSH inbound to backend")
                payload = _serialize_message(message)
                await inbound.push_inbound(self.bot_id, "message", payload)
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

    async def send(self, thread_id: str, text: str, reply_to_id: Optional[str] = None) -> dict[str, Any]:
        if not self._client:
            raise RuntimeError("session not loaded")
        result = await self._client.send_message(
            text=text,
            thread_id=thread_id,
            reply_to_message=reply_to_id,
        )
        return {"message_id": result}

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
        for t in (self._listen_task, self._probe_task):
            if t and not t.done():
                t.cancel()
                try:
                    await t
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
