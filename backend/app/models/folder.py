from __future__ import annotations
from datetime import datetime
from typing import Optional
import uuid
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base_class import Base


class Folder(Base):
    __tablename__ = "folders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name: Mapped[str] = mapped_column(String(255))
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("folders.id", ondelete="CASCADE"))
    bot_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bots.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    parent = relationship("Folder", remote_side=[id], back_populates="children", lazy="selectin")
    children = relationship("Folder", back_populates="parent", cascade="all, delete-orphan", lazy="selectin")
    documents = relationship("Document", back_populates="folder", lazy="selectin")
    bot = relationship("Bot", back_populates="folders", lazy="selectin")
