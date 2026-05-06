"""HTTP surface for launching pooled training jobs."""

from __future__ import annotations

import asyncio
from typing import cast
from uuid import UUID

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, Field

from app.core.config import settings
from app.dependencies.ml_service_guard import dependency_ml_service_secret_optional_header
from app.services.parallel_training_runner import run_parallel_asset_training_blocking

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
        le=30,
        description="Overrides TRAIN_FORECAST_HORIZON_DAYS when set.",
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
            admin_api_secret_literal_override=admin_secret_resolution,
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
            admin_api_secret_literal_override=admin_secret_resolution,
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
