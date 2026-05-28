from __future__ import annotations
from datetime import datetime
from typing import Optional
import uuid
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base_class import Base


class Bot(Base):
    __tablename__ = "bots"
    __table_args__ = (
        Index("ix_bots_tenant_id_created_at", "tenant_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))
    config: Mapped[Optional[dict]] = mapped_column(JSONB, default={})
    api_key: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True)
    is_active: Mapped[Optional[bool]] = mapped_column(Boolean, default=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    tenant = relationship("Tenant", back_populates="bots", lazy="selectin")
    channel_accounts = relationship("ChannelAccount", back_populates="bot", cascade="all, delete-orphan", lazy="selectin")
    documents = relationship("Document", back_populates="bot", cascade="all, delete-orphan", lazy="selectin")
    folders = relationship("Folder", back_populates="bot", cascade="all, delete-orphan", lazy="selectin")
