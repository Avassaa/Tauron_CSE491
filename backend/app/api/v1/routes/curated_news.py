"""Curated news summaries (read: JWT; write: admin)."""

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import PaginationParams, get_pagination
from app.core.security import get_current_user_id, require_admin_api_key
from app.db.models.asset import Asset
from app.db.models.curated_news import CuratedNews
from app.db.models.news_data import NewsData
from app.db.repositories.curated_news_repository import CuratedNewsRepository
from app.db.session import get_db_session
from app.models.request.table_requests import CreateCuratedNewsRequest, UpdateCuratedNewsRequest
from app.models.response.table_responses import CuratedNewsResponse, PaginatedResponse

router = APIRouter(prefix="/curated-news")


async def _asset_symbols_for_rows(session: AsyncSession, rows: list[CuratedNews]) -> dict[uuid.UUID, str]:
    ids = {row.asset_id for row in rows if row.asset_id}
    if not ids:
        return {}
    result = await session.execute(select(Asset.id, Asset.symbol).where(Asset.id.in_(ids)))
    return {asset_id: symbol for asset_id, symbol in result.all()}


def _response(
    row: CuratedNews,
    symbol_map: dict[uuid.UUID, str],
    *,
    article_content: Optional[str] = None,
) -> CuratedNewsResponse:
    base = CuratedNewsResponse.model_validate(row)
    sym = symbol_map.get(row.asset_id) if row.asset_id else None
    return base.model_copy(update={"asset_symbol": sym, "article_content": article_content})


async def _news_data_content(session: AsyncSession, row: CuratedNews) -> Optional[str]:
    """Return raw ``news_data.content`` when ``data_points_used`` links a row."""
    dp = row.data_points_used
    if not isinstance(dp, dict):
        return None
    raw_id = dp.get("news_data_id")
    if raw_id is None:
        return None
    try:
        nid = uuid.UUID(str(raw_id))
    except ValueError:
        return None
    result = await session.execute(select(NewsData.content).where(NewsData.id == nid))
    return result.scalar_one_or_none()


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
    symbol_map = await _asset_symbols_for_rows(session, rows)
    return PaginatedResponse(
        items=[_response(r, symbol_map, article_content=None) for r in rows],
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
    symbol_map = await _asset_symbols_for_rows(session, [row])
    article_content = await _news_data_content(session, row)
    return _response(row, symbol_map, article_content=article_content or None)


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
            published_at=body.published_at,
        )
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not create row",
        ) from exc
    symbol_map = await _asset_symbols_for_rows(session, [row])
    return _response(row, symbol_map)


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
    symbol_map = await _asset_symbols_for_rows(session, [row])
    return _response(row, symbol_map)


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
