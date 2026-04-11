"""On-chain metrics time series (read: JWT; write: admin)."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import PaginationParams, get_pagination
from app.core.security import get_current_user_id, require_admin_api_key
from app.db.models.on_chain_metrics import OnChainMetric
from app.db.repositories.timeseries_repositories import OnChainMetricRepository
from app.db.session import get_db_session
from app.models.request.table_requests import (
    OnChainMetricBatchRequest,
    UpdateOnChainMetricRequest,
)
from app.models.response.table_responses import OnChainMetricResponse, PaginatedResponse

router = APIRouter(prefix="/on-chain-metrics")


def _to_ocm_response(row: OnChainMetric) -> OnChainMetricResponse:
    """Map ORM row to API model."""
    return OnChainMetricResponse(
        time=row.time,
        asset_id=row.asset_id,
        metric_name=row.metric_name,
        value=float(row.value),
    )


@router.get("", response_model=PaginatedResponse[OnChainMetricResponse])
async def list_on_chain_metrics(
    asset_id: uuid.UUID = Query(),
    time_from: datetime = Query(),
    time_to: datetime = Query(),
    metric_name: str | None = Query(default=None, max_length=50),
    pagination: PaginationParams = Depends(get_pagination),
    session: AsyncSession = Depends(get_db_session),
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """List on-chain metric values in a time range."""
    repository = OnChainMetricRepository(session)
    total = await repository.count_range(
        asset_id,
        time_from,
        time_to,
        metric_name=metric_name,
    )
    rows = await repository.list_range(
        asset_id=asset_id,
        time_from=time_from,
        time_to=time_to,
        metric_name=metric_name,
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    return PaginatedResponse(
        items=[_to_ocm_response(r) for r in rows],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.post("/batch", status_code=status.HTTP_201_CREATED)
async def batch_create_on_chain_metrics(
    body: OnChainMetricBatchRequest,
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Insert many on-chain metric rows (admin)."""
    repository = OnChainMetricRepository(session)
    rows_payload = [r.model_dump() for r in body.rows]
    await repository.insert_batch(rows_payload)
    return {"inserted": len(rows_payload)}


@router.patch("/row", response_model=OnChainMetricResponse)
async def patch_on_chain_metric_row(
    time: datetime = Query(),
    asset_id: uuid.UUID = Query(),
    metric_name: str = Query(max_length=50),
    body: UpdateOnChainMetricRequest = Body(),
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Patch one metric value (admin)."""
    repository = OnChainMetricRepository(session)
    data = body.model_dump()
    row = await repository.update_one(time, asset_id, metric_name, data)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Row not found")
    return _to_ocm_response(row)


@router.delete("/row", status_code=status.HTTP_204_NO_CONTENT)
async def delete_on_chain_metric_row(
    time: datetime = Query(),
    asset_id: uuid.UUID = Query(),
    metric_name: str = Query(max_length=50),
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Delete one on-chain metric row (admin)."""
    repository = OnChainMetricRepository(session)
    deleted = await repository.delete_one(time, asset_id, metric_name)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Row not found")
