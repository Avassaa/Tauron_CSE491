"""ORM model for raw news rows (scraper JSON shape)."""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Index, String, Text, UniqueConstraint, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class NewsData(Base):
    """
    One row per scraped article.

    Maps scraper / aggregated JSON fields: source, scrapedAt, publishedAt, title, content.
    ``fingerprint`` is a SHA-256 hex digest of canonical ``source``, normalized
    ``publishedAt`` (same instant, one string form), and whitespace-normalized
    ``title``; ``content`` is not hashed. Rows use a UUID ``id`` as the primary key for stable
    references; sites rarely expose a durable global article id, so dedupe is by
    fingerprint via ``ON CONFLICT (fingerprint) DO NOTHING`` on
    ``uq_news_data_fingerprint``.
    """

    __tablename__ = "news_data"
    __table_args__ = (
        Index("ix_news_data_source_scraped_at", "source", "scraped_at"),
        UniqueConstraint("fingerprint", name="uq_news_data_fingerprint"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    source: Mapped[str] = mapped_column(String(64), nullable=False)
    scraped_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    published_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    title: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="",
        server_default=text("''"),
    )
