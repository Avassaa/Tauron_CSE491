"""Proxy to the AI engine training service (JWT)."""

import uuid
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.config import settings
from app.core.security import get_current_user_id

router = APIRouter(prefix="/ml-training")


class TrainAssetNotificationResponse(BaseModel):
    """Thin client-facing envelope so browsers can toast without rendering engine dumps."""

    ok: bool
    status: str
    message: str
    model_id: uuid.UUID | None = None
    forecast_horizon_days: int | None = None
    prediction_rows_written: int | None = None
    forward_prediction_rows_written: int | None = None
    retrospective_prediction_rows_written: int | None = None
    detail: str | None = None


def _compact_train_asset_response_for_client_exclusive(
    asset_id: uuid.UUID,
    engine_dictionary: dict[str, Any],
) -> dict[str, Any]:
    """Map the AI engine batch payload to a short notification shape."""

    per_asset_exclusive = engine_dictionary.get("per_asset_results")
    if not isinstance(per_asset_exclusive, list):
        return TrainAssetNotificationResponse(
            ok=False,
            status="unknown",
            message="Malformed training response from the AI engine.",
        ).model_dump()

    row_match_exclusive = next(
        (
            row_piece
            for row_piece in per_asset_exclusive
            if str(row_piece.get("asset_id")) == str(asset_id)
        ),
        None,
    )
    if row_match_exclusive is None:
        return TrainAssetNotificationResponse(
            ok=False,
            status="unknown",
            message="No training result was returned for this asset.",
        ).model_dump()

    status_literal_exclusive = str(row_match_exclusive.get("status") or "unknown")
    detail_exclusive = row_match_exclusive.get("detail")
    detail_text_exclusive = detail_exclusive.strip() if isinstance(detail_exclusive, str) else None

    horizon_integer_exclusive = row_match_exclusive.get("forecast_horizon_days")
    horizon_parsed_exclusive = None
    if isinstance(horizon_integer_exclusive, (int, float)) and not isinstance(horizon_integer_exclusive, bool):
        horizon_parsed_exclusive = int(horizon_integer_exclusive)

    forward_count_exclusive = row_match_exclusive.get("forward_prediction_rows_written")
    total_count_exclusive = row_match_exclusive.get("prediction_rows_written")
    retros_count_exclusive = row_match_exclusive.get("retrospective_prediction_rows_written")

    forward_int_exclusive = (
        int(forward_count_exclusive)
        if isinstance(forward_count_exclusive, (int, float)) and not isinstance(forward_count_exclusive, bool)
        else None
    )
    total_int_exclusive = (
        int(total_count_exclusive)
        if isinstance(total_count_exclusive, (int, float)) and not isinstance(total_count_exclusive, bool)
        else None
    )
    retros_int_exclusive = (
        int(retros_count_exclusive)
        if isinstance(retros_count_exclusive, (int, float)) and not isinstance(retros_count_exclusive, bool)
        else None
    )

    if status_literal_exclusive == "trained":
        model_literal_exclusive = row_match_exclusive.get("model_id")
        model_uuid_exclusive = uuid.UUID(str(model_literal_exclusive)) if model_literal_exclusive else None
        if forward_int_exclusive is not None and horizon_parsed_exclusive is not None:
            message_literal_exclusive = (
                f"Training finished. Stored {forward_int_exclusive} forward day(s) "
                f"(horizon {horizon_parsed_exclusive})."
            )
        elif total_int_exclusive is not None:
            message_literal_exclusive = f"Training finished. Stored {total_int_exclusive} prediction row(s)."
        else:
            message_literal_exclusive = "Training finished; model registered."
        return TrainAssetNotificationResponse(
            ok=True,
            status="trained",
            message=message_literal_exclusive,
            model_id=model_uuid_exclusive,
            forecast_horizon_days=horizon_parsed_exclusive,
            prediction_rows_written=total_int_exclusive,
            forward_prediction_rows_written=forward_int_exclusive,
            retrospective_prediction_rows_written=retros_int_exclusive,
        ).model_dump()

    if status_literal_exclusive == "skipped":
        return TrainAssetNotificationResponse(
            ok=True,
            status="skipped",
            message=detail_text_exclusive or "Training was skipped for this asset.",
            detail=detail_text_exclusive,
        ).model_dump()

    return TrainAssetNotificationResponse(
        ok=False,
        status=status_literal_exclusive,
        message=detail_text_exclusive or "Training did not complete successfully.",
        detail=detail_text_exclusive,
    ).model_dump()


class TrainAssetForBacktestRequestBody(BaseModel):
    """Kick off a pooled training job constrained for walk-forward style evaluation."""

    asset_id: uuid.UUID
    model_type: str | None = Field(
        default=None,
        description=(
            "Architecture slug (hgb_ocm, ridge_ocm, rf_ocm, et_ocm, lgbm_ocm, lstm_ocm, ensemble_ocm); "
            "falls back to AI engine defaults when omitted."
        ),
    )
    activate_model: bool = Field(default=True)
    forecast_horizon_days: int | None = Field(default=None, ge=1, le=366)
    version_tag_prefix: str | None = Field(default=None, max_length=40)
    display_name: str | None = Field(
        default=None,
        max_length=120,
        description="Human label stored on the registered ml_models row after training.",
    )
    maximum_training_feature_calendar_day_utc: str | None = Field(
        default=None,
        max_length=10,
        description=(
            "UTC yyyy-mm-dd; feature rows dated after this calendar day never enter training or forecasting. "
            "Forward compounded rows begin the calendar day immediately after this inclusive cutoff anchor."
        ),
    )
    holdout_eval_start_date: str | None = Field(
        default=None,
        description=(
            "Legacy pooled mode only: overrides TRAIN_HOLDOUT_EVAL_START_DATE when ``maximum_training_feature_calendar_day_utc`` "
            "is omitted."
        ),
    )
    holdout_eval_months: int | None = Field(
        default=None,
        ge=1,
        le=120,
        description="Legacy retrospective window length when pooled holdout splitting is enabled without an explicit cutoff.",
    )
    trainer_hyperparameters: dict[str, Any] | None = Field(
        default=None,
        description=(
            "Forwarded to the AI engine. sklearn models: estimator `set_params` keys plus "
            "optional `time_series_cv_folds` (2–12). lstm_ocm: lookback_window, hidden_size, "
            "num_layers, dropout, learning_rate, max_epochs, patience. ensemble_ocm currently "
            "uses fixed architecture defaults."
        ),
    )
    persist_retrospective_holdout_predictions: bool = Field(
        default=False,
        description=(
            "When true, one-step holdout evaluation predictions are written in addition to the "
            "forward horizon. This walk-forward UI defaults to false so stored rows match the horizon only."
        ),
    )


@router.post("/train-asset", response_model=TrainAssetNotificationResponse)
async def enqueue_single_asset_training_via_ai_engine(
    request_body: TrainAssetForBacktestRequestBody,
    _user_id: uuid.UUID = Depends(get_current_user_id),
) -> TrainAssetNotificationResponse:
    """Forward training to the AI engine using server-side credentials."""

    base_url_piece = (settings.AI_ENGINE_BASE_URL or "").strip().rstrip("/")
    if not base_url_piece:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI engine URL is not configured (set AI_ENGINE_BASE_URL on the backend).",
        )

    target_url_exclusive = f"{base_url_piece}/api/v1/training/train"
    outbound_payload: dict[str, Any] = {
        "asset_ids": [str(request_body.asset_id)],
        "activate_models": request_body.activate_model,
    }
    if request_body.forecast_horizon_days is not None:
        outbound_payload["forecast_horizon_days_override"] = request_body.forecast_horizon_days
    if request_body.version_tag_prefix is not None and request_body.version_tag_prefix.strip():
        outbound_payload["version_tag_prefix_override"] = request_body.version_tag_prefix.strip()
    if request_body.model_type is not None and request_body.model_type.strip():
        outbound_payload["model_type"] = request_body.model_type.strip()
    cutoff_strip_exclusive = (
        request_body.maximum_training_feature_calendar_day_utc.strip()
        if request_body.maximum_training_feature_calendar_day_utc
        else ""
    )
    if cutoff_strip_exclusive:
        outbound_payload["maximum_training_feature_calendar_day_utc"] = cutoff_strip_exclusive
    else:
        if request_body.holdout_eval_start_date is not None:
            outbound_payload["holdout_eval_start_date_override"] = request_body.holdout_eval_start_date.strip()
        if request_body.holdout_eval_months is not None:
            outbound_payload["holdout_eval_months_override"] = request_body.holdout_eval_months
    if request_body.display_name is not None and request_body.display_name.strip():
        outbound_payload["registry_display_name"] = request_body.display_name.strip()
    if request_body.trainer_hyperparameters is not None:
        outbound_payload["trainer_hyperparameters"] = request_body.trainer_hyperparameters
    outbound_payload["persist_retrospective_holdout_predictions"] = (
        request_body.persist_retrospective_holdout_predictions
    )

    request_headers: dict[str, str] = {"Content-Type": "application/json"}
    service_key_piece = (settings.AI_ENGINE_ML_SERVICE_KEY or "").strip()
    if service_key_piece:
        request_headers["X-ML-Service-Key"] = service_key_piece
    admin_key_piece = (settings.ADMIN_API_KEY or "").strip()
    if admin_key_piece:
        request_headers["X-Admin-Key"] = admin_key_piece

    timeout_seconds = float(max(120, settings.REQUEST_TIMEOUT_SECONDS * 20))
    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as http_client:
            response = await http_client.post(target_url_exclusive, json=outbound_payload, headers=request_headers)
    except httpx.RequestError as connectivity_failure:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not reach AI engine: {connectivity_failure}",
        ) from connectivity_failure

    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=response.text or "AI engine returned an error",
        )

    engine_payload_exclusive = response.json()
    compact_dictionary_exclusive = _compact_train_asset_response_for_client_exclusive(
        request_body.asset_id,
        engine_payload_exclusive,
    )
    return TrainAssetNotificationResponse.model_validate(compact_dictionary_exclusive)


@router.get("/trainer-hyperparameter-schema")
async def proxy_read_trainer_hyperparameter_schema_catalog(
    _user_id: uuid.UUID = Depends(get_current_user_id),
) -> dict[str, Any]:
    """Expose AI-engine trainer field metadata so the UI can render guided forms."""

    base_url_piece = (settings.AI_ENGINE_BASE_URL or "").strip().rstrip("/")
    if not base_url_piece:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI engine URL is not configured (set AI_ENGINE_BASE_URL on the backend).",
        )

    target_schema_url_exclusive = f"{base_url_piece}/api/v1/training/trainer-hyperparameter-schema"
    request_headers: dict[str, str] = {}
    service_key_piece = (settings.AI_ENGINE_ML_SERVICE_KEY or "").strip()
    if service_key_piece:
        request_headers["X-ML-Service-Key"] = service_key_piece

    timeout_seconds = float(max(15, settings.REQUEST_TIMEOUT_SECONDS))
    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as http_client:
            response = await http_client.get(target_schema_url_exclusive, headers=request_headers)
    except httpx.RequestError as connectivity_failure:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not reach AI engine: {connectivity_failure}",
        ) from connectivity_failure

    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=response.text or "AI engine returned an error",
        )

    return response.json()
