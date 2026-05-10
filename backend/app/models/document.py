from __future__ import annotations
from datetime import datetime
from typing import Optional
import uuid
from sqlalchemy import String, DateTime, ForeignKey, Text, BigInteger, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base_class import Base


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        Index("ix_documents_bot_id_created_at", "bot_id", "created_at"),
        Index("ix_documents_bot_id_filename", "bot_id", "filename"),
        Index("ix_documents_bot_id_status", "bot_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    bot_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bots.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    file_path: Mapped[Optional[str]] = mapped_column(String(500))
    file_type: Mapped[str] = mapped_column(String(50))
    file_size: Mapped[Optional[int]] = mapped_column(BigInteger)
    content_hash: Mapped[Optional[str]] = mapped_column(String(64))
    status: Mapped[Optional[str]] = mapped_column(String(20), default="pending", index=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    folder_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("folders.id", ondelete="SET NULL"), index=True)
    tags: Mapped[Optional[list]] = mapped_column(JSONB, default=[])
    doc_metadata: Mapped[Optional[dict]] = mapped_column(JSONB, default={})
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    bot = relationship("Bot", back_populates="documents", lazy="selectin")
    folder = relationship("Folder", back_populates="documents", lazy="selectin")
