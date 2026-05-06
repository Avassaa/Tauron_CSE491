"""Model predictions time series (read: JWT; write: admin)."""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import PaginationParams, get_pagination
from app.core.security import get_current_user_id, require_admin_api_key
from app.db.models.market_data import MarketData
from app.db.models.predictions import Prediction
from app.db.repositories.ml_model_repository import MlModelRepository
from app.db.repositories.prediction_repository import PredictionRepository
from app.db.repositories.timeseries_repositories import MarketDataRepository
from app.db.session import get_db_session
from app.models.request.table_requests import (
    PredictionBatchRequest,
    UpdatePredictionRequest,
)
from app.models.response.table_responses import (
    AssetPredictionSummaryResponse,
    MarketDataResponse,
    MlModelResponse,
    PaginatedResponse,
    PredictionResponse,
)

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


def _to_market_data_response(row: MarketData) -> MarketDataResponse:
    """Map OHLCV ORM row to API model."""
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


_PREDICTIONS_DEFAULT_HISTORY_DAYS = 730
_PREDICTIONS_DEFAULT_FUTURE_DAYS = 365


@router.get("/models", response_model=PaginatedResponse[MlModelResponse])
async def list_models_under_predictions_alias(
    pagination: PaginationParams = Depends(get_pagination),
    asset_id: uuid.UUID | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """List ML models via the predictions UI path (delegates to ``ml-models`` semantics)."""
    repository = MlModelRepository(session)
    total = await repository.count(asset_id=asset_id, is_active=is_active)
    rows = await repository.list_page(
        offset=pagination.offset,
        limit=pagination.page_size,
        asset_id=asset_id,
        is_active=is_active,
    )
    return PaginatedResponse(
        items=[MlModelResponse.model_validate(r) for r in rows],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/market-data", response_model=list[MarketDataResponse])
async def list_market_data_under_predictions_alias(
    asset_id: uuid.UUID = Query(),
    limit: int = Query(default=720, ge=1, le=10000),
    resolution: str = Query(default="1h"),
    session: AsyncSession = Depends(get_db_session),
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """Return recent candles for charts (last ``limit`` steps at ``resolution``)."""
    time_to = datetime.now(timezone.utc)
    time_from = time_to - timedelta(hours=limit)
    repository = MarketDataRepository(session)
    rows = await repository.list_range(
        asset_id=asset_id,
        time_from=time_from,
        time_to=time_to,
        resolution=resolution,
        offset=0,
        limit=limit,
    )
    return [_to_market_data_response(r) for r in rows]


@router.get("", response_model=PaginatedResponse[PredictionResponse])
async def list_predictions(
    asset_id: uuid.UUID = Query(),
    time_from: datetime | None = Query(default=None),
    time_to: datetime | None = Query(default=None),
    model_id: uuid.UUID | None = Query(default=None),
    pagination: PaginationParams = Depends(get_pagination),
    session: AsyncSession = Depends(get_db_session),
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """List predictions in a time range for one asset.

    When ``time_from`` / ``time_to`` are omitted, a wide default window is used so the
    dashboard can query with pagination only.
    """
    now = datetime.now(timezone.utc)
    effective_from = time_from if time_from is not None else now - timedelta(days=_PREDICTIONS_DEFAULT_HISTORY_DAYS)
    effective_to = time_to if time_to is not None else now + timedelta(days=_PREDICTIONS_DEFAULT_FUTURE_DAYS)
    repository = PredictionRepository(session)
    total = await repository.count_range(
        asset_id, effective_from, effective_to, model_id=model_id
    )
    rows = await repository.list_range(
        asset_id=asset_id,
        time_from=effective_from,
        time_to=effective_to,
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


@router.get("/asset-summaries", response_model=list[AssetPredictionSummaryResponse])
async def list_asset_prediction_summaries(
    session: AsyncSession = Depends(get_db_session),
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """Return latest prediction stats for all assets."""
    repository = PredictionRepository(session)
    rows = await repository.get_asset_summaries()

    out = []
    for row in rows:
        # Simple confidence score calculation: 1.0 - (width / price)
        # Assuming CI is roughly +/- price * 0.05
        high = float(row["confidence_interval_high"] or 0)
        low = float(row["confidence_interval_low"] or 0)
        val = float(row["predicted_value"] or 1)
        
        confidence = 1.0
        if high > 0 and low > 0:
            width_pct = (high - low) / val
            confidence = max(0.0, min(1.0, 1.0 - (width_pct * 5))) # Scaled for UI

        # Trend signal (placeholder logic: compared to some baseline or just random-ish if only 1 point)
        # Real logic would compare latest forecast vs current price
        signal = "bullish" if val > (val * 0.98) else "bearish" # Just a placeholder

        out.append(
            AssetPredictionSummaryResponse(
                asset_id=row["asset_id"],
                symbol=row["symbol"],
                name=row["name"],
                latest_prediction=val,
                confidence_score=confidence,
                trend_signal=signal,
                volatility=0.02, # Placeholder
            )
        )
    return out


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
