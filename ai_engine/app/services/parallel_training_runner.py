"""Coordinate parallel pooled training across many asset identifiers."""

from __future__ import annotations

from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any, Mapping
from uuid import UUID, uuid4

from app.core.config import Settings
from app.db.postgres_accessor import PostgresAccessConfig, fetch_active_asset_ids
from app.jobs.train_single_asset import train_single_asset_worker


def _assemble_plan_dictionary(
    asset_identifier: UUID,
    *,
    resolved_settings: Settings,
    activate_model: bool,
    override_version_tag_prefix: str | None,
    override_horizon: int | None,
    override_model_type: str | None,
    admin_api_secret_literal_override: str | None,
    holdout_eval_start_date_override: str | None = None,
    holdout_eval_months_override: int | None = None,
    maximum_training_feature_calendar_day_utc_override: str | None = None,
    registry_display_name_override: str | None = None,
    trainer_hyperparameters_override_exclusive: Mapping[str, Any] | None = None,
    persist_retrospective_holdout_predictions_override_exclusive: bool | None = None,
) -> dict[str, Any]:
    """Pack serializable knobs for worker subprocess consumption."""
    prefix_source = resolved_settings.TRAIN_VERSION_TAG_PREFIX.strip() or "onchain-hgb"
    if override_version_tag_prefix is not None and override_version_tag_prefix.strip():
        prefix_source = override_version_tag_prefix.strip()
    utc_stamp_compact = datetime.now(timezone.utc).strftime("%y%m%d%H%M")
    unique_fragment = uuid4().hex[:6]
    trimmed_prefix = prefix_source[:20]
    version_tag_composed = f"{trimmed_prefix}-{utc_stamp_compact}-{unique_fragment}"

    horizon_value = resolved_settings.TRAIN_FORECAST_HORIZON_DAYS
    if override_horizon is not None:
        horizon_value = override_horizon

    effective_model_type = resolved_settings.TRAIN_DEFAULT_MODEL_TYPE.strip() or "hgb_ocm"
    if override_model_type is not None and override_model_type.strip():
        effective_model_type = override_model_type.strip()

    effective_admin_material = resolved_settings.ADMIN_API_KEY.strip()
    if admin_api_secret_literal_override is not None and admin_api_secret_literal_override.strip():
        effective_admin_material = admin_api_secret_literal_override.strip()

    holdout_start_literal_exclusive = resolved_settings.TRAIN_HOLDOUT_EVAL_START_DATE.strip()
    if holdout_eval_start_date_override is not None:
        holdout_start_literal_exclusive = holdout_eval_start_date_override.strip()

    holdout_month_span_exclusive = int(resolved_settings.TRAIN_HOLDOUT_EVAL_MONTHS)
    if holdout_eval_months_override is not None:
        holdout_month_span_exclusive = int(holdout_eval_months_override)

    optional_registry_label_exclusive = (
        registry_display_name_override.strip()
        if registry_display_name_override and registry_display_name_override.strip()
        else None
    )

    serialized_plan_dictionary_exclusive: dict[str, Any] = {
        "asset_id": str(asset_identifier),
        "sync_database_url": resolved_settings.sync_database_url,
        "schema_name": resolved_settings.validated_schema_name,
        "postgres_ssl": resolved_settings.POSTGRES_SSL,
        "model_path_root": resolved_settings.MODEL_PATH,
        "backend_base_url": resolved_settings.BACKEND_BASE_URL,
        "admin_api_key": effective_admin_material,
        "min_sample_rows": resolved_settings.TRAIN_MIN_SAMPLE_ROWS,
        "max_metric_columns": resolved_settings.TRAIN_MAX_ONCHAIN_METRIC_COLUMNS,
        "forecast_horizon_days": horizon_value,
        "forecast_log_sigma_floor": float(resolved_settings.TRAIN_FORECAST_LOG_SIGMA_FLOOR),
        "forecast_ci_z_score": float(resolved_settings.TRAIN_FORECAST_CI_Z_SCORE),
        "forecast_band_log_half_width_cap": float(resolved_settings.TRAIN_FORECAST_BAND_LOG_HALF_WIDTH_CAP),
        "model_type_slug": effective_model_type,
        "holdout_eval_start_date": holdout_start_literal_exclusive,
        "holdout_eval_months": holdout_month_span_exclusive,
        "version_tag": version_tag_composed,
        "activate_model": activate_model,
    }
    if optional_registry_label_exclusive:
        capped_registry_label_exclusive = optional_registry_label_exclusive[:120]
        serialized_plan_dictionary_exclusive["registry_display_name"] = capped_registry_label_exclusive
    if trainer_hyperparameters_override_exclusive is not None:
        serialized_plan_dictionary_exclusive["trainer_hyperparameters"] = dict(
            trainer_hyperparameters_override_exclusive,
        )
    if persist_retrospective_holdout_predictions_override_exclusive is not None:
        serialized_plan_dictionary_exclusive["persist_retrospective_holdout_predictions"] = bool(
            persist_retrospective_holdout_predictions_override_exclusive,
        )

    cutoff_literal_strip_exclusive = (
        maximum_training_feature_calendar_day_utc_override.strip()
        if isinstance(maximum_training_feature_calendar_day_utc_override, str)
        else ""
    )
    if cutoff_literal_strip_exclusive:
        serialized_plan_dictionary_exclusive["maximum_training_feature_calendar_day_utc"] = cutoff_literal_strip_exclusive

    return serialized_plan_dictionary_exclusive


def run_parallel_asset_training_blocking(
    *,
    resolved_settings: Settings,
    asset_identifiers_requested: list[UUID] | None,
    activate_model: bool,
    override_version_prefix: str | None,
    override_horizon_days: int | None,
    override_model_type: str | None = None,
    admin_api_secret_literal_override: str | None = None,
    holdout_eval_start_date_override: str | None = None,
    holdout_eval_months_override: int | None = None,
    registry_display_name_override: str | None = None,
    trainer_hyperparameters_exclusive: Mapping[str, Any] | None = None,
    persist_retrospective_holdout_predictions_exclusive: bool | None = None,
    maximum_training_feature_calendar_day_utc_override: str | None = None,
) -> dict[str, Any]:
    """
    Blocking entry used from ``asyncio.to_thread`` wrappers.

    When ``asset_identifiers_requested`` is ``None`` or empty, every active backend asset is enumerated.
    """
    access_stub = PostgresAccessConfig(
        sync_database_url=resolved_settings.sync_database_url,
        schema_name=resolved_settings.validated_schema_name,
        ssl_enabled=resolved_settings.POSTGRES_SSL,
    )
    if asset_identifiers_requested is not None:
        enumerated_assets = list(asset_identifiers_requested)
    else:
        enumerated_assets = fetch_active_asset_ids(access_stub)
    if resolved_settings.TRAIN_MAX_ASSETS > 0:
        limited_assets = enumerated_assets[: resolved_settings.TRAIN_MAX_ASSETS]
    else:
        limited_assets = enumerated_assets

    plan_payloads = [
        _assemble_plan_dictionary(
            asset_candidate,
            resolved_settings=resolved_settings,
            activate_model=activate_model,
            override_version_tag_prefix=override_version_prefix,
            override_horizon=override_horizon_days,
            override_model_type=override_model_type,
            admin_api_secret_literal_override=admin_api_secret_literal_override,
            holdout_eval_start_date_override=holdout_eval_start_date_override,
            holdout_eval_months_override=holdout_eval_months_override,
            registry_display_name_override=registry_display_name_override,
            trainer_hyperparameters_override_exclusive=trainer_hyperparameters_exclusive,
            persist_retrospective_holdout_predictions_override_exclusive=persist_retrospective_holdout_predictions_exclusive,
            maximum_training_feature_calendar_day_utc_override=maximum_training_feature_calendar_day_utc_override,
        )
        for asset_candidate in limited_assets
    ]

    outcome_accumulator: list[dict[str, Any]] = []

    parallel_worker_cap = min(resolved_settings.TRAIN_MAX_WORKERS, len(plan_payloads) or 1)
    with ProcessPoolExecutor(max_workers=parallel_worker_cap) as executor_pool:
        future_handles = [
            executor_pool.submit(train_single_asset_worker, payload) for payload in plan_payloads
        ]

        for future_handle in as_completed(future_handles):
            outcome_accumulator.append(future_handle.result())

    summarized_status = {
        "requested_assets": len(limited_assets),
        "scheduled_jobs": len(plan_payloads),
        "worker_cap": parallel_worker_cap,
        "per_asset_results": sorted(outcome_accumulator, key=lambda row: row.get("asset_id", "")),
    }

    aggregated_failures = [row for row in outcome_accumulator if row.get("status") == "failed"]
    if aggregated_failures:
        summarized_status["blocking_failures"] = aggregated_failures

    summarized_status["all_workers_clean"] = len(aggregated_failures) == 0

    return summarized_status
