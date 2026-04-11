"""User watchlist (JWT scoped to current user)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.repositories.asset_repository import AssetRepository
from app.db.repositories.watchlist_repository import WatchlistRepository
from app.db.session import get_db_session
from app.models.response.table_responses import AssetResponse, WatchlistEntryResponse

router = APIRouter(prefix="/users/me/watchlist")


@router.get("", response_model=list[WatchlistEntryResponse])
async def list_my_watchlist(
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    """List assets on the current user's watchlist."""
    watch_repo = WatchlistRepository(session)
    pairs = await watch_repo.list_for_user_with_assets(user_id)
    out: list[WatchlistEntryResponse] = []
    for watch, asset in pairs:
        out.append(
            WatchlistEntryResponse(
                user_id=watch.user_id,
                asset=AssetResponse.model_validate(asset),
            ),
        )
    return out


@router.put("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def add_to_watchlist(
    asset_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    """Idempotently add an asset to the watchlist."""
    asset_repo = AssetRepository(session)
    asset = await asset_repo.get_by_id(asset_id)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    watch_repo = WatchlistRepository(session)
    existing = await watch_repo.get_pair(user_id, asset_id)
    if existing is not None:
        return None
    try:
        await watch_repo.add(user_id, asset_id)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Watchlist entry could not be created",
        ) from exc
    return None


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_watchlist(
    asset_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    """Remove an asset from the watchlist."""
    watch_repo = WatchlistRepository(session)
    removed = await watch_repo.remove(user_id, asset_id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not on watchlist")
