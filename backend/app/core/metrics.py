"""Prometheus metrics for OmniRAG backend.

Exposes /metrics endpoint and provides reusable histograms/counters
for RAG pipeline, Qdrant, embeddings, LLM calls, and cache operations.
"""
from prometheus_client import Histogram, Counter, generate_latest, CONTENT_TYPE_LATEST
from fastapi import Response


# ── RAG Pipeline ──────────────────────────────────────────────────────────────
RAG_CHAT_DURATION = Histogram(
    "rag_chat_duration_seconds",
    "End-to-end RAG chat request duration",
    ["phase"],  # embed, rewrite, search, rerank, crag, generate, total
    buckets=(0.1, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 5.0, 7.5, 10.0, 15.0, 30.0),
)

# ── Qdrant ────────────────────────────────────────────────────────────────────
QDRANT_OP_DURATION = Histogram(
    "qdrant_op_duration_seconds",
    "Qdrant operation duration",
    ["op"],  # search, upsert, scroll, query_points
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0),
)

# ── Embeddings ────────────────────────────────────────────────────────────────
EMBED_DURATION = Histogram(
    "embed_duration_seconds",
    "Embedding call duration",
    ["model"],
    buckets=(0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0),
)

# ── LLM Calls ────────────────────────────────────────────────────────────────
LLM_CALL_DURATION = Histogram(
    "llm_call_duration_seconds",
    "LLM API call duration",
    ["model", "op"],  # op: chat, rewrite, crag, prefix, title
    buckets=(0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0),
)

# ── Cache ─────────────────────────────────────────────────────────────────────
CACHE_HITS = Counter(
    "cache_hit_total",
    "Cache hit count",
    ["prefix"],
)
CACHE_MISSES = Counter(
    "cache_miss_total",
    "Cache miss count",
    ["prefix"],
)


def metrics_response() -> Response:
    """Return Prometheus-format metrics."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
