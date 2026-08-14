"""Bot identity and config helpers.

Bot.config holds both user-editable RAG settings and the credentials written by
the channel connect flows (Telegram bot tokens, webhook secrets, Facebook and
Zalo session material). The read and write rules here have to be applied
together — see redact_config and merge_config below.

Kept free of heavy imports so the rules stay unit-testable on their own.
"""
from __future__ import annotations

import re
from typing import Any, Dict

# Sub-objects owned by the /channels/*/connect flows. Clients may never write
# these through PUT /bots/{bot_id}; they are stripped from any incoming config.
CHANNEL_CONFIG_KEYS = frozenset({
    "telegram",
    "zalo_bot",
    "zalo_personal",
    "zalo_integration",
    "facebook",
})

# Truthy on purpose. The Channels tab decides whether a bot is connected by
# testing config.telegram?.bot_token for truthiness, so dropping the key would
# make connected bots render as disconnected. A sentinel keeps the UI correct
# without shipping the credential.
REDACTED = "__REDACTED__"

_SECRET_LEAF = re.compile(
    r"(token|secret|password|passwd|cookie|session|credential|api[_-]?key|qr_image)",
    re.IGNORECASE,
)


# bot_id becomes a filesystem path segment (LightRAG working_dir) and a Qdrant
# workspace name. Hex, dashes and underscores only — no dots and no separators,
# so "..", "/" and absolute paths can never appear.
SAFE_BOT_ID = re.compile(r"[A-Za-z0-9_-]{1,64}")


def validate_bot_id(bot_id: str) -> str:
    """Return bot_id unchanged, or raise if it is unsafe as a path segment.

    Validates and rejects — deliberately never rewrites. Hashing or slugifying
    would change working_dir for every existing bot and orphan the knowledge
    graphs already on disk.
    """
    if not isinstance(bot_id, str) or not SAFE_BOT_ID.fullmatch(bot_id):
        raise ValueError(f"Invalid bot_id for storage path/workspace: {bot_id!r}")
    return bot_id


def kg_cache_key(bot_id: str, query_text: str, mode: str) -> str:
    """Cache key for LightRAG knowledge-graph query results.

    bot_id MUST be part of the key: the cache is a module-level global shared by
    every LightRAGService in the process, so a key of only (mode, query) served
    one bot's graph context to a different bot — and therefore a different
    tenant — whenever the query text matched.
    """
    return f"{bot_id}:{mode}:{query_text.strip().lower()[:200]}"


def _redact_value(key: str, value: Any) -> Any:
    if isinstance(value, dict):
        return {k: _redact_value(k, v) for k, v in value.items()}
    if isinstance(value, list):
        return [_redact_value(key, v) for v in value]
    if _SECRET_LEAF.search(key) and value not in (None, "", False):
        return REDACTED
    return value


def redact_config(config: Dict[str, Any] | None) -> Dict[str, Any]:
    """Return a copy of config with credential-shaped leaves replaced.

    Only the channel sub-objects are walked. The RAG settings the UI edits
    (model, temperature, system_prompt, chunking, ...) pass through untouched.
    """
    if not config:
        return {}
    out: Dict[str, Any] = {}
    for key, value in config.items():
        if key in CHANNEL_CONFIG_KEYS and isinstance(value, dict):
            out[key] = {k: _redact_value(k, v) for k, v in value.items()}
        else:
            out[key] = value
    return out


def contains_redacted_sentinel(value: Any) -> bool:
    """True if the sentinel appears anywhere — a client echoing a redacted read."""
    if isinstance(value, str):
        return value == REDACTED
    if isinstance(value, dict):
        return any(contains_redacted_sentinel(v) for v in value.values())
    if isinstance(value, list):
        return any(contains_redacted_sentinel(v) for v in value)
    return False


def merge_config(existing: Dict[str, Any] | None, incoming: Dict[str, Any] | None) -> Dict[str, Any]:
    """Merge a client-supplied config over the stored one.

    Two rules, both load-bearing:

    1. Channel sub-objects are taken from `existing` only. The frontend reads
       the whole config and PUTs it back — including an automatic background
       save after a knowledge-graph build — so a redacted read would otherwise
       write the sentinel over a live token and silently kill the channel.
    2. Everything else is merged rather than replaced, so a partial update
       cannot drop keys the client did not send.

    Returns a new dict; callers must assign it (or call flag_modified), since
    Bot.config is plain JSONB with no mutation tracking.
    """
    merged: Dict[str, Any] = dict(existing or {})
    for key, value in (incoming or {}).items():
        if key in CHANNEL_CONFIG_KEYS:
            continue  # owned by the connect flows
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = {**merged[key], **value}
        else:
            merged[key] = value
    return merged
