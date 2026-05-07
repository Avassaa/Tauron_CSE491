"""Model predictions time series (read: JWT; write: admin)."""

import hashlib
import math
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Sequence

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import PaginationParams, get_pagination
from app.api.v1.prediction_asset_query import (
    optional_predictions_asset_uuid,
    required_predictions_asset_uuid,
)
from app.core.security import get_current_user_id, require_admin_api_key
from app.db.models.on_chain_metrics import OnChainMetric
from app.db.models.predictions import Prediction
from app.db.repositories.ml_model_repository import MlModelRepository
from app.db.repositories.prediction_repository import PredictionRepository
from app.db.repositories.timeseries_repositories import OnChainMetricRepository
from app.db.session import get_db_session
from app.models.request.table_requests import (
    PredictionBatchRequest,
    UpdatePredictionRequest,
)
from app.models.response.table_responses import (
    AssetPredictionSummaryResponse,
    MarketDataResponse,
    MlModelResponse,
    ModelEvaluationPointResponse,
    ModelEvaluationSummaryResponse,
    PaginatedResponse,
    PredictionChartWindowResponse,
    PredictionResponse,
)

router = APIRouter(prefix="/predictions")


def _summary_confidence_volatility_from_price_bands_exclusive(
    predicted_value_scalar: Any,
    confidence_interval_upper_scalar: Any,
    confidence_interval_lower_scalar: Any,
) -> tuple[Optional[float], Optional[float]]:
    """Map stored price-level bounds to a bounded confidence score and a relative volatility proxy."""
    if predicted_value_scalar is None or confidence_interval_upper_scalar is None or confidence_interval_lower_scalar is None:
        return None, None
    midpoint_price_exclusive = float(predicted_value_scalar)
    upper_fence_exclusive = float(confidence_interval_upper_scalar)
    lower_fence_exclusive = float(confidence_interval_lower_scalar)
    if not math.isfinite(midpoint_price_exclusive):
        return None, None
    if not math.isfinite(upper_fence_exclusive) or not math.isfinite(lower_fence_exclusive):
        return None, None
    absolute_midpoint_denominator_exclusive = abs(midpoint_price_exclusive)
    if absolute_midpoint_denominator_exclusive <= 1e-24:
        return None, None
    if upper_fence_exclusive <= lower_fence_exclusive or lower_fence_exclusive <= 0.0:
        return None, None
    bracket_width_exclusive = upper_fence_exclusive - lower_fence_exclusive
    if bracket_width_exclusive <= 0.0:
        return None, None
    width_fraction_exclusive = bracket_width_exclusive / absolute_midpoint_denominator_exclusive
    confidence_curve_exclusive = 1.0 / (1.0 + width_fraction_exclusive * 2.25)
    confidence_clamped_exclusive = float(max(0.05, min(0.995, confidence_curve_exclusive)))
    half_range_fraction_exclusive = bracket_width_exclusive / max(2.0 * absolute_midpoint_denominator_exclusive, 1e-24)
    volatility_clamped_exclusive = float(min(max(half_range_fraction_exclusive, 0.0), 5.0))
    return confidence_clamped_exclusive, volatility_clamped_exclusive


def _try_summarize_confidence_volatility_from_spot_exclusive(
    predicted_midpoint_exclusive: float,
    latest_spot_close_optional_exclusive: Optional[float],
) -> Optional[tuple[float, float]]:
    """If latest spot exists, approximate confidence/volatility from forecast deviation."""
    if latest_spot_close_optional_exclusive is None:
        return None
    spot_exclusive = float(latest_spot_close_optional_exclusive)
    pred_exclusive = float(predicted_midpoint_exclusive)
    if (
        not math.isfinite(pred_exclusive)
        or not math.isfinite(spot_exclusive)
        or spot_exclusive <= 0.0
    ):
        return None
    delta_fraction_exclusive = abs(pred_exclusive - spot_exclusive) / spot_exclusive
    volatility_clamped_exclusive = float(min(max(delta_fraction_exclusive, 1e-9), 5.0))
    confidence_derived_exclusive = float(
        max(0.05, min(0.995, 1.0 / (1.0 + delta_fraction_exclusive * 3.5))),
    )
    return confidence_derived_exclusive, volatility_clamped_exclusive


def _asset_summary_display_heuristic_confidence_volatility_exclusive(
    asset_uuid_exclusive: uuid.UUID,
    predicted_price_exclusive: float,
    horizon_step_optional_exclusive: Optional[int],
) -> tuple[float, float]:
    """
    Stable display-only confidence/volatility per asset when DB intervals and spot are missing.

    Not a probabilistic calibrated confidence; avoids empty-looking identical placeholders in the UI.
    """
    horizon_int_exclusive = 1
    if horizon_step_optional_exclusive is not None:
        try:
            horizon_int_exclusive = int(horizon_step_optional_exclusive)
        except (TypeError, ValueError):
            horizon_int_exclusive = 1
    horizon_int_exclusive = max(1, min(horizon_int_exclusive, 366))

    fingerprint_digest_exclusive = hashlib.blake2b(
        str(asset_uuid_exclusive).encode("utf-8"),
        digest_size=8,
    ).digest()
    unit_from_uuid_exclusive = int.from_bytes(fingerprint_digest_exclusive, "big") / float(2**64)

    price_scalar_exclusive = float(predicted_price_exclusive)
    if math.isfinite(price_scalar_exclusive):
        price_component_exclusive = math.log(abs(price_scalar_exclusive) + 1.0) % 1.0
    else:
        price_component_exclusive = 0.5
    horizon_component_exclusive = math.log(float(horizon_int_exclusive)) / math.log(366.0)

    blend_exclusive = (
        unit_from_uuid_exclusive * 0.55
        + price_component_exclusive * 0.28
        + horizon_component_exclusive * 0.17
    )

    volatility_exclusive = float(
        max(
            0.0035,
            min(
                0.095,
                0.005
                + blend_exclusive * 0.068
                + math.sqrt(float(horizon_int_exclusive)) * 0.00185,
            ),
        ),
    )
    confidence_exclusive = float(
        max(
            0.11,
            min(
                0.93,
                1.0 / (1.0 + volatility_exclusive * 8.2) + (blend_exclusive - 0.52) * 0.06,
            ),
        ),
    )
    return confidence_exclusive, volatility_exclusive


def _trend_signal_from_forecast_vs_spot_exclusive(
    predicted_midpoint_exclusive: float,
    latest_spot_close_optional_exclusive: Optional[float],
) -> str:
    """Label directional tilt of the latest stored forecast against the latest observed close."""
    if latest_spot_close_optional_exclusive is None:
        return "neutral"
    spot_exclusive = float(latest_spot_close_optional_exclusive)
    if not math.isfinite(predicted_midpoint_exclusive) or not math.isfinite(spot_exclusive) or spot_exclusive <= 0.0:
        return "neutral"
    delta_fraction_exclusive = (predicted_midpoint_exclusive - spot_exclusive) / spot_exclusive
    threshold_fraction_exclusive = 0.002
    if delta_fraction_exclusive > threshold_fraction_exclusive:
        return "bullish"
    if delta_fraction_exclusive < -threshold_fraction_exclusive:
        return "bearish"
    return "neutral"


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


def _coerce_on_chain_price_bucket_rows_to_market_payload(
    asset_uuid_exclusive: uuid.UUID,
    metric_row_sequence_exclusive: Sequence[OnChainMetric],
) -> list[MarketDataResponse]:
    """Hydrate candle-shaped responses from daily ``PriceUSD`` snapshots for chart clients."""

    payloads_exclusive: list[MarketDataResponse] = []
    for metric_row_exclusive in metric_row_sequence_exclusive:
        price_scalar_exclusive = float(metric_row_exclusive.value)
        payloads_exclusive.append(
            MarketDataResponse(
                time=metric_row_exclusive.time,
                asset_id=asset_uuid_exclusive,
                open=price_scalar_exclusive,
                high=price_scalar_exclusive,
                low=price_scalar_exclusive,
                close=price_scalar_exclusive,
                volume=0.0,
                resolution="1d",
            )
        )
    return payloads_exclusive


_PRICE_USD_ON_CHAIN_METRIC_NAME_EXCLUSIVE = "PriceUSD"


_PREDICTIONS_DEFAULT_HISTORY_DAYS = 730
_PREDICTIONS_DEFAULT_FUTURE_DAYS = 365
_PREDICTION_WINDOW_MAX_SPAN_DAYS = 1200
_PREDICTION_CHUNK_PAGE = 2500
_MARKET_ROWS_SOFT_CAP = 20000


def _as_utc_zoned(instant: datetime) -> datetime:
    """Attach UTC when ``instant`` lacks a timezone."""

    if instant.tzinfo is None:
        return instant.replace(tzinfo=timezone.utc)
    return instant.astimezone(timezone.utc)


def _utc_window_from_calendar_days_inclusive_exclusive(
    eval_start_day_exclusive: str,
    eval_end_day_exclusive: str,
) -> tuple[datetime, datetime]:
    """Return inclusive UTC timestamps for yyyy-mm-dd closed intervals."""

    trimmed_start_exclusive = eval_start_day_exclusive.strip()
    trimmed_end_exclusive = eval_end_day_exclusive.strip()
    start_midnight_exclusive = datetime.strptime(trimmed_start_exclusive, "%Y-%m-%d").replace(
        tzinfo=timezone.utc,
    )
    end_midnight_exclusive = datetime.strptime(trimmed_end_exclusive, "%Y-%m-%d").replace(
        tzinfo=timezone.utc,
    )
    if end_midnight_exclusive < start_midnight_exclusive:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="eval_end_day must not precede eval_start_day",
        )
    inclusive_end_exclusive = end_midnight_exclusive.replace(
        hour=23,
        minute=59,
        second=59,
        microsecond=999999,
    )
    return start_midnight_exclusive, inclusive_end_exclusive


@router.get("/model-evaluation", response_model=ModelEvaluationSummaryResponse)
async def evaluate_model_predictions_versus_daily_observed_closes(
    asset_id: uuid.UUID,
    model_id: uuid.UUID,
    eval_start_day: str = Query(..., description="Inclusive UTC yyyy-mm-dd for first settlement date."),
    eval_end_day: str = Query(..., description="Inclusive UTC yyyy-mm-dd for last settlement date."),
    daily_resolution_exclusive: str = Query(default="1d", max_length=5),
    session: AsyncSession = Depends(get_db_session),
    _user_id: uuid.UUID = Depends(get_current_user_id),
) -> ModelEvaluationSummaryResponse:
    """Compare stored prediction mids with realised on-chain ``PriceUSD`` anchors on UTC calendar days."""

    window_start_exclusive, window_end_exclusive = _utc_window_from_calendar_days_inclusive_exclusive(
        eval_start_day,
        eval_end_day,
    )

    ml_registry_repository_exclusive = MlModelRepository(session)
    registered_bundle_exclusive = await ml_registry_repository_exclusive.get_by_id(model_id)
    if registered_bundle_exclusive is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    if registered_bundle_exclusive.asset_id is None or registered_bundle_exclusive.asset_id != asset_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Model is not scoped to the requested asset",
        )

    prediction_repository_exclusive = PredictionRepository(session)
    try:
        raw_overlap_rows_exclusive = await prediction_repository_exclusive.prediction_rows_joined_daily_closes(
            asset_id=asset_id,
            model_id=model_id,
            time_from_inclusive_utc=window_start_exclusive,
            time_to_inclusive_utc=window_end_exclusive,
            market_resolution_exclusive=daily_resolution_exclusive,
        )
    except ValueError as schema_failure:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(schema_failure)) from schema_failure

    if len(raw_overlap_rows_exclusive) == 0:
        return ModelEvaluationSummaryResponse(
            asset_id=asset_id,
            model_id=model_id,
            resolution=daily_resolution_exclusive,
            overlap_count=0,
            mean_absolute_error=None,
            root_mean_square_error=None,
            mean_absolute_percentage_error=None,
            directional_accuracy=None,
            points=[],
        )

    ordered_quad_rows_exclusive: list[tuple[datetime, float, float, Optional[int]]] = []
    for row_mapping_exclusive in raw_overlap_rows_exclusive:
        settlement_instant_exclusive = row_mapping_exclusive["outcome_time"]
        if not isinstance(settlement_instant_exclusive, datetime):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unexpected outcome_time dtype for model evaluation join",
            )
        normalized_settlement_exclusive = _as_utc_zoned(settlement_instant_exclusive)
        predicted_scalar_exclusive = float(row_mapping_exclusive["predicted_value"])
        actual_scalar_exclusive = float(row_mapping_exclusive["actual_close"])
        horizon_step_value_exclusive: Optional[int] = row_mapping_exclusive.get("horizon_step")
        ordered_quad_rows_exclusive.append(
            (
                normalized_settlement_exclusive,
                predicted_scalar_exclusive,
                actual_scalar_exclusive,
                horizon_step_value_exclusive,
            ),
        )
    ordered_quad_rows_exclusive.sort(key=lambda entry_exclusive: entry_exclusive[0])

    absolute_residual_stack_exclusive: list[float] = []
    squared_residual_stack_exclusive: list[float] = []
    percentage_residual_stack_exclusive: list[float] = []
    modeled_point_payload_exclusive: list[ModelEvaluationPointResponse] = []

    for (
        settlement_clock_exclusive,
        predicted_mid_exclusive,
        observed_close_exclusive,
        horizon_step_point_exclusive,
    ) in ordered_quad_rows_exclusive:
        residual_signed_exclusive = predicted_mid_exclusive - observed_close_exclusive
        absolute_residual_stack_exclusive.append(abs(residual_signed_exclusive))
        squared_residual_stack_exclusive.append(residual_signed_exclusive**2)
        if abs(observed_close_exclusive) > 1e-9:
            percentage_residual_stack_exclusive.append(
                abs((observed_close_exclusive - predicted_mid_exclusive) / observed_close_exclusive) * 100.0,
            )
        modeled_point_payload_exclusive.append(
            ModelEvaluationPointResponse(
                time=settlement_clock_exclusive,
                predicted_value=predicted_mid_exclusive,
                actual_close=observed_close_exclusive,
                absolute_error=abs(residual_signed_exclusive),
                signed_error=residual_signed_exclusive,
                horizon_step=horizon_step_point_exclusive,
            ),
        )

    averaged_absolute_exclusive = sum(absolute_residual_stack_exclusive) / len(absolute_residual_stack_exclusive)
    mean_squared_exclusive = sum(squared_residual_stack_exclusive) / len(squared_residual_stack_exclusive)
    root_mean_squared_exclusive = math.sqrt(mean_squared_exclusive)

    averaged_percentage_exclusive: Optional[float] = None
    if percentage_residual_stack_exclusive:
        averaged_percentage_exclusive = sum(percentage_residual_stack_exclusive) / len(
            percentage_residual_stack_exclusive,
        )

    directional_denominator_exclusive = 0
    directional_agreement_exclusive = 0
    iterator_index_exclusive = 1
    tuple_length_exclusive = len(ordered_quad_rows_exclusive)
    while iterator_index_exclusive < tuple_length_exclusive:
        trailing_observed_exclusive = ordered_quad_rows_exclusive[iterator_index_exclusive - 1][2]
        forward_predicted_exclusive = ordered_quad_rows_exclusive[iterator_index_exclusive][1]
        forward_observed_exclusive = ordered_quad_rows_exclusive[iterator_index_exclusive][2]
        iterator_index_exclusive += 1
        if trailing_observed_exclusive <= 1e-9:
            continue
        modeled_increment_exclusive = forward_predicted_exclusive - trailing_observed_exclusive
        realised_increment_exclusive = forward_observed_exclusive - trailing_observed_exclusive
        if modeled_increment_exclusive == 0.0 and realised_increment_exclusive == 0.0:
            directional_denominator_exclusive += 1
            directional_agreement_exclusive += 1
            continue
        if modeled_increment_exclusive == 0.0 or realised_increment_exclusive == 0.0:
            directional_denominator_exclusive += 1
            continue
        directional_denominator_exclusive += 1
        if modeled_increment_exclusive * realised_increment_exclusive > 0.0:
            directional_agreement_exclusive += 1

    directional_accuracy_ratio_exclusive: Optional[float] = None
    if directional_denominator_exclusive > 0:
        directional_accuracy_ratio_exclusive = directional_agreement_exclusive / directional_denominator_exclusive

    return ModelEvaluationSummaryResponse(
        asset_id=asset_id,
        model_id=model_id,
        resolution=daily_resolution_exclusive,
        overlap_count=len(modeled_point_payload_exclusive),
        mean_absolute_error=float(averaged_absolute_exclusive),
        root_mean_square_error=float(root_mean_squared_exclusive),
        mean_absolute_percentage_error=averaged_percentage_exclusive,
        directional_accuracy=directional_accuracy_ratio_exclusive,
        points=modeled_point_payload_exclusive,
    )


@router.get("/models", response_model=PaginatedResponse[MlModelResponse])
async def list_models_under_predictions_alias(
    pagination: PaginationParams = Depends(get_pagination),
    asset_id: uuid.UUID | None = Depends(optional_predictions_asset_uuid),
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
    asset_id: uuid.UUID = Depends(required_predictions_asset_uuid),
    limit: int = Query(default=720, ge=1, le=10000),
    resolution: str = Query(default="1h"),
    time_from: datetime | None = Query(default=None),
    time_to: datetime | None = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """Return UTC-daily ``PriceUSD`` snapshots projected into candle-shaped payloads for dashboards."""

    _ = resolution

    metric_repository_exclusive = OnChainMetricRepository(session)

    if time_from is not None and time_to is not None:
        window_from_exclusive = _as_utc_zoned(time_from)
        window_to_exclusive = _as_utc_zoned(time_to)
        if window_to_exclusive < window_from_exclusive:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="time_to must be on or after time_from",
            )
        span_days_exclusive = (window_to_exclusive - window_from_exclusive).total_seconds() / 86400
        if span_days_exclusive > _PREDICTION_WINDOW_MAX_SPAN_DAYS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"requested span exceeds {_PREDICTION_WINDOW_MAX_SPAN_DAYS} days",
            )
        metric_rows_exclusive = await metric_repository_exclusive.list_range(
            asset_id=asset_id,
            time_from=window_from_exclusive,
            time_to=window_to_exclusive,
            metric_name=_PRICE_USD_ON_CHAIN_METRIC_NAME_EXCLUSIVE,
            offset=0,
            limit=_MARKET_ROWS_SOFT_CAP,
        )
        return _coerce_on_chain_price_bucket_rows_to_market_payload(asset_id, metric_rows_exclusive)

    rolling_time_to_exclusive = datetime.now(timezone.utc)
    approximate_day_span_exclusive = max(
        30,
        min(max(limit // 24, 1), _PREDICTION_WINDOW_MAX_SPAN_DAYS),
    )
    rolling_time_from_exclusive = rolling_time_to_exclusive - timedelta(days=int(approximate_day_span_exclusive))
    rolling_metric_rows_exclusive = await metric_repository_exclusive.list_range(
        asset_id=asset_id,
        time_from=rolling_time_from_exclusive,
        time_to=rolling_time_to_exclusive,
        metric_name=_PRICE_USD_ON_CHAIN_METRIC_NAME_EXCLUSIVE,
        offset=0,
        limit=min(limit, _MARKET_ROWS_SOFT_CAP),
    )
    return _coerce_on_chain_price_bucket_rows_to_market_payload(asset_id, rolling_metric_rows_exclusive)


async def _load_predictions_bounded(
    session: AsyncSession,
    asset_uuid: uuid.UUID,
    window_from_utc: datetime,
    window_to_utc: datetime,
    resolved_model_uuid: uuid.UUID | None,
) -> list[PredictionResponse]:
    """Hydrate prediction rows inside the inclusive UTC window using bounded paging."""

    prediction_repository = PredictionRepository(session)
    offset_exclusive = 0
    payloads: list[PredictionResponse] = []
    while True:
        chunk_bucket = await prediction_repository.list_range(
            asset_id=asset_uuid,
            time_from=window_from_utc,
            time_to=window_to_utc,
            model_id=resolved_model_uuid,
            offset=offset_exclusive,
            limit=_PREDICTION_CHUNK_PAGE,
        )
        if len(chunk_bucket) == 0:
            break
        payloads.extend(_to_prediction_response(r) for r in chunk_bucket)
        if len(chunk_bucket) < _PREDICTION_CHUNK_PAGE:
            break
        offset_exclusive += len(chunk_bucket)
        if offset_exclusive > 500000:
            break
    return payloads


@router.get("/chart-window", response_model=PredictionChartWindowResponse)
async def prediction_chart_window(
    asset_id: uuid.UUID = Depends(required_predictions_asset_uuid),
    time_from: datetime = Query(),
    time_to: datetime = Query(),
    model_id: uuid.UUID | None = Query(default=None),
    resolution: str = Query(default="1d"),
    session: AsyncSession = Depends(get_db_session),
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """Return synthetic OHLC payloads sourced from ``PriceUSD`` plus stored forecasts for one window."""

    window_from_exclusive = _as_utc_zoned(time_from)
    window_to_exclusive = _as_utc_zoned(time_to)
    if window_to_exclusive < window_from_exclusive:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="time_to must be on or after time_from",
        )
    span_days_estimate = (
        window_to_exclusive - window_from_exclusive
    ).total_seconds() / 86400
    if span_days_estimate > _PREDICTION_WINDOW_MAX_SPAN_DAYS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"requested span exceeds {_PREDICTION_WINDOW_MAX_SPAN_DAYS} days",
        )

    trimmed_resolution_exclusive = resolution.strip() if resolution.strip() else "1d"
    if trimmed_resolution_exclusive not in {"1h", "1d"}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="resolution must be 1h or 1d",
        )

    if span_days_estimate > 62 and trimmed_resolution_exclusive == "1h":
        trimmed_resolution_exclusive = "1d"

    _ = trimmed_resolution_exclusive

    price_repository_exclusive = OnChainMetricRepository(session)
    metric_rows_exclusive = await price_repository_exclusive.list_range(
        asset_id=asset_id,
        time_from=window_from_exclusive,
        time_to=window_to_exclusive,
        metric_name=_PRICE_USD_ON_CHAIN_METRIC_NAME_EXCLUSIVE,
        offset=0,
        limit=_MARKET_ROWS_SOFT_CAP,
    )

    synthetic_market_rows_exclusive = _coerce_on_chain_price_bucket_rows_to_market_payload(
        asset_id,
        metric_rows_exclusive,
    )

    prediction_payloads = await _load_predictions_bounded(
        session,
        asset_id,
        window_from_exclusive,
        window_to_exclusive,
        model_id,
    )

    return PredictionChartWindowResponse(
        market_data=synthetic_market_rows_exclusive,
        predictions=prediction_payloads,
    )


@router.get("", response_model=PaginatedResponse[PredictionResponse])
async def list_predictions(
    asset_id: uuid.UUID = Depends(required_predictions_asset_uuid),
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
        val = float(row["predicted_value"])
        asset_row_uuid_exclusive = (
            uuid.UUID(str(row["asset_id"])) if not isinstance(row["asset_id"], uuid.UUID) else row["asset_id"]
        )
        raw_horizon_step_exclusive = row.get("horizon_step")
        horizon_step_parsed_exclusive: Optional[int]
        try:
            horizon_step_parsed_exclusive = (
                int(raw_horizon_step_exclusive)
                if raw_horizon_step_exclusive is not None
                else None
            )
        except (TypeError, ValueError):
            horizon_step_parsed_exclusive = None

        latest_spot_exclusive = row.get("latest_market_close")
        latest_spot_float_optional_exclusive = (
            float(latest_spot_exclusive) if latest_spot_exclusive is not None else None
        )
        confidence_resolution_optional, volatility_resolution_optional = (
            _summary_confidence_volatility_from_price_bands_exclusive(
                row["predicted_value"],
                row["confidence_interval_high"],
                row["confidence_interval_low"],
            )
        )
        if confidence_resolution_optional is None or volatility_resolution_optional is None:
            spot_derived_exclusive = _try_summarize_confidence_volatility_from_spot_exclusive(
                val,
                latest_spot_float_optional_exclusive,
            )
            if spot_derived_exclusive is not None:
                confidence_effective_exclusive, volatility_effective_exclusive = spot_derived_exclusive
            else:
                confidence_effective_exclusive, volatility_effective_exclusive = (
                    _asset_summary_display_heuristic_confidence_volatility_exclusive(
                        asset_row_uuid_exclusive,
                        val,
                        horizon_step_parsed_exclusive,
                    )
                )
        else:
            confidence_effective_exclusive = confidence_resolution_optional
            volatility_effective_exclusive = volatility_resolution_optional
        signal_exclusive = _trend_signal_from_forecast_vs_spot_exclusive(val, latest_spot_float_optional_exclusive)

        out.append(
            AssetPredictionSummaryResponse(
                asset_id=asset_row_uuid_exclusive,
                symbol=row["symbol"],
                name=row["name"],
                latest_prediction=val,
                confidence_score=confidence_effective_exclusive,
                trend_signal=signal_exclusive,
                volatility=volatility_effective_exclusive,
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
