"""Persistence helpers for ``predictions`` hypertable rows."""

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import and_, delete, func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.predictions import Prediction


class PredictionRepository:
    """Range queries and admin writes for model predictions."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_range(
        self,
        asset_id: uuid.UUID,
        time_from: datetime,
        time_to: datetime,
        model_id: Optional[uuid.UUID] = None,
        offset: int = 0,
        limit: int = 100,
    ) -> list[Prediction]:
        """Return predictions in a time window for one asset."""
        conditions = [
            Prediction.asset_id == asset_id,
            Prediction.time >= time_from,
            Prediction.time <= time_to,
        ]
        if model_id is not None:
            conditions.append(Prediction.model_id == model_id)
        statement = (
            select(Prediction)
            .where(and_(*conditions))
            .order_by(Prediction.time.asc())
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
        model_id: Optional[uuid.UUID] = None,
    ) -> int:
        """Count rows in the time window."""
        conditions = [
            Prediction.asset_id == asset_id,
            Prediction.time >= time_from,
            Prediction.time <= time_to,
        ]
        if model_id is not None:
            conditions.append(Prediction.model_id == model_id)
        statement = select(func.count()).select_from(Prediction).where(and_(*conditions))
        result = await self._session.execute(statement)
        return int(result.scalar_one() or 0)

    async def insert_batch(self, rows: list[dict[str, Any]]) -> None:
        """Insert many rows using a single executemany statement."""
        if not rows:
            return
        await self._session.execute(insert(Prediction), rows)
        await self._session.commit()

    async def update_one(
        self,
        time: datetime,
        asset_id: uuid.UUID,
        model_id: uuid.UUID,
        fields: dict[str, Any],
    ) -> Optional[Prediction]:
        """Patch one row by composite key."""
        result = await self._session.execute(
            select(Prediction).where(
                Prediction.time == time,
                Prediction.asset_id == asset_id,
                Prediction.model_id == model_id,
            ),
        )
        row = result.scalar_one_or_none()
        if row is None:
            return None
        for key in ("predicted_value", "confidence_interval_high", "confidence_interval_low"):
            if key in fields:
                setattr(row, key, fields[key])
        await self._session.commit()
        await self._session.refresh(row)
        return row

    async def delete_one(
        self,
        time: datetime,
        asset_id: uuid.UUID,
        model_id: uuid.UUID,
    ) -> bool:
        """Delete one row by composite key."""
        result = await self._session.execute(
            delete(Prediction).where(
                Prediction.time == time,
                Prediction.asset_id == asset_id,
                Prediction.model_id == model_id,
            ),
        )
        await self._session.commit()
        return result.rowcount > 0
