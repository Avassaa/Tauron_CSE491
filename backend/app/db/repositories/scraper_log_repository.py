"""Persistence helpers for ``scraper_logs`` rows."""

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.scraper_logs import ScraperLog


class ScraperLogRepository:
    """Append-only scraper logs with admin maintenance."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def count(
        self,
        source: Optional[str] = None,
        executed_from: Optional[datetime] = None,
        executed_to: Optional[datetime] = None,
    ) -> int:
        """Count rows with optional filters."""
        statement = select(func.count()).select_from(ScraperLog)
        if source is not None:
            statement = statement.where(ScraperLog.source == source)
        if executed_from is not None:
            statement = statement.where(ScraperLog.executed_at >= executed_from)
        if executed_to is not None:
            statement = statement.where(ScraperLog.executed_at <= executed_to)
        result = await self._session.execute(statement)
        return int(result.scalar_one() or 0)

    async def list_page(
        self,
        offset: int,
        limit: int,
        source: Optional[str] = None,
        executed_from: Optional[datetime] = None,
        executed_to: Optional[datetime] = None,
    ) -> list[ScraperLog]:
        """Return a page ordered by ``executed_at`` descending."""
        statement = (
            select(ScraperLog)
            .order_by(ScraperLog.executed_at.desc())
            .offset(offset)
            .limit(limit)
        )
        if source is not None:
            statement = statement.where(ScraperLog.source == source)
        if executed_from is not None:
            statement = statement.where(ScraperLog.executed_at >= executed_from)
        if executed_to is not None:
            statement = statement.where(ScraperLog.executed_at <= executed_to)
        result = await self._session.execute(statement)
        return list(result.scalars().all())

    async def get_by_id(self, log_id: int) -> Optional[ScraperLog]:
        """Load one log row."""
        result = await self._session.execute(select(ScraperLog).where(ScraperLog.id == log_id))
        return result.scalar_one_or_none()

    async def create(
        self,
        source: Optional[str] = None,
        status: Optional[str] = None,
        error_msg: Optional[str] = None,
        rows_affected: Optional[int] = None,
    ) -> ScraperLog:
        """Append a log entry."""
        row = ScraperLog(
            source=source,
            status=status,
            error_msg=error_msg,
            rows_affected=rows_affected,
        )
        self._session.add(row)
        await self._session.commit()
        await self._session.refresh(row)
        return row

    async def update(self, log_id: int, fields: dict[str, Any]) -> Optional[ScraperLog]:
        """Rare patch for correcting a log row."""
        row = await self.get_by_id(log_id)
        if row is None:
            return None
        for key in ("source", "status", "error_msg", "rows_affected"):
            if key in fields:
                setattr(row, key, fields[key])
        await self._session.commit()
        await self._session.refresh(row)
        return row

    async def delete(self, log_id: int) -> bool:
        """Delete one log row (retention)."""
        result = await self._session.execute(delete(ScraperLog).where(ScraperLog.id == log_id))
        await self._session.commit()
        return result.rowcount > 0
