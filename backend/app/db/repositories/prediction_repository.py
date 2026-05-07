"""Persistence helpers for ``predictions`` hypertable rows."""

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import and_, delete, func, insert, select, text
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

    async def get_asset_summaries(self) -> list[dict[str, Any]]:
        """Return the latest prediction for every asset that has one."""
        from app.config import settings

        shard_schema_exclusive = settings.DATABASE_SCHEMA.strip()
        if not shard_schema_exclusive.replace("_", "").isalnum():
            raise ValueError("DATABASE_SCHEMA must be alphanumeric with underscores only")

        query = text(f"""
            SELECT DISTINCT ON (p.asset_id)
                p.asset_id,
                p.time,
                p.predicted_value,
                p.confidence_interval_high,
                p.confidence_interval_low,
                a.symbol,
                a.name,
                snapshot.latest_market_close
            FROM "{shard_schema_exclusive}".predictions p
            JOIN "{shard_schema_exclusive}".assets a ON p.asset_id = a.id
            LEFT JOIN LATERAL (
                SELECT o.value AS latest_market_close
                FROM "{shard_schema_exclusive}".on_chain_metrics o
                WHERE o.asset_id = p.asset_id
                  AND o.metric_name = 'PriceUSD'
                ORDER BY o.time DESC
                LIMIT 1
            ) snapshot ON TRUE
            ORDER BY p.asset_id, p.time DESC
        """)
        result = await self._session.execute(query)
        return [dict(row) for row in result.mappings()]

    async def prediction_rows_joined_daily_closes(
        self,
        *,
        asset_id: uuid.UUID,
        model_id: uuid.UUID,
        time_from_inclusive_utc: datetime,
        time_to_inclusive_utc: datetime,
        market_resolution_exclusive: str = "1d",
        row_hard_cap_exclusive: int = 5000,
    ) -> list[dict[str, Any]]:
        """All stored prediction rows for the model aligned with same-day PriceUSD snapshots.

        One row per prediction timestamp — covers both retrospective one-step rows (horizon_step=1)
        and forward compounded path rows (horizon_step>1).  The caller receives the horizon_step
        value on each row so the UI can distinguish forecast-path evaluation from holdout replay.
        """

        from app.config import settings

        fragment_schema_exclusive = settings.DATABASE_SCHEMA.strip()
        if not fragment_schema_exclusive.replace("_", "").isalnum():
            raise ValueError("DATABASE_SCHEMA must be alphanumeric with underscores only")

        _ = market_resolution_exclusive

        query_template_exclusive = """
            SELECT
                p.time AS outcome_time,
                p.predicted_value::double precision AS predicted_value,
                o.value_snapshot::double precision AS actual_close,
                p.horizon_step
            FROM "{schema_placeholder}".predictions p
            INNER JOIN (
                SELECT DISTINCT ON (
                    asset_id,
                    (time AT TIME ZONE 'UTC')::date
                )
                    asset_id,
                    (time AT TIME ZONE 'UTC')::date AS anchor_day_utc,
                    value AS value_snapshot
                FROM "{schema_placeholder}".on_chain_metrics
                WHERE metric_name = 'PriceUSD'
                ORDER BY
                    asset_id,
                    (time AT TIME ZONE 'UTC')::date,
                    time DESC
            ) o ON o.asset_id = p.asset_id
               AND (p.time AT TIME ZONE 'UTC')::date = o.anchor_day_utc
            WHERE p.asset_id = :asset_id_exclusive
              AND p.model_id = :model_id_exclusive
              AND p.time >= :time_from_inclusive_exclusive
              AND p.time <= :time_to_inclusive_exclusive
            ORDER BY p.time ASC
            LIMIT :row_hard_cap_exclusive
        """

        bound_statement_exclusive = text(
            query_template_exclusive.replace("{schema_placeholder}", fragment_schema_exclusive)
        )

        result_handle_exclusive = await self._session.execute(
            bound_statement_exclusive,
            {
                "asset_id_exclusive": asset_id,
                "model_id_exclusive": model_id,
                "time_from_inclusive_exclusive": time_from_inclusive_utc,
                "time_to_inclusive_exclusive": time_to_inclusive_utc,
                "row_hard_cap_exclusive": row_hard_cap_exclusive,
            },
        )
        return [dict(row_mapping_exclusive) for row_mapping_exclusive in result_handle_exclusive.mappings()]
