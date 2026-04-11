"""Technical indicators time series (read: JWT; write: admin)."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import PaginationParams, get_pagination
from app.core.security import get_current_user_id, require_admin_api_key
from app.db.models.technical_indicators import TechnicalIndicator
from app.db.repositories.timeseries_repositories import TechnicalIndicatorRepository
from app.db.session import get_db_session
from app.models.request.table_requests import (
    TechnicalIndicatorBatchRequest,
    UpdateTechnicalIndicatorRequest,
)
from app.models.response.table_responses import PaginatedResponse, TechnicalIndicatorResponse

router = APIRouter(prefix="/technical-indicators")


def _to_ti_response(row: TechnicalIndicator) -> TechnicalIndicatorResponse:
    """Map ORM row to API model."""
    return TechnicalIndicatorResponse(
        time=row.time,
        asset_id=row.asset_id,
        indicator_name=row.indicator_name,
        value=float(row.value),
    )


@router.get("", response_model=PaginatedResponse[TechnicalIndicatorResponse])
async def list_technical_indicators(
    asset_id: uuid.UUID = Query(),
    time_from: datetime = Query(),
    time_to: datetime = Query(),
    indicator_name: str | None = Query(default=None, max_length=50),
    pagination: PaginationParams = Depends(get_pagination),
    session: AsyncSession = Depends(get_db_session),
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """List technical indicator values in a time range."""
    repository = TechnicalIndicatorRepository(session)
    total = await repository.count_range(
        asset_id,
        time_from,
        time_to,
        indicator_name=indicator_name,
    )
    rows = await repository.list_range(
        asset_id=asset_id,
        time_from=time_from,
        time_to=time_to,
        indicator_name=indicator_name,
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    return PaginatedResponse(
        items=[_to_ti_response(r) for r in rows],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.post("/batch", status_code=status.HTTP_201_CREATED)
async def batch_create_technical_indicators(
    body: TechnicalIndicatorBatchRequest,
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Insert many technical indicator rows (admin)."""
    repository = TechnicalIndicatorRepository(session)
    rows_payload = [r.model_dump() for r in body.rows]
    await repository.insert_batch(rows_payload)
    return {"inserted": len(rows_payload)}


@router.patch("/row", response_model=TechnicalIndicatorResponse)
async def patch_technical_indicator_row(
    time: datetime = Query(),
    asset_id: uuid.UUID = Query(),
    indicator_name: str = Query(max_length=50),
    body: UpdateTechnicalIndicatorRequest = Body(),
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Patch one indicator value (admin)."""
    repository = TechnicalIndicatorRepository(session)
    data = body.model_dump()
    row = await repository.update_one(time, asset_id, indicator_name, data)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Row not found")
    return _to_ti_response(row)


@router.delete("/row", status_code=status.HTTP_204_NO_CONTENT)
async def delete_technical_indicator_row(
    time: datetime = Query(),
    asset_id: uuid.UUID = Query(),
    indicator_name: str = Query(max_length=50),
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Delete one technical indicator row (admin)."""
    repository = TechnicalIndicatorRepository(session)
    deleted = await repository.delete_one(time, asset_id, indicator_name)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Row not found")
