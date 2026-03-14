"""add_performance_indexes

Revision ID: 69b59b9d
Revises: 2432df91d318
Create Date: 2026-03-15 00:00:00.000000

Adds composite and single-column indexes to address N+1 query patterns and
improve sorting/filtering performance on high-traffic tables.
"""
from typing import Sequence, Union
from alembic import op

revision: str = "69b59b9d"
down_revision: Union[str, None] = "2432df91d318"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── documents ────────────────────────────────────────────────────────────
    # Composite: speeds up polling queries (bot_id + status filter) and
    # listing documents sorted by creation time for a given bot.
    op.create_index(
        "ix_documents_bot_id_status",
        "documents",
        ["bot_id", "status"],
        unique=False,
    )
    op.create_index(
        "ix_documents_bot_id_created_at",
        "documents",
        ["bot_id", "created_at"],
        unique=False,
    )
    # Single-column: allows standalone filtering/sorting by status or time.
    op.create_index(
        "ix_documents_status",
        "documents",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_documents_created_at",
        "documents",
        ["created_at"],
        unique=False,
    )

    # ── bots ─────────────────────────────────────────────────────────────────
    # Composite: speeds up "list bots for tenant sorted by newest first".
    op.create_index(
        "ix_bots_tenant_id_created_at",
        "bots",
        ["tenant_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_bots_tenant_id_created_at", table_name="bots")
    op.drop_index("ix_documents_created_at", table_name="documents")
    op.drop_index("ix_documents_status", table_name="documents")
    op.drop_index("ix_documents_bot_id_created_at", table_name="documents")
    op.drop_index("ix_documents_bot_id_status", table_name="documents")
