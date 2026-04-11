"""Scraper execution logs (admin only)."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import PaginationParams, get_pagination
from app.core.security import require_admin_api_key
from app.db.repositories.scraper_log_repository import ScraperLogRepository
from app.db.session import get_db_session
from app.models.request.table_requests import CreateScraperLogRequest, UpdateScraperLogRequest
from app.models.response.table_responses import PaginatedResponse, ScraperLogResponse

router = APIRouter(prefix="/scraper-logs")


@router.get("", response_model=PaginatedResponse[ScraperLogResponse])
async def list_scraper_logs(
    pagination: PaginationParams = Depends(get_pagination),
    source: str | None = Query(default=None, max_length=50),
    executed_from: datetime | None = Query(default=None),
    executed_to: datetime | None = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """List scraper logs (admin)."""
    repository = ScraperLogRepository(session)
    total = await repository.count(
        source=source,
        executed_from=executed_from,
        executed_to=executed_to,
    )
    rows = await repository.list_page(
        offset=pagination.offset,
        limit=pagination.page_size,
        source=source,
        executed_from=executed_from,
        executed_to=executed_to,
    )
    return PaginatedResponse(
        items=[ScraperLogResponse.model_validate(r) for r in rows],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/{log_id}", response_model=ScraperLogResponse)
async def get_scraper_log(
    log_id: int,
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Return one scraper log row (admin)."""
    repository = ScraperLogRepository(session)
    row = await repository.get_by_id(log_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return ScraperLogResponse.model_validate(row)


@router.post("", response_model=ScraperLogResponse, status_code=status.HTTP_201_CREATED)
async def create_scraper_log(
    body: CreateScraperLogRequest,
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Append a scraper log (admin)."""
    repository = ScraperLogRepository(session)
    row = await repository.create(
        source=body.source,
        status=body.status,
        error_msg=body.error_msg,
        rows_affected=body.rows_affected,
    )
    return ScraperLogResponse.model_validate(row)


@router.patch("/{log_id}", response_model=ScraperLogResponse)
async def update_scraper_log(
    log_id: int,
    body: UpdateScraperLogRequest,
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Patch a scraper log row (admin)."""
    repository = ScraperLogRepository(session)
    data = body.model_dump(exclude_unset=True)
    row = await repository.update(log_id, data)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return ScraperLogResponse.model_validate(row)


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scraper_log(
    log_id: int,
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Delete a scraper log row (admin)."""
    repository = ScraperLogRepository(session)
    deleted = await repository.delete(log_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
