"""Named user watchlists (JWT scoped to current user)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.repositories.asset_repository import AssetRepository
from app.db.repositories.watchlist_lists_repository import WatchlistListsRepository
from app.db.session import get_db_session
from app.models.request.table_requests import CreateWatchlistListRequest, UpdateWatchlistListRequest
from app.models.response.table_responses import (
    AssetResponse,
    WatchlistListEntryResponse,
    WatchlistListResponse,
)

router = APIRouter(prefix="/users/me/watchlists")


@router.get("", response_model=list[WatchlistListResponse])
async def list_my_watchlists(
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    repo = WatchlistListsRepository(session)
    return await repo.list_lists(user_id)


@router.post("", response_model=WatchlistListResponse, status_code=status.HTTP_201_CREATED)
async def create_my_watchlist(
    body: CreateWatchlistListRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    repo = WatchlistListsRepository(session)
    name = body.name.strip()
    existing = await repo.get_list_by_name(user_id, name)
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Watchlist name already exists")
    return await repo.create_list(user_id, name)


@router.patch("/{list_id}", response_model=WatchlistListResponse)
async def rename_my_watchlist(
    list_id: uuid.UUID,
    body: UpdateWatchlistListRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    repo = WatchlistListsRepository(session)
    row = await repo.rename_list(list_id, user_id, body.name.strip())
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watchlist not found")
    return row


@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_watchlist(
    list_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    repo = WatchlistListsRepository(session)
    deleted = await repo.delete_list(list_id, user_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watchlist not found")
    return None


@router.get("/{list_id}/assets", response_model=list[WatchlistListEntryResponse])
async def list_watchlist_assets(
    list_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    repo = WatchlistListsRepository(session)
    owned = await repo.get_list(list_id, user_id)
    if owned is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watchlist not found")
    pairs = await repo.list_items_with_assets(list_id)
    return [WatchlistListEntryResponse(list_id=list_id, asset=AssetResponse.model_validate(asset)) for _, asset in pairs]


@router.put("/{list_id}/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def add_asset_to_watchlist(
    list_id: uuid.UUID,
    asset_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    list_repo = WatchlistListsRepository(session)
    owned = await list_repo.get_list(list_id, user_id)
    if owned is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watchlist not found")
    asset_repo = AssetRepository(session)
    asset = await asset_repo.get_by_id(asset_id)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    await list_repo.add_item(list_id, asset_id)
    return None


@router.delete("/{list_id}/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_asset_from_watchlist(
    list_id: uuid.UUID,
    asset_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    repo = WatchlistListsRepository(session)
    owned = await repo.get_list(list_id, user_id)
    if owned is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watchlist not found")
    removed = await repo.remove_item(list_id, asset_id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset is not in this watchlist")
