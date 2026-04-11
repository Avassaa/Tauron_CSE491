"""Persistence helpers for ``curated_news`` rows."""

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.curated_news import CuratedNews


class CuratedNewsRepository:
    """CRUD for curated news summaries."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def count(
        self,
        asset_id: Optional[uuid.UUID] = None,
        created_from: Optional[datetime] = None,
        created_to: Optional[datetime] = None,
    ) -> int:
        """Count rows with optional filters."""
        statement = select(func.count()).select_from(CuratedNews)
        if asset_id is not None:
            statement = statement.where(CuratedNews.asset_id == asset_id)
        if created_from is not None:
            statement = statement.where(CuratedNews.created_at >= created_from)
        if created_to is not None:
            statement = statement.where(CuratedNews.created_at <= created_to)
        result = await self._session.execute(statement)
        return int(result.scalar_one() or 0)

    async def list_page(
        self,
        offset: int,
        limit: int,
        asset_id: Optional[uuid.UUID] = None,
        created_from: Optional[datetime] = None,
        created_to: Optional[datetime] = None,
    ) -> list[CuratedNews]:
        """Return a page ordered by ``created_at`` descending."""
        statement = (
            select(CuratedNews).order_by(CuratedNews.created_at.desc()).offset(offset).limit(limit)
        )
        if asset_id is not None:
            statement = statement.where(CuratedNews.asset_id == asset_id)
        if created_from is not None:
            statement = statement.where(CuratedNews.created_at >= created_from)
        if created_to is not None:
            statement = statement.where(CuratedNews.created_at <= created_to)
        result = await self._session.execute(statement)
        return list(result.scalars().all())

    async def get_by_id(self, news_id: uuid.UUID) -> Optional[CuratedNews]:
        """Load one row by id."""
        result = await self._session.execute(select(CuratedNews).where(CuratedNews.id == news_id))
        return result.scalar_one_or_none()

    async def create(
        self,
        summary: str,
        asset_id: Optional[uuid.UUID] = None,
        sentiment_score: Optional[float] = None,
        data_points_used: Optional[dict[str, Any]] = None,
    ) -> CuratedNews:
        """Insert a news summary."""
        row = CuratedNews(
            asset_id=asset_id,
            summary=summary,
            sentiment_score=sentiment_score,
            data_points_used=data_points_used,
        )
        self._session.add(row)
        try:
            await self._session.commit()
        except IntegrityError:
            await self._session.rollback()
            raise
        await self._session.refresh(row)
        return row

    async def update(self, news_id: uuid.UUID, fields: dict[str, Any]) -> Optional[CuratedNews]:
        """Apply partial updates."""
        row = await self.get_by_id(news_id)
        if row is None:
            return None
        allowed = {"asset_id", "summary", "sentiment_score", "data_points_used"}
        for key, value in fields.items():
            if key not in allowed:
                continue
            setattr(row, key, value)
        try:
            await self._session.commit()
        except IntegrityError:
            await self._session.rollback()
            raise
        await self._session.refresh(row)
        return row

    async def delete(self, news_id: uuid.UUID) -> bool:
        """Delete one row."""
        result = await self._session.execute(
            delete(CuratedNews).where(CuratedNews.id == news_id),
        )
        await self._session.commit()
        return result.rowcount > 0
