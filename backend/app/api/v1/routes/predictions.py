"""Model predictions time series (read: JWT; write: admin)."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import PaginationParams, get_pagination
from app.core.security import get_current_user_id, require_admin_api_key
from app.db.models.predictions import Prediction
from app.db.repositories.prediction_repository import PredictionRepository
from app.db.session import get_db_session
from app.models.request.table_requests import (
    PredictionBatchRequest,
    UpdatePredictionRequest,
)
from app.models.response.table_responses import PaginatedResponse, PredictionResponse

router = APIRouter(prefix="/predictions")


def _to_prediction_response(row: Prediction) -> PredictionResponse:
    """Map ORM row to API model with float coercion."""
    return PredictionResponse(
        time=row.time,
        asset_id=row.asset_id,
        model_id=row.model_id,
        predicted_value=float(row.predicted_value),
        confidence_interval_high=(
            None if row.confidence_interval_high is None else float(row.confidence_interval_high)
        ),
        confidence_interval_low=(
            None if row.confidence_interval_low is None else float(row.confidence_interval_low)
        ),
    )


@router.get("", response_model=PaginatedResponse[PredictionResponse])
async def list_predictions(
    asset_id: uuid.UUID = Query(),
    time_from: datetime = Query(),
    time_to: datetime = Query(),
    model_id: uuid.UUID | None = Query(default=None),
    pagination: PaginationParams = Depends(get_pagination),
    session: AsyncSession = Depends(get_db_session),
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """List predictions in a time range for one asset."""
    repository = PredictionRepository(session)
    total = await repository.count_range(asset_id, time_from, time_to, model_id=model_id)
    rows = await repository.list_range(
        asset_id=asset_id,
        time_from=time_from,
        time_to=time_to,
        model_id=model_id,
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    return PaginatedResponse(
        items=[_to_prediction_response(r) for r in rows],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.post("/batch", status_code=status.HTTP_201_CREATED)
async def batch_create_predictions(
    body: PredictionBatchRequest,
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Insert many prediction rows (admin)."""
    repository = PredictionRepository(session)
    rows_payload = [r.model_dump() for r in body.rows]
    await repository.insert_batch(rows_payload)
    return {"inserted": len(rows_payload)}


@router.patch("/row", response_model=PredictionResponse)
async def patch_prediction_row(
    time: datetime = Query(),
    asset_id: uuid.UUID = Query(),
    model_id: uuid.UUID = Query(),
    body: UpdatePredictionRequest = Body(),
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Patch one prediction identified by composite key (admin)."""
    repository = PredictionRepository(session)
    data = body.model_dump(exclude_unset=True)
    row = await repository.update_one(time, asset_id, model_id, data)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prediction not found")
    return _to_prediction_response(row)


@router.delete("/row", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prediction_row(
    time: datetime = Query(),
    asset_id: uuid.UUID = Query(),
    model_id: uuid.UUID = Query(),
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Delete one prediction row (admin)."""
    repository = PredictionRepository(session)
    deleted = await repository.delete_one(time, asset_id, model_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prediction not found")
