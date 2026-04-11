"""Tradable assets (read for users, write for admin)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import PaginationParams, get_pagination
from app.core.security import get_current_user_id, require_admin_api_key
from app.db.repositories.asset_repository import AssetRepository
from app.db.session import get_db_session
from app.models.request.table_requests import CreateAssetRequest, UpdateAssetRequest
from app.models.response.table_responses import AssetResponse, PaginatedResponse

router = APIRouter(prefix="/assets")


@router.get("", response_model=PaginatedResponse[AssetResponse])
async def list_assets(
    pagination: PaginationParams = Depends(get_pagination),
    is_active: bool | None = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """List assets with pagination."""
    repository = AssetRepository(session)
    total = await repository.count(is_active=is_active)
    rows = await repository.list_page(
        offset=pagination.offset,
        limit=pagination.page_size,
        is_active=is_active,
    )
    return PaginatedResponse(
        items=[AssetResponse.model_validate(r) for r in rows],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/{asset_id}", response_model=AssetResponse)
async def get_asset(
    asset_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """Return one asset by id."""
    repository = AssetRepository(session)
    row = await repository.get_by_id(asset_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    return AssetResponse.model_validate(row)


@router.post("", response_model=AssetResponse, status_code=status.HTTP_201_CREATED)
async def create_asset(
    body: CreateAssetRequest,
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Create an asset (admin)."""
    repository = AssetRepository(session)
    try:
        row = await repository.create(
            symbol=body.symbol,
            name=body.name,
            category=body.category,
            coingecko_id=body.coingecko_id,
            is_active=body.is_active,
        )
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Symbol already exists",
        ) from exc
    return AssetResponse.model_validate(row)


@router.patch("/{asset_id}", response_model=AssetResponse)
async def update_asset(
    asset_id: uuid.UUID,
    body: UpdateAssetRequest,
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Patch an asset (admin)."""
    repository = AssetRepository(session)
    data = body.model_dump(exclude_unset=True)
    try:
        row = await repository.update(asset_id, data)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Update conflicts with existing data",
        ) from exc
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    return AssetResponse.model_validate(row)


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(
    asset_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Delete an asset (admin)."""
    repository = AssetRepository(session)
    deleted = await repository.delete(asset_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
