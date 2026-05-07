"""HTTP surface for launching pooled training jobs."""

from __future__ import annotations

import asyncio
from typing import Any, cast
from uuid import UUID

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, Field

from app.core.config import settings
from app.dependencies.ml_service_guard import dependency_ml_service_secret_optional_header
from app.services.parallel_training_runner import run_parallel_asset_training_blocking
from app.services.trainer_hyperparameter_schema import build_trainer_hyperparameter_schema_envelope_exclusive

router = APIRouter()


class ParallelTrainRequestBody(BaseModel):
    """Optional filters for which assets enter the training pool."""

    asset_ids: list[UUID] | None = Field(
        default=None,
        description="When omitted, every active asset id from Postgres is scheduled.",
    )
    activate_models: bool = Field(default=True, description="Forwarded to ml_models.is_active at registration.")
    version_tag_prefix_override: str | None = Field(
        default=None,
        max_length=40,
        description="Optional replacement for TRAIN_VERSION_TAG_PREFIX before timestamp suffixing.",
    )
    forecast_horizon_days_override: int | None = Field(
        default=None,
        ge=1,
        le=366,
        description="Overrides TRAIN_FORECAST_HORIZON_DAYS when set (daily steps after the anchored bar).",
    )
    model_type: str | None = Field(
        default=None,
        description=(
            "Model architecture slug. Overrides TRAIN_DEFAULT_MODEL_TYPE when set. "
            "Valid values: hgb_ocm, ridge_ocm, rf_ocm, et_ocm, lgbm_ocm, lstm_ocm."
        ),
    )
    holdout_eval_start_date_override: str | None = Field(
        default=None,
        description="Overrides TRAIN_HOLDOUT_EVAL_START_DATE when set (empty string disables retrospective holdout).",
    )
    holdout_eval_months_override: int | None = Field(
        default=None,
        ge=1,
        le=120,
        description="Overrides TRAIN_HOLDOUT_EVAL_MONTHS when set.",
    )
    maximum_training_feature_calendar_day_utc: str | None = Field(
        default=None,
        max_length=10,
        description=(
            "When set as yyyy-mm-dd (UTC calendar), rows after that inclusive training day are dropped "
            "before fitting; compounded forecasts anchor on the last retained row even if later data "
            "exists in the warehouse."
        ),
    ),
    registry_display_name: str | None = Field(
        default=None,
        max_length=120,
        description="Optional human-readable label stored on ml_models.display_name.",
    )
    trainer_hyperparameters: dict[str, Any] | None = Field(
        default=None,
        description=(
            "Optional tuning payload. sklearn slugs accept estimator "
            "`set_params` keys plus `time_series_cv_folds` (2–12). `lstm_ocm` "
            "accepts lookback_window, hidden_size, num_layers, dropout, learning_rate, "
            "max_epochs, patience."
        ),
    )
    persist_retrospective_holdout_predictions: bool | None = Field(
        default=None,
        description=(
            "When false, one-step holdout evaluation rows are not written; only the forward "
            "multi-day horizon is persisted. When omitted, workers default to true (full merge)."
        ),
    )


def _merge_optional_admin_material_from_headers(
    primary_admin_header_piece: str | None,
    secondary_admin_header_piece: str | None,
) -> str | None:
    """
    Prefer ``X-Admin-Key`` (matches backend admin routes), then informal ``ADMIN_API_KEY``.

    Returned value is forwarded to subprocess workers unchanged so httpx attaches ``X-Admin-Key``
    identical to backend ``require_admin_api_key``.
    """

    trimmed_primary_piece = primary_admin_header_piece.strip() if primary_admin_header_piece else ""
    trimmed_secondary_piece = secondary_admin_header_piece.strip() if secondary_admin_header_piece else ""

    if trimmed_primary_piece:
        return trimmed_primary_piece

    if trimmed_secondary_piece:
        return trimmed_secondary_piece

    return None


@router.get(
    "/trainer-hyperparameter-schema",
    dependencies=[Depends(dependency_ml_service_secret_optional_header)],
)
async def read_trainer_hyperparameter_schema_catalog_envelope() -> dict[str, Any]:
    """Return labelled fields, bounds, and defaults for browser training forms."""

    return build_trainer_hyperparameter_schema_envelope_exclusive(settings)


@router.post(
    "/parallel-assets",
    response_model=dict,
    dependencies=[Depends(dependency_ml_service_secret_optional_header)],
)
async def enqueue_parallel_asset_training_jobs(
    request_body: ParallelTrainRequestBody,
    x_admin_key: str | None = Header(default=None, alias="X-Admin-Key"),
    admin_api_key_loose_alias: str | None = Header(default=None, alias="ADMIN_API_KEY"),
) -> dict:
    """Kick off multiprocess HistGradientBoosting fits for many assets concurrently."""

    admin_secret_resolution = _merge_optional_admin_material_from_headers(x_admin_key, admin_api_key_loose_alias)

    def blocking_wrapper() -> dict:
        if request_body.asset_ids is None:
            resolved_body_asset_ids = None
        else:
            resolved_body_asset_ids = cast(list[UUID], list(request_body.asset_ids))
        return run_parallel_asset_training_blocking(
            resolved_settings=settings,
            asset_identifiers_requested=resolved_body_asset_ids,
            activate_model=request_body.activate_models,
            override_version_prefix=request_body.version_tag_prefix_override,
            override_horizon_days=request_body.forecast_horizon_days_override,
            override_model_type=request_body.model_type,
            admin_api_secret_literal_override=admin_secret_resolution,
            holdout_eval_start_date_override=request_body.holdout_eval_start_date_override,
            holdout_eval_months_override=request_body.holdout_eval_months_override,
            maximum_training_feature_calendar_day_utc_override=request_body.maximum_training_feature_calendar_day_utc,
            registry_display_name_override=request_body.registry_display_name,
            trainer_hyperparameters_exclusive=request_body.trainer_hyperparameters,
            persist_retrospective_holdout_predictions_exclusive=request_body.persist_retrospective_holdout_predictions,
        )

    return await asyncio.to_thread(blocking_wrapper)


@router.post(
    "/train",
    dependencies=[Depends(dependency_ml_service_secret_optional_header)],
)
async def legacy_train_parallel_alias(
    request_body: ParallelTrainRequestBody,
    x_admin_key: str | None = Header(default=None, alias="X-Admin-Key"),
    admin_api_key_loose_alias: str | None = Header(default=None, alias="ADMIN_API_KEY"),
) -> dict:
    """Maintain compatibility with older clients targeting /training/train."""

    if request_body.asset_ids is None:
        resolved_body_asset_ids = None
    else:
        resolved_body_asset_ids = cast(list[UUID], list(request_body.asset_ids))

    admin_secret_resolution = _merge_optional_admin_material_from_headers(x_admin_key, admin_api_key_loose_alias)

    def blocking_runner() -> dict:
        return run_parallel_asset_training_blocking(
            resolved_settings=settings,
            asset_identifiers_requested=resolved_body_asset_ids,
            activate_model=request_body.activate_models,
            override_version_prefix=request_body.version_tag_prefix_override,
            override_horizon_days=request_body.forecast_horizon_days_override,
            override_model_type=request_body.model_type,
            admin_api_secret_literal_override=admin_secret_resolution,
            holdout_eval_start_date_override=request_body.holdout_eval_start_date_override,
            holdout_eval_months_override=request_body.holdout_eval_months_override,
            maximum_training_feature_calendar_day_utc_override=request_body.maximum_training_feature_calendar_day_utc,
            registry_display_name_override=request_body.registry_display_name,
            trainer_hyperparameters_exclusive=request_body.trainer_hyperparameters,
            persist_retrospective_holdout_predictions_exclusive=request_body.persist_retrospective_holdout_predictions,
        )

    return await asyncio.to_thread(blocking_runner)


@router.get(
    "/status/{model_placeholder}",
    dependencies=[Depends(dependency_ml_service_secret_optional_header)],
)
async def obsolete_status_route(model_placeholder: str) -> dict:
    """Legacy stub retained so older automation keeps receiving deterministic JSON."""

    return {
        "model_id": model_placeholder,
        "status": "delegated_parallel_pool",
        "progress": None,
        "hint": "Training is synchronous per batch; inspect per_asset_results on POST responses.",
    }
