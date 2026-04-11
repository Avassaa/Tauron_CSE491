"""Curated news summaries (read: JWT; write: admin)."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import PaginationParams, get_pagination
from app.core.security import get_current_user_id, require_admin_api_key
from app.db.repositories.curated_news_repository import CuratedNewsRepository
from app.db.session import get_db_session
from app.models.request.table_requests import CreateCuratedNewsRequest, UpdateCuratedNewsRequest
from app.models.response.table_responses import CuratedNewsResponse, PaginatedResponse

router = APIRouter(prefix="/curated-news")


@router.get("", response_model=PaginatedResponse[CuratedNewsResponse])
async def list_curated_news(
    pagination: PaginationParams = Depends(get_pagination),
    asset_id: uuid.UUID | None = Query(default=None),
    created_from: datetime | None = Query(default=None),
    created_to: datetime | None = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """List curated news with optional filters."""
    repository = CuratedNewsRepository(session)
    total = await repository.count(
        asset_id=asset_id,
        created_from=created_from,
        created_to=created_to,
    )
    rows = await repository.list_page(
        offset=pagination.offset,
        limit=pagination.page_size,
        asset_id=asset_id,
        created_from=created_from,
        created_to=created_to,
    )
    return PaginatedResponse(
        items=[CuratedNewsResponse.model_validate(r) for r in rows],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/{news_id}", response_model=CuratedNewsResponse)
async def get_curated_news(
    news_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """Return one curated news row."""
    repository = CuratedNewsRepository(session)
    row = await repository.get_by_id(news_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return CuratedNewsResponse.model_validate(row)


@router.post("", response_model=CuratedNewsResponse, status_code=status.HTTP_201_CREATED)
async def create_curated_news(
    body: CreateCuratedNewsRequest,
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Create curated news (admin)."""
    repository = CuratedNewsRepository(session)
    try:
        row = await repository.create(
            summary=body.summary,
            asset_id=body.asset_id,
            sentiment_score=body.sentiment_score,
            data_points_used=body.data_points_used,
        )
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not create row",
        ) from exc
    return CuratedNewsResponse.model_validate(row)


@router.patch("/{news_id}", response_model=CuratedNewsResponse)
async def update_curated_news(
    news_id: uuid.UUID,
    body: UpdateCuratedNewsRequest,
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Patch curated news (admin)."""
    repository = CuratedNewsRepository(session)
    data = body.model_dump(exclude_unset=True)
    try:
        row = await repository.update(news_id, data)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Update conflict",
        ) from exc
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return CuratedNewsResponse.model_validate(row)


@router.delete("/{news_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_curated_news(
    news_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Delete curated news (admin)."""
    repository = CuratedNewsRepository(session)
    deleted = await repository.delete(news_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
