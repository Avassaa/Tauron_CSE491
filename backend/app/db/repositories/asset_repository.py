"""Persistence helpers for ``assets`` rows."""

import uuid
from typing import Any, Optional

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.asset import Asset


class AssetRepository:
    """CRUD operations for tradable assets."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def count(self, is_active: Optional[bool] = None) -> int:
        """Return total assets optionally filtered by ``is_active``."""
        statement = select(func.count()).select_from(Asset)
        if is_active is not None:
            statement = statement.where(Asset.is_active == is_active)
        result = await self._session.execute(statement)
        return int(result.scalar_one() or 0)

    async def list_page(
        self,
        offset: int,
        limit: int,
        is_active: Optional[bool] = None,
    ) -> list[Asset]:
        """Return a page of assets ordered by symbol."""
        statement = select(Asset).order_by(Asset.symbol).offset(offset).limit(limit)
        if is_active is not None:
            statement = statement.where(Asset.is_active == is_active)
        result = await self._session.execute(statement)
        return list(result.scalars().all())

    async def get_by_id(self, asset_id: uuid.UUID) -> Optional[Asset]:
        """Load an asset by primary key."""
        result = await self._session.execute(select(Asset).where(Asset.id == asset_id))
        return result.scalar_one_or_none()

    async def create(
        self,
        symbol: str,
        name: str,
        category: Optional[str] = None,
        coingecko_id: Optional[str] = None,
        is_active: bool = True,
    ) -> Asset:
        """Insert a new asset."""
        row = Asset(
            symbol=symbol.strip(),
            name=name.strip(),
            category=category,
            coingecko_id=coingecko_id,
            is_active=is_active,
        )
        self._session.add(row)
        try:
            await self._session.commit()
        except IntegrityError:
            await self._session.rollback()
            raise
        await self._session.refresh(row)
        return row

    async def update(
        self,
        asset_id: uuid.UUID,
        fields: dict[str, Any],
    ) -> Optional[Asset]:
        """Apply partial updates to an asset (omit keys you do not want to change)."""
        row = await self.get_by_id(asset_id)
        if row is None:
            return None
        allowed = {"symbol", "name", "category", "coingecko_id", "is_active"}
        for key, value in fields.items():
            if key not in allowed:
                continue
            if key == "is_active" or value is not None:
                setattr(row, key, value)
        try:
            await self._session.commit()
        except IntegrityError:
            await self._session.rollback()
            raise
        await self._session.refresh(row)
        return row

    async def delete(self, asset_id: uuid.UUID) -> bool:
        """Delete an asset by id."""
        result = await self._session.execute(delete(Asset).where(Asset.id == asset_id))
        await self._session.commit()
        return result.rowcount > 0
