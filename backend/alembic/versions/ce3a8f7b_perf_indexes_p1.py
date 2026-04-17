"""add perf indexes for dedup and folder lookup

Revision ID: ce3a8f7b
Revises: 69b59b9d
Create Date: 2026-04-17 00:00:00.000000

Adds composite index (bot_id, filename) for document dedup check and
index on folder_id for folder-scoped document queries.
"""
from typing import Sequence, Union
from alembic import op

revision: str = "ce3a8f7b"
down_revision: Union[str, None] = "69b59b9d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_documents_bot_id_filename",
        "documents",
        ["bot_id", "filename"],
        unique=False,
    )
    op.create_index(
        "ix_documents_folder_id",
        "documents",
        ["folder_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_documents_folder_id", table_name="documents")
    op.drop_index("ix_documents_bot_id_filename", table_name="documents")
