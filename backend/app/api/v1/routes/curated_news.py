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
from app.db.models.news_comment import NewsComment
from app.db.repositories.curated_news_repository import CuratedNewsRepository
from app.db.repositories.news_comment_repository import NewsCommentRepository
from app.db.session import get_db_session
from app.models.request.table_requests import (
    CreateCuratedNewsRequest,
    CreateNewsCommentRequest,
    UpdateCuratedNewsRequest,
    UpdateNewsCommentRequest,
)
from app.models.response.table_responses import CuratedNewsResponse, NewsCommentResponse, PaginatedResponse

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


def _comment_response(
    row: NewsComment,
    username: str,
    *,
    parent_username: str | None = None,
) -> NewsCommentResponse:
    return NewsCommentResponse(
        id=row.id,
        curated_news_id=row.curated_news_id,
        user_id=row.user_id,
        username=username,
        content=row.content,
        created_at=row.created_at,
        updated_at=row.updated_at,
        parent_comment_id=row.parent_id,
        parent_username=parent_username,
    )


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


@router.get(
    "/{news_id}/comments",
    response_model=PaginatedResponse[NewsCommentResponse],
)
async def list_news_comments(
    news_id: uuid.UUID,
    pagination: PaginationParams = Depends(get_pagination),
    session: AsyncSession = Depends(get_db_session),
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """List comments for a curated news item (oldest first)."""
    comment_repo = NewsCommentRepository(session)
    if not await comment_repo.curated_news_exists(news_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    total = await comment_repo.count_for_news(news_id)
    rows = await comment_repo.list_page(
        news_id,
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    return PaginatedResponse(
        items=[_comment_response(r, uname, parent_username=pu) for r, uname, pu in rows],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.post(
    "/{news_id}/comments",
    response_model=NewsCommentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_news_comment(
    news_id: uuid.UUID,
    body: CreateNewsCommentRequest,
    session: AsyncSession = Depends(get_db_session),
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    """Add a comment on a curated news article (authenticated)."""
    text = body.content.strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Comment cannot be empty",
        )
    comment_repo = NewsCommentRepository(session)
    if not await comment_repo.curated_news_exists(news_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    parent_id = body.parent_comment_id
    parent_username: str | None = None
    if parent_id is not None:
        parent = await comment_repo.get_by_id(parent_id)
        if parent is None or parent.curated_news_id != news_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
        parent_username = await comment_repo.username_for_user(parent.user_id)
    row = await comment_repo.create(
        curated_news_id=news_id,
        user_id=user_id,
        content=text,
        parent_id=parent_id,
    )
    username = await comment_repo.username_for_user(user_id)
    if username is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _comment_response(row, username, parent_username=parent_username)


@router.patch(
    "/{news_id}/comments/{comment_id}",
    response_model=NewsCommentResponse,
)
async def update_news_comment(
    news_id: uuid.UUID,
    comment_id: uuid.UUID,
    body: UpdateNewsCommentRequest,
    session: AsyncSession = Depends(get_db_session),
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    """Edit your own comment on a curated news article."""
    text = body.content.strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Comment cannot be empty",
        )
    comment_repo = NewsCommentRepository(session)
    row = await comment_repo.update_content_if_owned(
        comment_id=comment_id,
        curated_news_id=news_id,
        user_id=user_id,
        content=text,
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    username = await comment_repo.username_for_user(user_id)
    if username is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    parent_username: str | None = None
    if row.parent_id is not None:
        parent = await comment_repo.get_by_id(row.parent_id)
        if parent is not None:
            parent_username = await comment_repo.username_for_user(parent.user_id)
    return _comment_response(row, username, parent_username=parent_username)


@router.delete(
    "/{news_id}/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_news_comment(
    news_id: uuid.UUID,
    comment_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    """Delete your own comment on a curated news article."""
    comment_repo = NewsCommentRepository(session)
    ok = await comment_repo.delete_if_owned(
        comment_id=comment_id,
        curated_news_id=news_id,
        user_id=user_id,
    )
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")


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
