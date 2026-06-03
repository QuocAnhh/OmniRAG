"""add_channel_accounts

Revision ID: a1b2c3d4
Revises: ce3a8f7b
Create Date: 2026-05-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "a1b2c3d4"
down_revision: Union[str, None] = "ce3a8f7b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotent: skip if tables already exist (e.g. created by a prior partial run)
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if "channel_accounts" not in inspector.get_table_names():
        op.create_table(
            "channel_accounts",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("bot_id", sa.UUID(), nullable=False),
            sa.Column("tenant_id", sa.UUID(), nullable=False),
            sa.Column("channel_type", sa.String(length=32), nullable=False),
            sa.Column("display_name", sa.String(length=255), nullable=True),
            sa.Column("channel_uid", sa.String(length=64), nullable=True),
            sa.Column("avatar_url", sa.String(length=500), nullable=True),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="disconnected"),
            sa.Column("session_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("reply_policy", sa.String(length=32), nullable=False, server_default="mention_only"),
            sa.Column("thread_whitelist", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("connected_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_event_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_error", sa.String(length=500), nullable=True),
            sa.Column("error_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["bot_id"], ["bots.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_channel_accounts_id"), "channel_accounts", ["id"], unique=False)
        op.create_index(op.f("ix_channel_accounts_bot_id"), "channel_accounts", ["bot_id"], unique=False)
        op.create_index(op.f("ix_channel_accounts_tenant_id"), "channel_accounts", ["tenant_id"], unique=False)
        op.create_index(op.f("ix_channel_accounts_channel_type"), "channel_accounts", ["channel_type"], unique=False)

        # Backfill existing zalo_personal config into channel_accounts (only when creating table fresh)
        op.execute("""
            INSERT INTO channel_accounts (id, bot_id, tenant_id, channel_type, display_name, channel_uid, avatar_url, status,
                                           reply_policy, thread_whitelist, connected_at, last_event_at, last_error, error_count, is_active)
            SELECT
                gen_random_uuid(),
                b.id AS bot_id,
                b.tenant_id,
                'zalo_personal' AS channel_type,
                (b.config -> 'zalo_personal' ->> 'display_name') AS display_name,
                (b.config -> 'zalo_personal' ->> 'uid') AS channel_uid,
                NULL AS avatar_url,
                COALESCE(b.config -> 'zalo_personal' ->> 'status', 'disconnected') AS status,
                COALESCE(b.config -> 'zalo_personal' ->> 'reply_policy', 'mention_only') AS reply_policy,
                COALESCE(b.config -> 'zalo_personal' -> 'thread_whitelist', '[]'::jsonb) AS thread_whitelist,
                CASE WHEN b.config -> 'zalo_personal' ->> 'connected_at' IS NOT NULL
                     THEN (b.config -> 'zalo_personal' ->> 'connected_at')::timestamptz
                     ELSE NULL
                END AS connected_at,
                CASE WHEN b.config -> 'zalo_personal' ->> 'last_event_at' IS NOT NULL
                     THEN (b.config -> 'zalo_personal' ->> 'last_event_at')::timestamptz
                     ELSE NULL
                END AS last_event_at,
                (b.config -> 'zalo_personal' ->> 'last_error') AS last_error,
                0 AS error_count,
                COALESCE((b.config -> 'zalo_personal' ->> 'is_active')::boolean, true) AS is_active
            FROM bots b
            WHERE b.config -> 'zalo_personal' IS NOT NULL
              AND b.config -> 'zalo_personal' ->> 'status' IS NOT NULL
        """)

    if "channel_account_access" not in inspector.get_table_names():
        op.create_table(
            "channel_account_access",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("account_id", sa.UUID(), nullable=False),
            sa.Column("user_id", sa.UUID(), nullable=False),
            sa.Column("permission", sa.String(length=16), nullable=False, server_default="read"),
            sa.ForeignKeyConstraint(["account_id"], ["channel_accounts.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("account_id", "user_id", name="uq_channel_account_access_account_user"),
        )
        op.create_index(op.f("ix_channel_account_access_id"), "channel_account_access", ["id"], unique=False)
        op.create_index(op.f("ix_channel_account_access_account_id"), "channel_account_access", ["account_id"], unique=False)
        op.create_index(op.f("ix_channel_account_access_user_id"), "channel_account_access", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_table("channel_account_access")
    op.drop_table("channel_accounts")
