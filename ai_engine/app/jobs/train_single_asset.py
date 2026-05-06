"""Train one asset inside a pooled worker process (must stay picklable at module scope)."""

from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from uuid import UUID

import joblib
import numpy as np

from app.db.postgres_accessor import PostgresAccessConfig, open_connection
from app.services.backend_admin_client import persist_ml_registry_row, persist_prediction_batch_rows
from app.services.feature_matrix_builder import build_training_frame_for_asset
from app.services.training_pipeline import bundle_to_joblib_dict, train_estimator_bundle


def train_single_asset_worker(plan_dictionary: dict[str, Any]) -> dict[str, Any]:
    """Endpoint-friendly summary dict produced after optional persistence."""

    asset_text = plan_dictionary["asset_id"]

    try:
        return _train_single_asset_worker_impl(plan_dictionary)
    except Exception as orchestration_failure:
        return {
            "asset_id": asset_text,
            "status": "failed",
            "detail": repr(orchestration_failure),
        }


def _train_single_asset_worker_impl(plan_dictionary: dict[str, Any]) -> dict[str, Any]:
    """Separated core implementation so outer wrapper can coerce exceptions."""

    asset_text = plan_dictionary["asset_id"]
    asset_uuid = UUID(str(asset_text))

    database_url = plan_dictionary["sync_database_url"]
    schema_name = plan_dictionary["schema_name"]
    ssl_flag = bool(plan_dictionary["postgres_ssl"])
    model_root = Path(plan_dictionary["model_path_root"]).resolve()
    backend_url = plan_dictionary["backend_base_url"]
    admin_key = plan_dictionary["admin_api_key"]
    minimum_rows = int(plan_dictionary["min_sample_rows"])
    metric_column_cap = int(plan_dictionary["max_metric_columns"])
    horizon_days = int(plan_dictionary["forecast_horizon_days"])
    version_tag_literal = plan_dictionary["version_tag"]
    activate_flag = bool(plan_dictionary.get("activate_model", True))

    if not admin_key.strip():
        return {
            "asset_id": asset_text,
            "status": "failed",
            "detail": "ADMIN_API_KEY is required to register artifacts",
        }

    access_config = PostgresAccessConfig(
        sync_database_url=database_url,
        schema_name=schema_name,
        ssl_enabled=ssl_flag,
    )

    with open_connection(access_config) as connection:
        training_frame_outcome = build_training_frame_for_asset(
            connection=connection,
            schema_name=schema_name,
            asset_id=asset_uuid,
            column_cap=metric_column_cap,
        )

    if training_frame_outcome is None:
        return {
            "asset_id": asset_text,
            "status": "skipped",
            "detail": "Insufficient overlapping on-chain history plus market close rows for training",
        }

    observation_count = len(training_frame_outcome.feature_frame)
    if observation_count < minimum_rows:
        return {
            "asset_id": asset_text,
            "status": "skipped",
            "detail": f"Only {observation_count} usable rows (need {minimum_rows})",
        }

    fitted_core_bundle = train_estimator_bundle(
        training_frame_outcome.feature_frame,
        training_frame_outcome.target_series,
    )

    fitted_bundle = replace(
        fitted_core_bundle,
        anchor_metric_column_key="",
        target_signal_slug="market_close_next_day_log_forward_return_onchain_feats",
    )

    latest_feature_row = training_frame_outcome.feature_frame.sort_index().iloc[-1:]
    predicted_log_forward_return = float(fitted_bundle.pipeline.predict(latest_feature_row)[0])

    residual_log_return_band_half_width = fitted_bundle.residual_standard_error * 1.96
    log_high_forward = predicted_log_forward_return + residual_log_return_band_half_width
    log_low_forward = predicted_log_forward_return - residual_log_return_band_half_width

    reference_close_for_extrapolation = float(training_frame_outcome.anchor_close_price)
    predicted_next_close_mid = float(reference_close_for_extrapolation * np.exp(predicted_log_forward_return))
    predicted_next_close_band_high = float(reference_close_for_extrapolation * np.exp(log_high_forward))
    predicted_next_close_band_low = float(reference_close_for_extrapolation * np.exp(log_low_forward))

    model_root.mkdir(parents=True, exist_ok=True)
    asset_directory = model_root / str(asset_uuid)
    asset_directory.mkdir(parents=True, exist_ok=True)
    artifact_filename = f"{version_tag_literal.replace('/', '_')}.joblib"
    absolute_artifact_path = asset_directory / artifact_filename
    joblib.dump(bundle_to_joblib_dict(fitted_bundle), absolute_artifact_path)

    hyperparameter_document = {
        "framework": "sklearn_hist_gradient_boosting",
        "max_onchain_metric_columns": metric_column_cap,
        "forecast_horizon_days": horizon_days,
        "feature_source": "on_chain_metrics_daily_wide",
        "prediction_target": "market_data_next_day_close_level",
        "model_target_space": "log_close_one_day_forward_return",
    }
    training_metric_document = {
        "validation_mae_log_close_forward_return": fitted_bundle.validation_absolute_error_mean,
        "residual_sigma_log_close_forward_return": fitted_bundle.residual_standard_error,
        "training_rows": fitted_bundle.training_observation_rows,
    }

    persisted_model_identity = persist_ml_registry_row(
        backend_base_url=backend_url,
        admin_api_key=admin_key,
        version_tag=version_tag_literal[:50],
        asset_id=asset_uuid,
        model_type_slug="hgb_ocm",
        hyperparameter_document=hyperparameter_document,
        training_metric_document=training_metric_document,
        artifact_relative_path_on_disk=str(absolute_artifact_path),
        activate_model=activate_flag,
    )

    anchor_naive_midnight = datetime(
        training_frame_outcome.forecast_anchor_day.year,
        training_frame_outcome.forecast_anchor_day.month,
        training_frame_outcome.forecast_anchor_day.day,
        tzinfo=timezone.utc,
    )

    prediction_rows: list[dict[str, Any]] = []
    for step_index in range(1, horizon_days + 1):
        forecast_timepoint = anchor_naive_midnight + timedelta(days=step_index)
        prediction_rows.append(
            {
                "time": forecast_timepoint,
                "asset_id": asset_uuid,
                "model_id": persisted_model_identity,
                "predicted_value": predicted_next_close_mid,
                "confidence_interval_high": predicted_next_close_band_high,
                "confidence_interval_low": predicted_next_close_band_low,
            }
        )

    persist_prediction_batch_rows(
        backend_base_url=backend_url,
        admin_api_key=admin_key,
        prediction_rows=prediction_rows,
    )

    return {
        "asset_id": asset_text,
        "status": "trained",
        "model_id": str(persisted_model_identity),
        "validation_mae_log_close_forward_return": fitted_bundle.validation_absolute_error_mean,
        "prediction_rows_written": len(prediction_rows),
        "artifact_path": str(absolute_artifact_path),
    }
