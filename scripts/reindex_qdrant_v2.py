#!/usr/bin/env python3
"""Reindex completed documents into the configured Qdrant RAG collection.

Run from repo root:
  python scripts/reindex_qdrant_v2.py --bot-id <uuid> --sync
  python scripts/reindex_qdrant_v2.py --bot-id <uuid>
"""

from __future__ import annotations

import argparse
import os
import sys


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND = os.path.join(ROOT, "backend")
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)


def main() -> int:
    parser = argparse.ArgumentParser(description="Reindex OmniRAG documents into Qdrant v2 collection")
    parser.add_argument("--bot-id", default=None, help="Optional bot UUID to reindex")
    parser.add_argument("--limit", type=int, default=None, help="Optional max document count")
    parser.add_argument("--sync", action="store_true", help="Run in-process instead of queuing Celery")
    args = parser.parse_args()

    from app.tasks.document_tasks import reindex_qdrant_v2, reindex_qdrant_v2_task

    if args.sync:
        result = reindex_qdrant_v2(bot_id=args.bot_id, limit=args.limit)
        print(result)
    else:
        task = reindex_qdrant_v2_task.delay(bot_id=args.bot_id, limit=args.limit)
        print({"task_id": task.id, "status": "queued"})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
