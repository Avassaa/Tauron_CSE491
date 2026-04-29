"""Persistence helpers for price alerts."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.asset import Asset
from app.db.models.price_alerts import PriceAlert


class PriceAlertRepository:
    """CRUD helpers for user price alerts."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_for_user(self, user_id: uuid.UUID) -> list[PriceAlert]:
        result = await self._session.execute(
            select(PriceAlert)
            .where(PriceAlert.user_id == user_id)
            .order_by(PriceAlert.created_at.desc())
        )
        return list(result.scalars().all())

    async def list_active(self) -> list[tuple[PriceAlert, Asset]]:
        result = await self._session.execute(
            select(PriceAlert, Asset)
            .join(Asset, PriceAlert.asset_id == Asset.id)
            .where(PriceAlert.is_active.is_(True))
            .order_by(PriceAlert.symbol)
        )
        return list(result.all())

    async def get_for_user(self, user_id: uuid.UUID, alert_id: uuid.UUID) -> Optional[PriceAlert]:
        result = await self._session.execute(
            select(PriceAlert).where(
                PriceAlert.id == alert_id,
                PriceAlert.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        asset_id: uuid.UUID,
        symbol: str,
        condition: str,
        target_price: Decimal,
        reference_price: Optional[Decimal] = None,
        percentage_change: Optional[Decimal] = None,
    ) -> PriceAlert:
        alert = PriceAlert(
            user_id=user_id,
            asset_id=asset_id,
            symbol=symbol,
            condition=condition,
            target_price=target_price,
            reference_price=reference_price,
            percentage_change=percentage_change,
        )
        self._session.add(alert)
        await self._session.commit()
        await self._session.refresh(alert)
        return alert

    async def update_for_user(
        self,
        user_id: uuid.UUID,
        alert_id: uuid.UUID,
        *,
        condition: Optional[str] = None,
        target_price: Optional[Decimal] = None,
        is_active: Optional[bool] = None,
    ) -> Optional[PriceAlert]:
        alert = await self.get_for_user(user_id, alert_id)
        if alert is None:
            return None
        if condition is not None:
            alert.condition = condition
        if target_price is not None:
            alert.target_price = target_price
        if is_active is not None:
            alert.is_active = is_active
            if is_active:
                alert.triggered_at = None
        await self._session.commit()
        await self._session.refresh(alert)
        return alert

    async def delete_for_user(self, user_id: uuid.UUID, alert_id: uuid.UUID) -> bool:
        result = await self._session.execute(
            delete(PriceAlert).where(
                PriceAlert.id == alert_id,
                PriceAlert.user_id == user_id,
            )
        )
        await self._session.commit()
        return (result.rowcount or 0) > 0

    async def trigger_if_active(
        self,
        alert_id: uuid.UUID,
        *,
        current_price: Decimal,
    ) -> Optional[PriceAlert]:
        alert = await self._session.get(PriceAlert, alert_id)
        if alert is None or not alert.is_active or alert.triggered_at is not None:
            return None
        alert.is_active = False
        alert.triggered_at = datetime.now(timezone.utc)
        alert.last_checked_price = current_price
        await self._session.commit()
        await self._session.refresh(alert)
        return alert
