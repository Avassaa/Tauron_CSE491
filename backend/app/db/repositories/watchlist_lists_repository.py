"""Persistence helpers for named watchlists."""

import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.asset import Asset
from app.db.models.watchlist_lists import WatchlistList, WatchlistListItem


class WatchlistListsRepository:
    """CRUD operations for named watchlists and their items."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_lists(self, user_id: uuid.UUID) -> list[WatchlistList]:
        result = await self._session.execute(
            select(WatchlistList).where(WatchlistList.user_id == user_id).order_by(WatchlistList.created_at.desc())
        )
        return list(result.scalars().all())

    async def create_list(self, user_id: uuid.UUID, name: str) -> WatchlistList:
        row = WatchlistList(user_id=user_id, name=name)
        self._session.add(row)
        await self._session.commit()
        await self._session.refresh(row)
        return row

    async def get_list(self, list_id: uuid.UUID, user_id: uuid.UUID) -> WatchlistList | None:
        result = await self._session.execute(
            select(WatchlistList).where(WatchlistList.id == list_id, WatchlistList.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def rename_list(self, list_id: uuid.UUID, user_id: uuid.UUID, name: str) -> WatchlistList | None:
        row = await self.get_list(list_id, user_id)
        if row is None:
            return None
        row.name = name
        await self._session.commit()
        await self._session.refresh(row)
        return row

    async def delete_list(self, list_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        row = await self.get_list(list_id, user_id)
        if row is None:
            return False
        await self._session.execute(delete(WatchlistListItem).where(WatchlistListItem.list_id == list_id))
        await self._session.delete(row)
        await self._session.commit()
        return True

    async def list_items_with_assets(self, list_id: uuid.UUID) -> list[tuple[WatchlistListItem, Asset]]:
        result = await self._session.execute(
            select(WatchlistListItem, Asset)
            .join(Asset, WatchlistListItem.asset_id == Asset.id)
            .where(WatchlistListItem.list_id == list_id)
            .order_by(Asset.symbol)
        )
        return list(result.all())

    async def add_item(self, list_id: uuid.UUID, asset_id: uuid.UUID) -> None:
        existing = await self._session.execute(
            select(WatchlistListItem).where(
                WatchlistListItem.list_id == list_id,
                WatchlistListItem.asset_id == asset_id,
            )
        )
        if existing.scalar_one_or_none() is not None:
            return
        self._session.add(WatchlistListItem(list_id=list_id, asset_id=asset_id))
        await self._session.commit()

    async def remove_item(self, list_id: uuid.UUID, asset_id: uuid.UUID) -> bool:
        result = await self._session.execute(
            delete(WatchlistListItem).where(
                WatchlistListItem.list_id == list_id,
                WatchlistListItem.asset_id == asset_id,
            )
        )
        await self._session.commit()
        return result.rowcount > 0
