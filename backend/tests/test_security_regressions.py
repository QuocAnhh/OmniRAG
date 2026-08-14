"""Regression tests for fixed security findings.

Each test pins one specific vulnerability closed. A failure here means a
previously-fixed hole has reopened.
"""
import os
import re
import sys

import pytest

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.core.bot_config import (  # noqa: E402
    CHANNEL_CONFIG_KEYS,
    REDACTED,
    contains_redacted_sentinel,
    kg_cache_key,
    merge_config,
    redact_config,
    validate_bot_id,
)


STORED_CONFIG = {
    "model": "google/gemini-3.1-flash-lite",
    "system_prompt": "Custom prompt the tenant wrote",
    "top_k": 8,
    "telegram": {
        "bot_token": "123456:REAL-TELEGRAM-TOKEN",
        "webhook_secret": "real-webhook-secret",
        "is_active": True,
        "bot_username": "acme_bot",
        "webhook_url": "https://example.test/hook",
    },
    "zalo_bot": {"bot_token": "zalo-real-token", "webhook_secret": "zalo-secret"},
}


# ── Channel credentials must not leave the server ────────────────────────────

def test_redact_config_masks_channel_credentials():
    out = redact_config(STORED_CONFIG)
    assert out["telegram"]["bot_token"] == REDACTED
    assert out["telegram"]["webhook_secret"] == REDACTED
    assert out["zalo_bot"]["bot_token"] == REDACTED
    assert out["zalo_bot"]["webhook_secret"] == REDACTED


def test_redact_config_keeps_non_secret_display_fields():
    """The Channels tab renders these; redaction must not blank them."""
    out = redact_config(STORED_CONFIG)
    assert out["telegram"]["is_active"] is True
    assert out["telegram"]["bot_username"] == "acme_bot"
    assert out["telegram"]["webhook_url"] == "https://example.test/hook"
    assert out["system_prompt"] == "Custom prompt the tenant wrote"


def test_redaction_sentinel_is_truthy():
    """BotConfigPage gates the connected panel on `config.telegram?.bot_token`.
    A falsy placeholder would show connected bots as disconnected."""
    assert bool(REDACTED) is True


def test_redact_config_does_not_mutate_input():
    """The caller passes the live ORM attribute; mutating it would flush the
    sentinel to the database."""
    original = {"telegram": {"bot_token": "keep-me"}}
    redact_config(original)
    assert original["telegram"]["bot_token"] == "keep-me"


# ── The round-trip that would have destroyed every channel token ─────────────

def test_echoing_a_redacted_read_does_not_wipe_credentials():
    """The frontend reads the whole config and PUTs it back — including an
    automatic background save after a knowledge-graph build. If merge_config
    accepted the echoed sentinel, every tenant's channel token would be
    overwritten with '__REDACTED__' and the channel would silently die."""
    echoed = dict(redact_config(STORED_CONFIG))
    echoed["enable_knowledge_graph"] = True

    merged = merge_config(STORED_CONFIG, echoed)

    assert merged["telegram"]["bot_token"] == "123456:REAL-TELEGRAM-TOKEN"
    assert merged["telegram"]["webhook_secret"] == "real-webhook-secret"
    assert merged["zalo_bot"]["bot_token"] == "zalo-real-token"
    # and the real change still lands
    assert merged["enable_knowledge_graph"] is True


def test_merge_config_preserves_keys_the_client_did_not_send():
    merged = merge_config(STORED_CONFIG, {"top_k": 15})
    assert merged["top_k"] == 15
    assert merged["system_prompt"] == "Custom prompt the tenant wrote"
    assert merged["model"] == "google/gemini-3.1-flash-lite"


@pytest.mark.parametrize("channel", sorted(CHANNEL_CONFIG_KEYS))
def test_client_cannot_write_any_channel_subobject(channel):
    """Channel sub-objects are owned by the /channels/*/connect flows. A tenant
    member must not be able to set webhook_secret or swap bot_token."""
    merged = merge_config(
        STORED_CONFIG,
        {channel: {"bot_token": "attacker", "webhook_secret": "attacker"}},
    )
    assert merged.get(channel) == STORED_CONFIG.get(channel)


def test_contains_redacted_sentinel_detects_nested_values():
    assert contains_redacted_sentinel({"a": {"b": [REDACTED]}}) is True
    assert contains_redacted_sentinel({"a": {"b": ["fine"]}}) is False
    assert contains_redacted_sentinel(None) is False


def test_sentinel_guard_ignores_channel_keys():
    """update_bot rejects sentinels only outside the channel sub-objects.

    The frontend legitimately echoes redacted channel config back on every
    save, so raising on those would break the normal flow — including the
    automatic save after a knowledge-graph build. merge_config already drops
    them, so they are harmless; a sentinel anywhere else is a real bug.
    """
    echoed = redact_config(STORED_CONFIG)
    non_channel = {k: v for k, v in echoed.items() if k not in CHANNEL_CONFIG_KEYS}
    assert contains_redacted_sentinel(non_channel) is False

    leaked = dict(non_channel, system_prompt=REDACTED)
    assert contains_redacted_sentinel(leaked) is True


# ── Path traversal via bot_id (LightRAG working_dir) ─────────────────────────

@pytest.mark.parametrize(
    "bot_id",
    [
        "x/../../../../PWNED",
        "../../../etc",
        "/etc/passwd",
        "a/b",
        "..",
        ".",
        "",
        "x\\y",
    ],
)
def test_lightrag_bot_id_rejects_path_traversal(bot_id):
    with pytest.raises(ValueError):
        validate_bot_id(bot_id)


@pytest.mark.parametrize(
    "bot_id",
    ["e6f1c2a4-1234-4abc-9def-0123456789ab", "default_bot", "abc123"],
)
def test_lightrag_bot_id_accepts_legitimate_ids(bot_id):
    """Valid ids must still map to their existing on-disk directory — the
    guard validates and rejects, it must never rewrite bot_id."""
    assert validate_bot_id(bot_id) == bot_id


# ── LightRAG knowledge-graph cache must be per-bot ───────────────────────────

def test_kg_cache_key_is_scoped_per_bot():
    """_kg_query_cache is a module-level global shared by every service
    instance. Without bot_id in the key, one tenant's graph context was served
    to another tenant asking the same question."""
    a = kg_cache_key("bot-a", "chính sách hoàn tiền", "local")
    b = kg_cache_key("bot-b", "chính sách hoàn tiền", "local")
    assert a != b
    # same bot + same question still hits the cache
    assert a == kg_cache_key("bot-a", "  Chính sách hoàn tiền  ", "local")


# ── Chat history must stay scoped to its owner ───────────────────────────────

def test_chat_history_applies_user_filter_alongside_session():
    """get_chat_history used `elif user_id`, so passing a session_id dropped
    the ownership constraint entirely."""
    service_src = os.path.join(
        BACKEND_ROOT, "app", "services", "openrouter_rag_service.py"
    )
    with open(service_src, encoding="utf-8") as fh:
        source = fh.read()

    start = source.index("async def get_chat_history")
    body = source[start : start + 1200]
    assert 'query["user_id"] = user_id' in body
    assert "elif user_id:" not in body


# ── Webhook secret verification must fail closed ─────────────────────────────

def test_zalo_hub_webhook_fails_closed_without_secret():
    """`if expected_secret:` skipped verification when the secret was unset,
    leaving the webhook fully anonymous."""
    hub_src = os.path.join(
        BACKEND_ROOT, "app", "api", "v1", "endpoints", "channels", "zalo_hub.py"
    )
    with open(hub_src, encoding="utf-8") as fh:
        source = fh.read()

    assert "if not expected_secret or not hmac.compare_digest(" in source
    assert not re.search(r"^\s+if expected_secret:\s*$", source, re.MULTILINE)


# ── Authorization ────────────────────────────────────────────────────────────

def _read(*parts: str) -> str:
    with open(os.path.join(BACKEND_ROOT, *parts), encoding="utf-8") as fh:
        return fh.read()


def test_is_active_is_enforced_in_the_base_dependency():
    """The check lived only in get_current_active_user, and ~40 endpoints used
    the unchecked get_current_user — so deactivating a user revoked nothing."""
    source = _read("app", "api", "deps.py")

    for fn in ("def get_current_user(", "async def get_current_user_async("):
        start = source.index(fn)
        body = source[start : start + 1400]
        assert "if not user.is_active:" in body, f"{fn} does not check is_active"


def test_role_dependency_exists():
    assert "def require_role(" in _read("app", "api", "deps.py")


def test_generate_prompt_has_no_dead_hasattr_tenant_guard():
    """`X if hasattr(...) else True` yielded the literal True, and SQLAlchemy
    folded the tenant constraint out of the emitted SQL entirely."""
    source = _read("app", "api", "v1", "endpoints", "bots.py")
    assert "hasattr(DocumentModel, 'tenant_id')" not in source


def test_feedback_endpoint_is_bot_scoped():
    source = _read("app", "api", "v1", "endpoints", "bots.py")
    start = source.index("async def submit_message_feedback")
    body = source[start : start + 1600]
    assert "deps.get_current_bot_async" in body
    # the Mongo match key, not just the $set payload, must be scoped
    assert '"user_id": str(current_user.id),' in body.split("$set")[0]


def test_folder_update_validates_new_parent():
    """parent_id was applied unvalidated, so a folder could be re-parented
    under another tenant's folder — which then cascades on delete."""
    source = _read("app", "api", "v1", "endpoints", "folders.py")
    start = source.index("def update_folder")
    body = source[start : start + 2500]
    assert "FolderModel.bot_id == folder.bot_id" in body
    assert "Circular folder hierarchy" in body


# ── The cross-tenant router must stay gone ───────────────────────────────────

def test_openrouter_router_is_not_registered():
    """/api/v1/openrouter/* took bot_id from the client with no tenant check."""
    api_src = os.path.join(BACKEND_ROOT, "app", "api", "api.py")
    with open(api_src, encoding="utf-8") as fh:
        source = fh.read()

    assert "openrouter" not in source
    assert not os.path.exists(
        os.path.join(BACKEND_ROOT, "app", "api", "v1", "endpoints", "openrouter.py")
    )
