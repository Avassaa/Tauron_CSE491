"""HTTP inference using persisted artifacts."""

from __future__ import annotations

import asyncio
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.config import settings
from app.dependencies.ml_service_guard import dependency_ml_service_secret_optional_header
from app.services.inference_service import predict_for_registered_model_blocking

router = APIRouter()


class InferenceRequestBody(BaseModel):
    """Minimal payload tying predictions to canonical registry identifiers."""

    model_id: UUID = Field(description="Primary key mirrored from Postgres ml_models")


class InferenceResponseBody(BaseModel):
    """Next-day close forecast built from on-chain features plus latest daily close."""

    model_id: str
    asset_id: str
    latest_feature_calendar_day_label: str
    reference_market_close_on_feature_day: float
    predicted_log_forward_return_one_day: float
    predicted_next_close_mid: float
    predicted_next_close_high_ci: float
    predicted_next_close_low_ci: float
    prediction_confidence_proxy: float
    reference_interval_log_forward_return_band: float


@router.post(
    "/predict",
    response_model=InferenceResponseBody,
    dependencies=[Depends(dependency_ml_service_secret_optional_header)],
)
async def predict_with_registered_bundle(request_body: InferenceRequestBody) -> InferenceResponseBody:
    """Forecast the next daily ``market_data`` close using on-chain metric panels."""

    def blocking_predictor() -> dict:
        return predict_for_registered_model_blocking(
            database_url_sync=settings.sync_database_url,
            schema_fragment=settings.validated_schema_name,
            ssl_toggle=settings.POSTGRES_SSL,
            model_uuid=request_body.model_id,
        )

    try:
        raw_payload = await asyncio.to_thread(blocking_predictor)
    except ValueError as validation_issue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(validation_issue),
        ) from validation_issue
    except FileNotFoundError as missing_artifact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artifact missing on disk: {missing_artifact}",
        ) from missing_artifact

    return InferenceResponseBody.model_validate(raw_payload)
