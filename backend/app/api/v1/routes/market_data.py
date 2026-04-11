"""OHLCV market data (read: JWT; write: admin)."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import PaginationParams, get_pagination
from app.core.security import get_current_user_id, require_admin_api_key
from app.db.models.market_data import MarketData
from app.db.repositories.timeseries_repositories import MarketDataRepository
from app.db.session import get_db_session
from app.models.request.table_requests import (
    MarketDataBatchRequest,
    UpdateMarketDataRequest,
)
from app.models.response.table_responses import MarketDataResponse, PaginatedResponse

router = APIRouter(prefix="/market-data")


def _to_market_data_response(row: MarketData) -> MarketDataResponse:
    """Map ORM row to API model."""
    return MarketDataResponse(
        time=row.time,
        asset_id=row.asset_id,
        open=float(row.open),
        high=float(row.high),
        low=float(row.low),
        close=float(row.close),
        volume=float(row.volume),
        resolution=row.resolution,
    )


@router.get("", response_model=PaginatedResponse[MarketDataResponse])
async def list_market_data(
    asset_id: uuid.UUID = Query(),
    time_from: datetime = Query(),
    time_to: datetime = Query(),
    resolution: str | None = Query(default=None),
    pagination: PaginationParams = Depends(get_pagination),
    session: AsyncSession = Depends(get_db_session),
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """List OHLCV candles in a time range."""
    repository = MarketDataRepository(session)
    total = await repository.count_range(asset_id, time_from, time_to, resolution=resolution)
    rows = await repository.list_range(
        asset_id=asset_id,
        time_from=time_from,
        time_to=time_to,
        resolution=resolution,
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    return PaginatedResponse(
        items=[_to_market_data_response(r) for r in rows],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.post("/batch", status_code=status.HTTP_201_CREATED)
async def batch_create_market_data(
    body: MarketDataBatchRequest,
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Insert many OHLCV rows (admin)."""
    repository = MarketDataRepository(session)
    rows_payload = [r.model_dump() for r in body.rows]
    await repository.insert_batch(rows_payload)
    return {"inserted": len(rows_payload)}


@router.patch("/row", response_model=MarketDataResponse)
async def patch_market_data_row(
    time: datetime = Query(),
    asset_id: uuid.UUID = Query(),
    body: UpdateMarketDataRequest = Body(),
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Patch one candle (admin)."""
    repository = MarketDataRepository(session)
    data = body.model_dump(exclude_unset=True)
    row = await repository.update_one(time, asset_id, data)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candle not found")
    return _to_market_data_response(row)


@router.delete("/row", status_code=status.HTTP_204_NO_CONTENT)
async def delete_market_data_row(
    time: datetime = Query(),
    asset_id: uuid.UUID = Query(),
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Delete one candle (admin)."""
    repository = MarketDataRepository(session)
    deleted = await repository.delete_one(time, asset_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candle not found")
