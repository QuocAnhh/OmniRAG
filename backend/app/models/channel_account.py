from __future__ import annotations
from datetime import datetime
from typing import Optional
import uuid
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base_class import Base


class ChannelAccount(Base):
    __tablename__ = "channel_accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    bot_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bots.id", ondelete="CASCADE"), index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    channel_type: Mapped[str] = mapped_column(String(32), index=True)

    display_name: Mapped[Optional[str]] = mapped_column(String(255))
    channel_uid: Mapped[Optional[str]] = mapped_column(String(64))
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))

    status: Mapped[str] = mapped_column(String(32), default="disconnected")
    session_data: Mapped[Optional[dict]] = mapped_column(JSONB)

    reply_policy: Mapped[str] = mapped_column(String(32), default="mention_only")
    thread_whitelist: Mapped[Optional[list]] = mapped_column(JSONB, default=list)

    connected_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_event_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[Optional[str]] = mapped_column(String(500))
    error_count: Mapped[int] = mapped_column(Integer, default=0)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    bot = relationship("Bot", back_populates="channel_accounts", lazy="selectin")
    tenant = relationship("Tenant", back_populates="channel_accounts", lazy="selectin")
    access_entries = relationship("ChannelAccountAccess", back_populates="account", cascade="all, delete-orphan", lazy="selectin")


class ChannelAccountAccess(Base):
    __tablename__ = "channel_account_access"
    __table_args__ = (
        UniqueConstraint("account_id", "user_id", name="uq_channel_account_access_account_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("channel_accounts.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    permission: Mapped[str] = mapped_column(String(16), default="read")

    account = relationship("ChannelAccount", back_populates="access_entries", lazy="selectin")
    user = relationship("User", back_populates="channel_account_accesses", lazy="selectin")
