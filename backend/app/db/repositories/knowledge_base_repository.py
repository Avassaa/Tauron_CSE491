"""Persistence helpers for ``knowledge_base`` rows."""

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.knowledge_base import KnowledgeBase


class KnowledgeBaseRepository:
    """CRUD for RAG chunks including optional embeddings."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def count(
        self,
        asset_id: Optional[uuid.UUID] = None,
        source_type: Optional[str] = None,
    ) -> int:
        """Count rows with optional filters."""
        statement = select(func.count()).select_from(KnowledgeBase)
        if asset_id is not None:
            statement = statement.where(KnowledgeBase.asset_id == asset_id)
        if source_type is not None:
            statement = statement.where(KnowledgeBase.source_type == source_type)
        result = await self._session.execute(statement)
        return int(result.scalar_one() or 0)

    async def list_page(
        self,
        offset: int,
        limit: int,
        asset_id: Optional[uuid.UUID] = None,
        source_type: Optional[str] = None,
    ) -> list[KnowledgeBase]:
        """Return a page ordered by ``published_at`` descending."""
        statement = (
            select(KnowledgeBase)
            .order_by(KnowledgeBase.published_at.desc())
            .offset(offset)
            .limit(limit)
        )
        if asset_id is not None:
            statement = statement.where(KnowledgeBase.asset_id == asset_id)
        if source_type is not None:
            statement = statement.where(KnowledgeBase.source_type == source_type)
        result = await self._session.execute(statement)
        return list(result.scalars().all())

    async def get_by_id(self, row_id: uuid.UUID) -> Optional[KnowledgeBase]:
        """Load one row by id."""
        result = await self._session.execute(
            select(KnowledgeBase).where(KnowledgeBase.id == row_id),
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        content: str,
        published_at: datetime,
        asset_id: Optional[uuid.UUID] = None,
        source_type: Optional[str] = None,
        title: Optional[str] = None,
        url: Optional[str] = None,
        embedding: Optional[Any] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> KnowledgeBase:
        """Insert a knowledge row."""
        row = KnowledgeBase(
            asset_id=asset_id,
            source_type=source_type,
            title=title,
            content=content,
            url=url,
            embedding=embedding,
            published_at=published_at,
            metadata_=metadata,
        )
        self._session.add(row)
        try:
            await self._session.commit()
        except IntegrityError:
            await self._session.rollback()
            raise
        await self._session.refresh(row)
        return row

    async def update(self, row_id: uuid.UUID, fields: dict[str, Any]) -> Optional[KnowledgeBase]:
        """Apply partial updates (``metadata`` maps to ``metadata_``)."""
        row = await self.get_by_id(row_id)
        if row is None:
            return None
        allowed = {
            "asset_id",
            "source_type",
            "title",
            "content",
            "url",
            "embedding",
            "published_at",
            "metadata",
        }
        for key, value in fields.items():
            if key not in allowed:
                continue
            if key == "metadata":
                row.metadata_ = value
            else:
                setattr(row, key, value)
        try:
            await self._session.commit()
        except IntegrityError:
            await self._session.rollback()
            raise
        await self._session.refresh(row)
        return row

    async def delete(self, row_id: uuid.UUID) -> bool:
        """Delete one row."""
        result = await self._session.execute(
            delete(KnowledgeBase).where(KnowledgeBase.id == row_id),
        )
        await self._session.commit()
        return result.rowcount > 0
