"""Persistence helpers for OHLCV, technical indicators, and on-chain metrics."""

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import and_, delete, func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.market_data import MarketData
from app.db.models.on_chain_metrics import OnChainMetric
from app.db.models.technical_indicators import TechnicalIndicator


class MarketDataRepository:
    """Range queries and admin writes for ``market_data``."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_range(
        self,
        asset_id: uuid.UUID,
        time_from: datetime,
        time_to: datetime,
        resolution: Optional[str] = None,
        offset: int = 0,
        limit: int = 500,
    ) -> list[MarketData]:
        """Return OHLCV rows in a time window."""
        conditions = [
            MarketData.asset_id == asset_id,
            MarketData.time >= time_from,
            MarketData.time <= time_to,
        ]
        if resolution is not None:
            conditions.append(MarketData.resolution == resolution)
        statement = (
            select(MarketData)
            .where(and_(*conditions))
            .order_by(MarketData.time.asc())
            .offset(offset)
            .limit(limit)
        )
        result = await self._session.execute(statement)
        return list(result.scalars().all())

    async def count_range(
        self,
        asset_id: uuid.UUID,
        time_from: datetime,
        time_to: datetime,
        resolution: Optional[str] = None,
    ) -> int:
        """Count rows in the window."""
        conditions = [
            MarketData.asset_id == asset_id,
            MarketData.time >= time_from,
            MarketData.time <= time_to,
        ]
        if resolution is not None:
            conditions.append(MarketData.resolution == resolution)
        statement = select(func.count()).select_from(MarketData).where(and_(*conditions))
        result = await self._session.execute(statement)
        return int(result.scalar_one() or 0)

    async def insert_batch(self, rows: list[dict[str, Any]]) -> None:
        """Insert many OHLCV rows."""
        if not rows:
            return
        await self._session.execute(insert(MarketData), rows)
        await self._session.commit()

    async def update_one(
        self,
        time: datetime,
        asset_id: uuid.UUID,
        fields: dict[str, Any],
    ) -> Optional[MarketData]:
        """Patch one candle."""
        result = await self._session.execute(
            select(MarketData).where(
                MarketData.time == time,
                MarketData.asset_id == asset_id,
            ),
        )
        row = result.scalar_one_or_none()
        if row is None:
            return None
        for key in ("open", "high", "low", "close", "volume", "resolution"):
            if key in fields:
                setattr(row, key, fields[key])
        await self._session.commit()
        await self._session.refresh(row)
        return row

    async def delete_one(self, time: datetime, asset_id: uuid.UUID) -> bool:
        """Delete one candle."""
        result = await self._session.execute(
            delete(MarketData).where(
                MarketData.time == time,
                MarketData.asset_id == asset_id,
            ),
        )
        await self._session.commit()
        return result.rowcount > 0


class TechnicalIndicatorRepository:
    """Range queries and admin writes for ``technical_indicators``."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_range(
        self,
        asset_id: uuid.UUID,
        time_from: datetime,
        time_to: datetime,
        indicator_name: Optional[str] = None,
        offset: int = 0,
        limit: int = 500,
    ) -> list[TechnicalIndicator]:
        """Return indicator rows in a time window."""
        conditions = [
            TechnicalIndicator.asset_id == asset_id,
            TechnicalIndicator.time >= time_from,
            TechnicalIndicator.time <= time_to,
        ]
        if indicator_name is not None:
            conditions.append(TechnicalIndicator.indicator_name == indicator_name)
        statement = (
            select(TechnicalIndicator)
            .where(and_(*conditions))
            .order_by(TechnicalIndicator.time.asc())
            .offset(offset)
            .limit(limit)
        )
        result = await self._session.execute(statement)
        return list(result.scalars().all())

    async def count_range(
        self,
        asset_id: uuid.UUID,
        time_from: datetime,
        time_to: datetime,
        indicator_name: Optional[str] = None,
    ) -> int:
        """Count rows in the window."""
        conditions = [
            TechnicalIndicator.asset_id == asset_id,
            TechnicalIndicator.time >= time_from,
            TechnicalIndicator.time <= time_to,
        ]
        if indicator_name is not None:
            conditions.append(TechnicalIndicator.indicator_name == indicator_name)
        statement = select(func.count()).select_from(TechnicalIndicator).where(and_(*conditions))
        result = await self._session.execute(statement)
        return int(result.scalar_one() or 0)

    async def insert_batch(self, rows: list[dict[str, Any]]) -> None:
        """Insert many indicator rows."""
        if not rows:
            return
        await self._session.execute(insert(TechnicalIndicator), rows)
        await self._session.commit()

    async def update_one(
        self,
        time: datetime,
        asset_id: uuid.UUID,
        indicator_name: str,
        fields: dict[str, Any],
    ) -> Optional[TechnicalIndicator]:
        """Patch one indicator value."""
        result = await self._session.execute(
            select(TechnicalIndicator).where(
                TechnicalIndicator.time == time,
                TechnicalIndicator.asset_id == asset_id,
                TechnicalIndicator.indicator_name == indicator_name,
            ),
        )
        row = result.scalar_one_or_none()
        if row is None:
            return None
        if "value" in fields:
            row.value = fields["value"]
        await self._session.commit()
        await self._session.refresh(row)
        return row

    async def delete_one(
        self,
        time: datetime,
        asset_id: uuid.UUID,
        indicator_name: str,
    ) -> bool:
        """Delete one indicator row."""
        result = await self._session.execute(
            delete(TechnicalIndicator).where(
                TechnicalIndicator.time == time,
                TechnicalIndicator.asset_id == asset_id,
                TechnicalIndicator.indicator_name == indicator_name,
            ),
        )
        await self._session.commit()
        return result.rowcount > 0


class OnChainMetricRepository:
    """Range queries and admin writes for ``on_chain_metrics``."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_range(
        self,
        asset_id: uuid.UUID,
        time_from: datetime,
        time_to: datetime,
        metric_name: Optional[str] = None,
        offset: int = 0,
        limit: int = 500,
    ) -> list[OnChainMetric]:
        """Return metric rows in a time window."""
        conditions = [
            OnChainMetric.asset_id == asset_id,
            OnChainMetric.time >= time_from,
            OnChainMetric.time <= time_to,
        ]
        if metric_name is not None:
            conditions.append(OnChainMetric.metric_name == metric_name)
        statement = (
            select(OnChainMetric)
            .where(and_(*conditions))
            .order_by(OnChainMetric.time.asc())
            .offset(offset)
            .limit(limit)
        )
        result = await self._session.execute(statement)
        return list(result.scalars().all())

    async def count_range(
        self,
        asset_id: uuid.UUID,
        time_from: datetime,
        time_to: datetime,
        metric_name: Optional[str] = None,
    ) -> int:
        """Count rows in the window."""
        conditions = [
            OnChainMetric.asset_id == asset_id,
            OnChainMetric.time >= time_from,
            OnChainMetric.time <= time_to,
        ]
        if metric_name is not None:
            conditions.append(OnChainMetric.metric_name == metric_name)
        statement = select(func.count()).select_from(OnChainMetric).where(and_(*conditions))
        result = await self._session.execute(statement)
        return int(result.scalar_one() or 0)

    async def insert_batch(self, rows: list[dict[str, Any]]) -> None:
        """Insert many on-chain metric rows."""
        if not rows:
            return
        await self._session.execute(insert(OnChainMetric), rows)
        await self._session.commit()

    async def update_one(
        self,
        time: datetime,
        asset_id: uuid.UUID,
        metric_name: str,
        fields: dict[str, Any],
    ) -> Optional[OnChainMetric]:
        """Patch one metric value."""
        result = await self._session.execute(
            select(OnChainMetric).where(
                OnChainMetric.time == time,
                OnChainMetric.asset_id == asset_id,
                OnChainMetric.metric_name == metric_name,
            ),
        )
        row = result.scalar_one_or_none()
        if row is None:
            return None
        if "value" in fields:
            row.value = fields["value"]
        await self._session.commit()
        await self._session.refresh(row)
        return row

    async def delete_one(
        self,
        time: datetime,
        asset_id: uuid.UUID,
        metric_name: str,
    ) -> bool:
        """Delete one metric row."""
        result = await self._session.execute(
            delete(OnChainMetric).where(
                OnChainMetric.time == time,
                OnChainMetric.asset_id == asset_id,
                OnChainMetric.metric_name == metric_name,
            ),
        )
        await self._session.commit()
        return result.rowcount > 0
