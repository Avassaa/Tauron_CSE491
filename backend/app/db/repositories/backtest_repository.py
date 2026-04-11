"""Persistence helpers for ``backtest_results`` rows."""

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.backtest_results import BacktestResult


class BacktestResultRepository:
    """CRUD for strategy backtest summaries."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def count_for_user(self, user_id: uuid.UUID) -> int:
        """Count backtests owned by a user."""
        statement = (
            select(func.count()).select_from(BacktestResult).where(BacktestResult.user_id == user_id)
        )
        result = await self._session.execute(statement)
        return int(result.scalar_one() or 0)

    async def count_all(self) -> int:
        """Count all backtest rows."""
        result = await self._session.execute(select(func.count()).select_from(BacktestResult))
        return int(result.scalar_one() or 0)

    async def list_page_for_user(
        self,
        user_id: uuid.UUID,
        offset: int,
        limit: int,
    ) -> list[BacktestResult]:
        """List backtests for one user."""
        statement = (
            select(BacktestResult)
            .where(BacktestResult.user_id == user_id)
            .order_by(BacktestResult.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self._session.execute(statement)
        return list(result.scalars().all())

    async def list_page_admin(self, offset: int, limit: int) -> list[BacktestResult]:
        """Admin list of all backtests."""
        statement = (
            select(BacktestResult)
            .order_by(BacktestResult.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self._session.execute(statement)
        return list(result.scalars().all())

    async def get_by_id(self, result_id: uuid.UUID) -> Optional[BacktestResult]:
        """Load one row."""
        result = await self._session.execute(
            select(BacktestResult).where(BacktestResult.id == result_id),
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        user_id: Optional[uuid.UUID],
        model_id: Optional[uuid.UUID] = None,
        strategy_name: Optional[str] = None,
        total_return: Optional[float] = None,
        sharpe_ratio: Optional[float] = None,
        max_drawdown: Optional[float] = None,
        trades_log: Optional[dict[str, Any]] = None,
    ) -> BacktestResult:
        """Insert a backtest summary."""
        row = BacktestResult(
            user_id=user_id,
            model_id=model_id,
            strategy_name=strategy_name,
            total_return=total_return,
            sharpe_ratio=sharpe_ratio,
            max_drawdown=max_drawdown,
            trades_log=trades_log,
        )
        self._session.add(row)
        try:
            await self._session.commit()
        except IntegrityError:
            await self._session.rollback()
            raise
        await self._session.refresh(row)
        return row

    async def update(self, result_id: uuid.UUID, fields: dict[str, Any]) -> Optional[BacktestResult]:
        """Apply partial updates."""
        row = await self.get_by_id(result_id)
        if row is None:
            return None
        allowed = {
            "user_id",
            "model_id",
            "strategy_name",
            "total_return",
            "sharpe_ratio",
            "max_drawdown",
            "trades_log",
        }
        for key, value in fields.items():
            if key in allowed:
                setattr(row, key, value)
        try:
            await self._session.commit()
        except IntegrityError:
            await self._session.rollback()
            raise
        await self._session.refresh(row)
        return row

    async def delete(self, result_id: uuid.UUID) -> bool:
        """Delete one row."""
        result = await self._session.execute(
            delete(BacktestResult).where(BacktestResult.id == result_id),
        )
        await self._session.commit()
        return result.rowcount > 0
