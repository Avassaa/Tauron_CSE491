"""Persistence helpers for ``watchlists`` rows."""

import uuid
from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.asset import Asset
from app.db.models.watchlists import Watchlist


class WatchlistRepository:
    """User watchlist links with optional asset eager load."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_for_user_with_assets(self, user_id: uuid.UUID) -> list[tuple[Watchlist, Asset]]:
        """Return watchlist rows joined to ``Asset`` for one user."""
        statement = (
            select(Watchlist, Asset)
            .join(Asset, Watchlist.asset_id == Asset.id)
            .where(Watchlist.user_id == user_id)
            .order_by(Asset.symbol)
        )
        result = await self._session.execute(statement)
        return list(result.all())

    async def get_pair(
        self,
        user_id: uuid.UUID,
        asset_id: uuid.UUID,
    ) -> Optional[Watchlist]:
        """Return the watchlist row if the pair exists."""
        statement = select(Watchlist).where(
            Watchlist.user_id == user_id,
            Watchlist.asset_id == asset_id,
        )
        result = await self._session.execute(statement)
        return result.scalar_one_or_none()

    async def add(self, user_id: uuid.UUID, asset_id: uuid.UUID) -> Watchlist:
        """Insert a watchlist pair (idempotent at DB level if unique)."""
        row = Watchlist(user_id=user_id, asset_id=asset_id)
        self._session.add(row)
        await self._session.commit()
        await self._session.refresh(row)
        return row

    async def remove(self, user_id: uuid.UUID, asset_id: uuid.UUID) -> bool:
        """Delete a watchlist pair."""
        result = await self._session.execute(
            delete(Watchlist).where(
                Watchlist.user_id == user_id,
                Watchlist.asset_id == asset_id,
            ),
        )
        await self._session.commit()
        return result.rowcount > 0
