"""Train one asset inside a pooled worker process (must stay picklable at module scope).

Multi-step forecast persistence compounds the fitted one-day log return and applies an Ito
convexity adjustment derived from an effective volatility (validation residual sigma floored
via the training plan dictionary).

Model dispatch:
    model_type_slug == "lstm_ocm"  -> lstm_pipeline.train_lstm_for_asset + torch.save artifact
    model_type_slug == "ensemble_ocm" -> dedicated transformed-feature multi-step voting ensemble
    all other slugs                    -> training_pipeline.train_estimator_bundle + joblib artifact

Inclusive training-data cutoff (``maximum_training_feature_calendar_day_utc`` plan key):

    Rows whose UTC calendar-day feature index exceeds the cutoff are discarded before partitioning.
    Training, terminal one-step inference, and the compounded horizon all use only rows on or before
    that cutoff, so persisted forward steps begin the next calendar day after the last retained bar
    even when the warehouse still carries later on-chain snapshots.

Holdout-only mode when the cutoff literal is omitted (``holdout_eval_start_date`` / ``holdout_eval_months``
plan keys retained for older automation):

    ``fit`` consumes samples whose next-day settlement is strictly earlier than the holdout onset,
    retrospective one-step payloads may cover ``[holdout onset, onset + calendar months)`` when enabled,
    and the compounded horizon anchors on the warehouse's latest aligned feature row whenever the
    cutoff key is absent.

Merged persistence deduplicates retrospective rows versus the opening forward horizon step when both
would share the identical settlement stamp.
"""


from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import joblib
import numpy as np
import pandas as pd

from app.db.postgres_accessor import PostgresAccessConfig, load_market_data_daily_frame, open_connection
from app.services.backend_admin_client import persist_ml_registry_row, persist_prediction_batch_rows
from app.services.feature_matrix_builder import (
    TrainingFrameBuildResult,
    build_market_data_feature_block,
    build_training_frame_for_asset,
)
from app.services.ensemble_pipeline import (
    build_ensemble_feature_matrix_for_asset_exclusive,
    train_multi_step_ensemble_for_cutoff_exclusive,
)
from app.services.training_pipeline import (
    bundle_to_joblib_dict,
    partition_trainer_hyperparameters_for_lstm_exclusive,
    partition_trainer_hyperparameters_for_sklearn_exclusive,
    snapshot_matching_estimator_params_exclusive,
    train_estimator_bundle,
)


def _prediction_batch_primary_key_tuple(row_payload: dict[str, Any]) -> tuple[datetime, UUID, UUID]:
    """Normalize timestamps and identifiers for Timescale primary-key equality checks."""
    calendar_marker = row_payload["time"]

    if not isinstance(calendar_marker, datetime):
        calendar_marker = datetime.fromisoformat(str(calendar_marker).replace("Z", "+00:00"))

    if calendar_marker.tzinfo is None:
        aware_marker = calendar_marker.replace(tzinfo=timezone.utc)
    else:
        aware_marker = calendar_marker.astimezone(timezone.utc)

    calendar_midnight_utc = aware_marker.replace(hour=0, minute=0, second=0, microsecond=0)

    asset_identifier = row_payload["asset_id"]

    model_identifier = row_payload["model_id"]

    if not isinstance(asset_identifier, UUID):
        asset_identifier = UUID(str(asset_identifier))

    if not isinstance(model_identifier, UUID):
        model_identifier = UUID(str(model_identifier))

    return (calendar_midnight_utc, asset_identifier, model_identifier)


def merge_retrospective_and_forward_prediction_rows(
    retrospective_row_payloads: list[dict[str, Any]],
    forward_horizon_row_payloads: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Persist a single batch without violating the (time, asset_id, model_id) primary key.

    The last chronological feature day yields both a one-step retrospective settlement and the first
    forward horizon step that references the identical calendar instant. Retrospective payloads
    replace colliding forward rows so backtest semantics stay attached to overlapping keys.
    """

    deduped_map: dict[tuple[datetime, UUID, UUID], dict[str, Any]] = {}

    for row_payload in retrospective_row_payloads:
        deduped_map[_prediction_batch_primary_key_tuple(row_payload)] = row_payload

    for row_payload in forward_horizon_row_payloads:
        primary_key = _prediction_batch_primary_key_tuple(row_payload)

        if primary_key not in deduped_map:
            deduped_map[primary_key] = row_payload

    return sorted(deduped_map.values(), key=lambda row_payload: row_payload["time"])


def _utc_naive_calendar_markers(datetime_index_like: pd.DatetimeIndex | pd.Index) -> pd.DatetimeIndex:
    """Interpret feature row indices as UTC calendar stamps for chronological comparisons."""
    working = pd.DatetimeIndex(datetime_index_like)
    if working.tz is None:
        return working.tz_localize("UTC").normalize()
    return working.tz_convert("UTC").normalize()


def _build_outcome_dates_series(sorted_feature_frame: pd.DataFrame) -> pd.Series:
    """Produce one-day-forward UTC outcome calendar dates aligned with settled feature-row days."""
    calendar_markers = _utc_naive_calendar_markers(sorted_feature_frame.index)
    outcome_timestamps = calendar_markers + pd.Timedelta(days=1)
    return pd.Series(outcome_timestamps, index=sorted_feature_frame.index)


def _materialize_strict_training_split(
    feature_frame: pd.DataFrame,
    target_series: pd.Series,
    closes_series: pd.Series,
    *,
    holdout_calendar_onset_exclusive: pd.Timestamp | None,
    holdout_calendar_span_month_count: int,
) -> tuple[pd.DataFrame, pd.Series, pd.Index, pd.Series, pd.DataFrame]:
    """
    Produce temporally segregated subsets for strict holdout retrospective evaluation.

    When ``holdout_calendar_onset_exclusive`` is ``None``, all rows qualify for estimator ``fit`` and
    no retrospective holdout timestamps are enumerated.
    """

    sorted_features = feature_frame.sort_index()
    sorted_targets = target_series.reindex(sorted_features.index).astype(float)
    sorted_closes = closes_series.reindex(sorted_features.index).astype(float)
    outcome_dates_aligned = _build_outcome_dates_series(sorted_features)

    if holdout_calendar_onset_exclusive is None:
        empty_retrospective = sorted_features.index[:0]
        return sorted_features, sorted_targets, empty_retrospective, outcome_dates_aligned, sorted_features

    hold_exclusive_end = (
        holdout_calendar_onset_exclusive + pd.DateOffset(months=holdout_calendar_span_month_count)
    )

    mask_train_strict = outcome_dates_aligned < holdout_calendar_onset_exclusive
    retrospective_mask_strict = (
        (outcome_dates_aligned >= holdout_calendar_onset_exclusive)
        & (outcome_dates_aligned < hold_exclusive_end)
    )

    feat_train_strict = sorted_features.loc[mask_train_strict].copy()
    y_train_strict = sorted_targets.loc[feat_train_strict.index]

    retrospective_feature_calendar_index = sorted_features.index[retrospective_mask_strict]

    return feat_train_strict, y_train_strict, retrospective_feature_calendar_index, outcome_dates_aligned, sorted_features


def _exclusive_calendar_cutoff_timestamp_from_literal_or_raise_exclusive(trimmed_exclusive: str) -> pd.Timestamp:
    """Parse ``yyyy-mm-dd`` into timezone-aware UTC midnight or raise."""

    parsed_candidate_exclusive = pd.Timestamp(trimmed_exclusive)
    if pd.isna(parsed_candidate_exclusive):
        raise ValueError("Unrecognized yyyy-mm-dd calendar literal")
    localized_exclusive_timestamp = parsed_candidate_exclusive.tz_localize("UTC")
    return localized_exclusive_timestamp.normalize()


def _truncate_training_frame_build_result_through_inclusive_calendar_day_exclusive(
    bundle_exclusive: TrainingFrameBuildResult,
    inclusive_calendar_upper_bound_exclusive_timestamp: pd.Timestamp,
) -> TrainingFrameBuildResult | None:
    """Drop feature rows dated after the cutoff so fit and anchored horizon stay strictly historical."""

    sorted_feature_frame_exclusive = bundle_exclusive.feature_frame.sort_index()

    normalized_feature_day_markers_exclusive = pd.Series(
        _utc_naive_calendar_markers(sorted_feature_frame_exclusive.index),
        index=sorted_feature_frame_exclusive.index,
    )

    cutoff_midnight_exclusive = inclusive_calendar_upper_bound_exclusive_timestamp.normalize()

    eligibility_exclusive = normalized_feature_day_markers_exclusive <= cutoff_midnight_exclusive

    if not bool(eligibility_exclusive.any()):
        return None

    trimmed_features_exclusive = sorted_feature_frame_exclusive.loc[eligibility_exclusive].astype(float)
    trimmed_targets_exclusive = bundle_exclusive.target_series.reindex(trimmed_features_exclusive.index).astype(float)
    trimmed_closes_exclusive = bundle_exclusive.closes_aligned.reindex(trimmed_features_exclusive.index).astype(float)

    anchor_day_exclusive = trimmed_features_exclusive.index.max()
    scalar_anchor_close_exclusive = float(max(trimmed_closes_exclusive.loc[anchor_day_exclusive], 1e-12))

    return replace(
        bundle_exclusive,
        feature_frame=trimmed_features_exclusive,
        target_series=trimmed_targets_exclusive,
        closes_aligned=trimmed_closes_exclusive,
        forecast_anchor_day=anchor_day_exclusive,
        anchor_close_price=scalar_anchor_close_exclusive,
    )


def _parse_holdout_calendar_onset(holdout_start_literal: str | None) -> pd.Timestamp | None:
    """
    Normalize plan dictionary holdout literals into timezone-aware UTC boundaries.

    An empty trimmed string disables strict temporal segregation.
    """

    trimmed = (holdout_start_literal or "").strip()

    if not trimmed:
        return None

    return pd.Timestamp(trimmed).tz_localize("UTC").normalize()


def _confidence_interval_levels_one_step_mid(
    reference_close_positive: float,
    predicted_log_forward_return_residual: float,
    residual_sigma: float,
    confidence_interval_z_score_exclusive_float: float,
) -> tuple[float, float, float]:
    """Exponentiate midpoint log-return with symmetric Gaussian tails for one forecasting day."""
    half_width = residual_sigma * confidence_interval_z_score_exclusive_float
    midpoint = float(reference_close_positive * np.exp(predicted_log_forward_return_residual))
    upward = float(
        reference_close_positive * np.exp(predicted_log_forward_return_residual + half_width),
    )
    downward = float(
        reference_close_positive * np.exp(predicted_log_forward_return_residual - half_width),
    )
    return midpoint, upward, downward


def _confidence_interval_levels_one_step_usd(
    predicted_next_close_usd: float,
    residual_sigma_usd: float,
    confidence_interval_z_score_exclusive_float: float,
) -> tuple[float, float, float]:
    """Symmetric Gaussian tails in USD space around a direct next-close point forecast."""

    half_width = residual_sigma_usd * confidence_interval_z_score_exclusive_float
    midpoint = float(predicted_next_close_usd)
    upward = float(midpoint + half_width)
    downward = float(max(midpoint - half_width, 1e-9))
    return midpoint, upward, downward


def collect_retrospective_sklearn_daily_rows_without_model_foreign_key(
    fitted_pipeline_sklearn_bundle: Any,
    *,
    sorted_full_features_sorted: pd.DataFrame,
    sorted_targets_sorted: pd.Series,
    mapped_outcome_calendar_series_sorted: pd.Series,
    retrospective_feature_calendar_anchor_index: pd.Index,
    calibrated_log_return_sigma_residual: float,
    confidence_interval_z_score_exclusive_float: float,
    asset_foreign_key_identity: UUID,
) -> tuple[list[dict[str, Any]], float | None]:
    """
    Emit retrospective one-step level forecasts keyed by causal settlement timestamps.

    Returned dictionaries intentionally omit ``model_id`` keys until callers attach registry identities.
    """

    absolute_error_stack: list[float] = []

    structured_rows_accumulator: list[dict[str, Any]] = []

    for calendar_anchor_exclusive in retrospective_feature_calendar_anchor_index.sort_values():
        causal_feature_matrix_singleton = sorted_full_features_sorted.loc[[calendar_anchor_exclusive]]

        realized_next_close_usd = float(sorted_targets_sorted.loc[calendar_anchor_exclusive])

        modeled_next_close_usd = float(
            fitted_pipeline_sklearn_bundle.pipeline.predict(causal_feature_matrix_singleton)[0],
        )

        absolute_error_stack.append(abs(modeled_next_close_usd - realized_next_close_usd))

        mid_level_exclusive, upward_fence_exclusive, downward_fence_exclusive = (
            _confidence_interval_levels_one_step_usd(
                modeled_next_close_usd,
                calibrated_log_return_sigma_residual,
                confidence_interval_z_score_exclusive_float,
            )
        )

        outcome_calendar_marker_exclusive = mapped_outcome_calendar_series_sorted.loc[calendar_anchor_exclusive]

        settlement_midnight_exclusive = datetime(
            int(outcome_calendar_marker_exclusive.year),
            int(outcome_calendar_marker_exclusive.month),
            int(outcome_calendar_marker_exclusive.day),
            tzinfo=timezone.utc,
        )

        structured_rows_accumulator.append(
            {
                "time": settlement_midnight_exclusive,
                "asset_id": asset_foreign_key_identity,
                "predicted_value": mid_level_exclusive,
                "confidence_interval_high": upward_fence_exclusive,
                "confidence_interval_low": downward_fence_exclusive,
                "horizon_step": 1,
            }
        )

    retrospective_aggregate_mean_absolute_exclusive = (
        float(np.mean(absolute_error_stack)) if absolute_error_stack else None
    )

    return structured_rows_accumulator, retrospective_aggregate_mean_absolute_exclusive


def collect_retrospective_lstm_daily_rows_without_model_foreign_key(
    lstm_payload_dictionary_exclusive: dict[str, Any],
    *,
    sorted_full_features_sorted_reference: pd.DataFrame,
    sorted_targets_sorted_reference: pd.Series,
    mapped_outcome_calendar_series_sorted_exclusive: pd.Series,
    retrospective_feature_calendar_anchor_index_exclusive: pd.Index,
    calibrated_log_return_sigma_residual_exclusive: float,
    confidence_interval_z_score_exclusive_float: float,
    asset_foreign_key_identity_exclusive: UUID,
) -> tuple[list[dict[str, Any]], float | None]:
    """
    Emit retrospective causal-window LSTM one-step settlements mirroring sklearn temporal contracts.
    """

    from app.services.lstm_pipeline import predict_lstm as predict_torch_forward_log_return_exclusive

    lookback_exclusive = int(lstm_payload_dictionary_exclusive["lookback_window"])

    absolute_error_stack_exclusive: list[float] = []

    structured_rows_exclusive: list[dict[str, Any]] = []

    for calendar_anchor_exclusive in retrospective_feature_calendar_anchor_index_exclusive.sort_values():
        causal_history_exclusive = sorted_full_features_sorted_reference.loc[:calendar_anchor_exclusive]

        if len(causal_history_exclusive) < lookback_exclusive:
            continue

        realized_next_close_usd_exclusive_float = float(
            sorted_targets_sorted_reference.loc[calendar_anchor_exclusive],
        )

        modeled_next_close_usd_exclusive_float = float(
            predict_torch_forward_log_return_exclusive(
                lstm_payload_dictionary_exclusive,
                causal_history_exclusive,
            )
        )

        absolute_error_stack_exclusive.append(
            abs(modeled_next_close_usd_exclusive_float - realized_next_close_usd_exclusive_float),
        )

        mid_lv, hi_lv, low_lv = _confidence_interval_levels_one_step_usd(
            modeled_next_close_usd_exclusive_float,
            calibrated_log_return_sigma_residual_exclusive,
            confidence_interval_z_score_exclusive_float,
        )

        outcome_exclusive = mapped_outcome_calendar_series_sorted_exclusive.loc[calendar_anchor_exclusive]

        midnight_outcome_exclusive = datetime(
            int(outcome_exclusive.year),
            int(outcome_exclusive.month),
            int(outcome_exclusive.day),
            tzinfo=timezone.utc,
        )

        structured_rows_exclusive.append(
            {
                "time": midnight_outcome_exclusive,
                "asset_id": asset_foreign_key_identity_exclusive,
                "predicted_value": mid_lv,
                "confidence_interval_high": hi_lv,
                "confidence_interval_low": low_lv,
                "horizon_step": 1,
            }
        )

    retrospect_mae = float(np.mean(absolute_error_stack_exclusive)) if absolute_error_stack_exclusive else None

    return structured_rows_exclusive, retrospect_mae


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

    asset_text_value = plan_dictionary["asset_id"]
    asset_uuid_value = UUID(str(asset_text_value))

    database_connection_url_value = plan_dictionary["sync_database_url"]
    schema_catalog_identifier_value = plan_dictionary["schema_name"]
    ssl_boolean_flag_enabled = bool(plan_dictionary["postgres_ssl"])
    model_filesystem_anchor_root_absolute = Path(plan_dictionary["model_path_root"]).resolve()
    backend_http_base_url_absolute = plan_dictionary["backend_base_url"]

    administrator_api_secret_plaintext = plan_dictionary["admin_api_key"]

    minimum_supervised_alignment_rows_exclusive = int(plan_dictionary["min_sample_rows"])

    maximum_metric_wide_column_budget_exclusive = int(plan_dictionary["max_metric_columns"])

    forward_multi_step_horizon_exclusive = int(plan_dictionary["forecast_horizon_days"])

    forecast_volatility_residual_floor_exclusive = float(plan_dictionary.get("forecast_log_sigma_floor", 0.015))

    model_architecture_slug_identifier = str(plan_dictionary.get("model_type_slug", "hgb_ocm"))

    trainer_hyperparameters_raw_exclusive = plan_dictionary.get("trainer_hyperparameters")
    trainer_hyperparameters_dictionary_exclusive: dict[str, Any] = {}
    if isinstance(trainer_hyperparameters_raw_exclusive, dict):
        trainer_hyperparameters_dictionary_exclusive = dict(trainer_hyperparameters_raw_exclusive)

    persistence_policy_raw_exclusive = plan_dictionary.get("persist_retrospective_holdout_predictions")
    if persistence_policy_raw_exclusive is None:
        persist_retrospective_holdout_predictions_exclusive = True
    else:
        persist_retrospective_holdout_predictions_exclusive = bool(persistence_policy_raw_exclusive)

    holdout_evaluation_eval_start_calendar_literal_exclusive = (
        plan_dictionary.get("holdout_eval_start_date") or ""
    )

    holdout_eval_month_span_exclusive = int(plan_dictionary.get("holdout_eval_months", 5))

    version_stamp_literal_exclusive = plan_dictionary["version_tag"]

    registration_activate_boolean_flag_exclusive = bool(plan_dictionary.get("activate_model", True))

    forecast_confidence_interval_z_score_exclusive_float = float(plan_dictionary.get("forecast_ci_z_score", 1.96))

    forecast_band_log_half_width_cap_exclusive_float = float(plan_dictionary.get("forecast_band_log_half_width_cap", 0.14))

    resolved_registry_display_label_exclusive = (
        str(plan_dictionary.get("registry_display_name") or "").strip() or None
    )
    maximum_training_calendar_literal_exclusive = str(
        plan_dictionary.get("maximum_training_feature_calendar_day_utc") or "",
    ).strip()

    if not administrator_api_secret_plaintext.strip():
        return {
            "asset_id": asset_text_value,
            "status": "failed",
            "detail": "ADMIN_API_KEY is required to register artifacts",
        }

    postgres_access_exclusive_configuration_exclusive = PostgresAccessConfig(
        sync_database_url=database_connection_url_value,
        schema_name=schema_catalog_identifier_value,
        ssl_enabled=ssl_boolean_flag_enabled,
    )

    if model_architecture_slug_identifier == "ensemble_ocm":
        return _train_ensemble_path(
            asset_text_exclusive=asset_text_value,
            asset_uuid_exclusive=asset_uuid_value,
            postgres_access_configuration_exclusive=postgres_access_exclusive_configuration_exclusive,
            model_root_exclusive=model_filesystem_anchor_root_absolute,
            backend_base_url_exclusive=backend_http_base_url_absolute,
            admin_key_exclusive=administrator_api_secret_plaintext,
            horizon_days_exclusive=forward_multi_step_horizon_exclusive,
            forecast_log_sigma_floor_exclusive=forecast_volatility_residual_floor_exclusive,
            forecast_ci_z_score_exclusive_float=forecast_confidence_interval_z_score_exclusive_float,
            version_tag_exclusive=version_stamp_literal_exclusive,
            activate_exclusive=registration_activate_boolean_flag_exclusive,
            registry_display_name_exclusive=resolved_registry_display_label_exclusive,
            inclusive_training_data_calendar_cutoff_utc_yyyy_mm_dd_logged_exclusive=maximum_training_calendar_literal_exclusive
            or None,
        )

    preloaded_market_feature_block_exclusive = pd.DataFrame()
    try:
        with open_connection(postgres_access_exclusive_configuration_exclusive) as md_connection_exclusive:
            market_data_raw_exclusive = load_market_data_daily_frame(
                connection=md_connection_exclusive,
                schema_name=schema_catalog_identifier_value,
                asset_id=asset_uuid_value,
            )
        preloaded_market_feature_block_exclusive = build_market_data_feature_block(market_data_raw_exclusive)
    except Exception:
        pass

    with open_connection(postgres_access_exclusive_configuration_exclusive) as connection_active_exclusive:
        built_training_exclusive_frame_matrix_outcome_exclusive = build_training_frame_for_asset(
            connection=connection_active_exclusive,
            schema_name=schema_catalog_identifier_value,
            asset_id=asset_uuid_value,
            column_cap=maximum_metric_wide_column_budget_exclusive,
            external_market_feature_block=preloaded_market_feature_block_exclusive,
        )

    if built_training_exclusive_frame_matrix_outcome_exclusive is None:
        return {
            "asset_id": asset_text_value,
            "status": "skipped",
            "detail": (
                "Insufficient supervised on-chain frame (needs PriceUSD plus overlapping metrics "
                "through the configured horizon)."
            ),
        }

    exclusive_training_cutoff_logged_iso_exclusive: str | None = None

    full_bundle_before_cutoff_exclusive = built_training_exclusive_frame_matrix_outcome_exclusive
    working_bundle_exclusive = built_training_exclusive_frame_matrix_outcome_exclusive

    cutoff_post_retrospective_index_exclusive: pd.Index | None = None

    if maximum_training_calendar_literal_exclusive:
        try:
            inclusive_cutoff_timestamp_exclusive = _exclusive_calendar_cutoff_timestamp_from_literal_or_raise_exclusive(
                maximum_training_calendar_literal_exclusive,
            )
        except (ValueError, TypeError):
            return {
                "asset_id": asset_text_value,
                "status": "failed",
                "detail": "maximum_training_feature_calendar_day_utc must be yyyy-mm-dd in UTC.",
            }

        truncated_bundle_candidate_exclusive = _truncate_training_frame_build_result_through_inclusive_calendar_day_exclusive(
            working_bundle_exclusive,
            inclusive_cutoff_timestamp_exclusive,
        )

        if truncated_bundle_candidate_exclusive is None:
            return {
                "asset_id": asset_text_value,
                "status": "skipped",
                "detail": (
                    "No supervised rows remain on or before maximum_training_feature_calendar_day_utc; "
                    "widen ingestion or loosen the cutoff."
                ),
            }

        working_bundle_exclusive = truncated_bundle_candidate_exclusive
        exclusive_training_cutoff_logged_iso_exclusive = maximum_training_calendar_literal_exclusive
        holdout_calendar_onset_for_split_exclusive_timestamp_resolution = None

        full_sorted_frame_for_post_cutoff_exclusive = (
            full_bundle_before_cutoff_exclusive.feature_frame.sort_index()
        )
        full_calendar_day_markers_exclusive = pd.Series(
            _utc_naive_calendar_markers(full_sorted_frame_for_post_cutoff_exclusive.index),
            index=full_sorted_frame_for_post_cutoff_exclusive.index,
        )
        cutoff_midnight_normalized_exclusive = inclusive_cutoff_timestamp_exclusive.normalize()
        post_cutoff_row_mask_exclusive = (
            full_calendar_day_markers_exclusive > cutoff_midnight_normalized_exclusive
        )
        post_cutoff_candidate_index_exclusive = full_sorted_frame_for_post_cutoff_exclusive.index[
            post_cutoff_row_mask_exclusive
        ]
        if len(post_cutoff_candidate_index_exclusive) > 0:
            cutoff_post_retrospective_index_exclusive = post_cutoff_candidate_index_exclusive
    else:
        holdout_calendar_onset_for_split_exclusive_timestamp_resolution = _parse_holdout_calendar_onset(
            holdout_evaluation_eval_start_calendar_literal_exclusive,
        )

    (
        partitioned_training_exclusive_feature_frame_exclusive,
        partitioned_training_exclusive_targets_series_exclusive,
        retrospective_evaluation_feature_calendar_anchor_index_exclusive_bundle,
        sorted_outcome_date_mapping_exclusive_reference_series_exclusive,
        sorted_full_aligned_observation_sorted_feature_frame_exclusive,
    ) = _materialize_strict_training_split(
        working_bundle_exclusive.feature_frame,
        working_bundle_exclusive.target_series,
        working_bundle_exclusive.closes_aligned,
        holdout_calendar_onset_exclusive=holdout_calendar_onset_for_split_exclusive_timestamp_resolution,
        holdout_calendar_span_month_count=holdout_eval_month_span_exclusive,
    )

    if cutoff_post_retrospective_index_exclusive is not None:
        full_sorted_exclusive = full_bundle_before_cutoff_exclusive.feature_frame.sort_index()
        sorted_full_aligned_observation_sorted_feature_frame_exclusive = full_sorted_exclusive
        aligned_sorted_targets_exclusive_reference_exclusive = (
            full_bundle_before_cutoff_exclusive.target_series.reindex(full_sorted_exclusive.index).astype(float)
        )
        aligned_sorted_closes_reference_exclusive_reference = (
            full_bundle_before_cutoff_exclusive.closes_aligned.reindex(full_sorted_exclusive.index).astype(float)
        )
        sorted_outcome_date_mapping_exclusive_reference_series_exclusive = _build_outcome_dates_series(
            full_sorted_exclusive
        )
        retrospective_evaluation_feature_calendar_anchor_index_exclusive_bundle = (
            cutoff_post_retrospective_index_exclusive
        )
        holdout_evaluation_mode_active_exclusive = True
    else:
        aligned_sorted_targets_exclusive_reference_exclusive = working_bundle_exclusive.target_series.reindex(
            sorted_full_aligned_observation_sorted_feature_frame_exclusive.index,
        ).astype(float)

        aligned_sorted_closes_reference_exclusive_reference = working_bundle_exclusive.closes_aligned.reindex(
            sorted_full_aligned_observation_sorted_feature_frame_exclusive.index,
        ).astype(float)

        holdout_evaluation_mode_active_exclusive = (
            holdout_calendar_onset_for_split_exclusive_timestamp_resolution is not None
        )

    strict_partition_row_count_exclusive = len(partitioned_training_exclusive_feature_frame_exclusive)

    if strict_partition_row_count_exclusive < minimum_supervised_alignment_rows_exclusive:
        return {
            "asset_id": asset_text_value,
            "status": "skipped",
            "detail": (
                f"Only {strict_partition_row_count_exclusive} training samples precede holdout-exclusive "
                f"settlements globally (requested {minimum_supervised_alignment_rows_exclusive})."
            ),
        }

    training_anchor_features_exclusive = working_bundle_exclusive.feature_frame.sort_index()
    training_anchor_closes_exclusive = working_bundle_exclusive.closes_aligned.sort_index()

    if model_architecture_slug_identifier == "lstm_ocm":
        return _train_lstm_path(
            asset_text_exclusive=asset_text_value,
            asset_uuid_exclusive=asset_uuid_value,
            training_features_exclusive=partitioned_training_exclusive_feature_frame_exclusive,
            training_targets_exclusive=partitioned_training_exclusive_targets_series_exclusive,
            sorted_full_features_exclusive=sorted_full_aligned_observation_sorted_feature_frame_exclusive,
            sorted_full_targets_exclusive=aligned_sorted_targets_exclusive_reference_exclusive,
            sorted_full_closes_exclusive=aligned_sorted_closes_reference_exclusive_reference,
            anchor_features_exclusive=training_anchor_features_exclusive,
            anchor_closes_exclusive=training_anchor_closes_exclusive,
            outcome_dates_exclusive=sorted_outcome_date_mapping_exclusive_reference_series_exclusive,
            retrospective_calendar_index_exclusive=retrospective_evaluation_feature_calendar_anchor_index_exclusive_bundle,
            model_root_exclusive=model_filesystem_anchor_root_absolute,
            backend_base_url_exclusive=backend_http_base_url_absolute,
            admin_key_exclusive=administrator_api_secret_plaintext,
            horizon_days_exclusive=forward_multi_step_horizon_exclusive,
            forecast_log_sigma_floor_exclusive=forecast_volatility_residual_floor_exclusive,
            version_tag_exclusive=version_stamp_literal_exclusive,
            activate_exclusive=registration_activate_boolean_flag_exclusive,
            holdout_enabled_exclusive=holdout_evaluation_mode_active_exclusive,
            metric_column_cap_exclusive=maximum_metric_wide_column_budget_exclusive,
            forecast_ci_z_score_exclusive_float=forecast_confidence_interval_z_score_exclusive_float,
            forecast_band_log_half_width_cap_exclusive_float=forecast_band_log_half_width_cap_exclusive_float,
            registry_display_name_exclusive=resolved_registry_display_label_exclusive,
            trainer_hyperparameters_dictionary_exclusive=trainer_hyperparameters_dictionary_exclusive,
            persist_retrospective_holdout_predictions_exclusive=persist_retrospective_holdout_predictions_exclusive,
            inclusive_training_data_calendar_cutoff_utc_yyyy_mm_dd_logged_exclusive=exclusive_training_cutoff_logged_iso_exclusive,
        )

    return _train_sklearn_path(
        asset_text_exclusive=asset_text_value,
        asset_uuid_exclusive=asset_uuid_value,
        training_features_exclusive=partitioned_training_exclusive_feature_frame_exclusive,
        training_targets_exclusive=partitioned_training_exclusive_targets_series_exclusive,
        sorted_full_features_exclusive=sorted_full_aligned_observation_sorted_feature_frame_exclusive,
        sorted_full_targets_exclusive=aligned_sorted_targets_exclusive_reference_exclusive,
        sorted_full_closes_exclusive=aligned_sorted_closes_reference_exclusive_reference,
        anchor_features_exclusive=training_anchor_features_exclusive,
        anchor_closes_exclusive=training_anchor_closes_exclusive,
        outcome_dates_exclusive=sorted_outcome_date_mapping_exclusive_reference_series_exclusive,
        retrospective_calendar_index_exclusive=retrospective_evaluation_feature_calendar_anchor_index_exclusive_bundle,
        model_root_exclusive=model_filesystem_anchor_root_absolute,
        backend_base_url_exclusive=backend_http_base_url_absolute,
        admin_key_exclusive=administrator_api_secret_plaintext,
        metric_column_cap_exclusive=maximum_metric_wide_column_budget_exclusive,
        horizon_days_exclusive=forward_multi_step_horizon_exclusive,
        forecast_log_sigma_floor_exclusive=forecast_volatility_residual_floor_exclusive,
        model_type_slug_exclusive=model_architecture_slug_identifier,
        version_tag_exclusive=version_stamp_literal_exclusive,
        activate_exclusive=registration_activate_boolean_flag_exclusive,
        holdout_enabled_exclusive=holdout_evaluation_mode_active_exclusive,
        forecast_ci_z_score_exclusive_float=forecast_confidence_interval_z_score_exclusive_float,
        forecast_band_log_half_width_cap_exclusive_float=forecast_band_log_half_width_cap_exclusive_float,
        registry_display_name_exclusive=resolved_registry_display_label_exclusive,
        trainer_hyperparameters_dictionary_exclusive=trainer_hyperparameters_dictionary_exclusive,
        persist_retrospective_holdout_predictions_exclusive=persist_retrospective_holdout_predictions_exclusive,
        inclusive_training_data_calendar_cutoff_utc_yyyy_mm_dd_logged_exclusive=exclusive_training_cutoff_logged_iso_exclusive,
    )


def _train_sklearn_path(
    *,
    asset_text_exclusive: str,
    asset_uuid_exclusive: UUID,
    training_features_exclusive: pd.DataFrame,
    training_targets_exclusive: pd.Series,
    sorted_full_features_exclusive: pd.DataFrame,
    sorted_full_targets_exclusive: pd.Series,
    sorted_full_closes_exclusive: pd.Series,
    anchor_features_exclusive: pd.DataFrame,
    anchor_closes_exclusive: pd.Series,
    outcome_dates_exclusive: pd.Series,
    retrospective_calendar_index_exclusive: pd.Index,
    model_root_exclusive: Path,
    backend_base_url_exclusive: str,
    admin_key_exclusive: str,
    metric_column_cap_exclusive: int,
    horizon_days_exclusive: int,
    forecast_log_sigma_floor_exclusive: float,
    model_type_slug_exclusive: str,
    version_tag_exclusive: str,
    activate_exclusive: bool,
    holdout_enabled_exclusive: bool,
    forecast_ci_z_score_exclusive_float: float,
    forecast_band_log_half_width_cap_exclusive_float: float,
    registry_display_name_exclusive: str | None,
    trainer_hyperparameters_dictionary_exclusive: dict[str, Any],
    persist_retrospective_holdout_predictions_exclusive: bool,
    inclusive_training_data_calendar_cutoff_utc_yyyy_mm_dd_logged_exclusive: str | None = None,
) -> dict[str, Any]:
    """Fit supervised sklearn-compatible bundles under strict temporal segregation policies.

    ``anchor_features_exclusive`` and ``anchor_closes_exclusive`` always point to the last row of
    the **training-boundary** data (cutoff date in cutoff mode, latest available row otherwise).
    ``sorted_full_features_exclusive`` may extend beyond the anchor (post-cutoff dates) and is only
    used for retrospective evaluation — never for the terminal prediction or forward path anchor.
    """

    estimator_override_payload_exclusive, time_series_cv_fold_count_exclusive = (
        partition_trainer_hyperparameters_for_sklearn_exclusive(
            trainer_hyperparameters_dictionary_exclusive,
        )
    )

    fitted_core_bundle_exclusive = train_estimator_bundle(
        training_features_exclusive,
        training_targets_exclusive,
        model_type_slug=model_type_slug_exclusive,
        n_cv_splits=time_series_cv_fold_count_exclusive,
        estimator_param_overrides_exclusive=estimator_override_payload_exclusive,
    )

    fitted_bundle_exclusive_ready = replace(
        fitted_core_bundle_exclusive,
        anchor_metric_column_key="",
        target_signal_slug="market_close_next_day_usd_forward_price_onchain_feats",
        model_target_space="next_close_usd",
    )

    latest_singleton_feature_matrix_exclusive_bucket = anchor_features_exclusive.iloc[-1:]

    terminal_predicted_next_close_usd_exclusive_float = float(
        fitted_bundle_exclusive_ready.pipeline.predict(latest_singleton_feature_matrix_exclusive_bucket)[0],
    )

    effective_estimator_hyper_snapshot_exclusive = snapshot_matching_estimator_params_exclusive(
        fitted_bundle_exclusive_ready.pipeline,
        estimator_override_payload_exclusive,
    )

    raw_validation_sigma_exclusive_float = float(fitted_bundle_exclusive_ready.residual_standard_error)

    scalar_terminal_reference_close_exclusive = float(
        anchor_closes_exclusive.iloc[-1],
    )

    effective_sigma_usd_exclusive_float = float(
        max(
            raw_validation_sigma_exclusive_float,
            forecast_log_sigma_floor_exclusive * scalar_terminal_reference_close_exclusive,
        )
    )

    terminal_predicted_forward_log_exclusive_float = float(
        np.log(
            max(terminal_predicted_next_close_usd_exclusive_float, 1e-12)
            / max(scalar_terminal_reference_close_exclusive, 1e-12),
        )
    )

    sigma_log_for_multi_step_compound_exclusive_float = float(
        max(
            raw_validation_sigma_exclusive_float / max(scalar_terminal_reference_close_exclusive, 1e-12),
            forecast_log_sigma_floor_exclusive,
        )
    )

    joblib_filename_fragment_exclusive = version_tag_exclusive.replace("/", "_") + ".joblib"

    model_root_exclusive.mkdir(parents=True, exist_ok=True)

    asset_specific_directory_exclusive = model_root_exclusive / str(asset_uuid_exclusive)

    asset_specific_directory_exclusive.mkdir(parents=True, exist_ok=True)

    absolute_joblib_filepath_exclusive_resolution = asset_specific_directory_exclusive / joblib_filename_fragment_exclusive

    joblib.dump(bundle_to_joblib_dict(fitted_bundle_exclusive_ready), absolute_joblib_filepath_exclusive_resolution)

    retrospective_rows_exclusive_bucket_without_registry_foreign_key_exclusive: list[dict[str, Any]] = []

    retrospective_log_mae_exclusive_bucket_float_resolution: float | None = None

    if (
        persist_retrospective_holdout_predictions_exclusive
        and holdout_enabled_exclusive
        and len(retrospective_calendar_index_exclusive) > 0
    ):
        (
            retrospective_rows_exclusive_bucket_without_registry_foreign_key_exclusive,
            retrospective_log_mae_exclusive_bucket_float_resolution,
        ) = collect_retrospective_sklearn_daily_rows_without_model_foreign_key(
            fitted_bundle_exclusive_ready,
            sorted_full_features_sorted=sorted_full_features_exclusive,
            sorted_targets_sorted=sorted_full_targets_exclusive,
            mapped_outcome_calendar_series_sorted=outcome_dates_exclusive,
            retrospective_feature_calendar_anchor_index=retrospective_calendar_index_exclusive,
            calibrated_log_return_sigma_residual=effective_sigma_usd_exclusive_float,
            confidence_interval_z_score_exclusive_float=forecast_ci_z_score_exclusive_float,
            asset_foreign_key_identity=asset_uuid_exclusive,
        )

    hyper_document_exclusive_bundle_dictionary = {
        "framework": f"sklearn_{model_type_slug_exclusive}",
        "model_type_slug": model_type_slug_exclusive,
        "max_onchain_metric_columns": metric_column_cap_exclusive,
        "forecast_horizon_days": horizon_days_exclusive,
        "feature_source": "on_chain_metrics_daily_wide_lag_augmented",
        "prediction_target": "on_chain_price_usd_next_day_level",
        "model_target_space": "price_usd_next_calendar_close",
        "cv_strategy": f"TimeSeriesSplit_{time_series_cv_fold_count_exclusive}fold",
        "strict_holdout_precedes_eval_window_exclusive": holdout_enabled_exclusive,
        "multi_day_path_model": (
            "compound_daily_log_returns_from_implied_log_step: anchored_mu_log equals log(predicted_next_usd over reference_close); "
            "sigma_log_proxy equals max(rmse_usd_over_reference_close, configured_log_floor); "
            "mid_levels_via_exp cumulative logs with ito_bias and sqrt_h_times_z_log_band."
        ),
        "forecast_volatility_calibration": {
            "next_close_residual_rmse_validation_usd": raw_validation_sigma_exclusive_float,
            "next_close_sigma_effective_usd": effective_sigma_usd_exclusive_float,
            "log_sigma_proxy_used_for_compounded_path": sigma_log_for_multi_step_compound_exclusive_float,
            "log_volatility_effective_floor": forecast_log_sigma_floor_exclusive,
            "confidence_interval_gaussian_multiplier": forecast_ci_z_score_exclusive_float,
            "multi_day_log_band_half_width_cap": forecast_band_log_half_width_cap_exclusive_float,
        },
        "prediction_persistence_policy": {
            "retrospective_holdout_predictions_persisted": persist_retrospective_holdout_predictions_exclusive,
        },
    }

    if inclusive_training_data_calendar_cutoff_utc_yyyy_mm_dd_logged_exclusive:
        hyper_document_exclusive_bundle_dictionary["training_data_calendar_cutoff_utc_day_inclusive"] = (
            inclusive_training_data_calendar_cutoff_utc_yyyy_mm_dd_logged_exclusive
        )

    if trainer_hyperparameters_dictionary_exclusive:
        hyper_document_exclusive_bundle_dictionary["trainer_hyperparameters_submitted"] = (
            trainer_hyperparameters_dictionary_exclusive
        )
    if effective_estimator_hyper_snapshot_exclusive:
        hyper_document_exclusive_bundle_dictionary["estimator_hyperparameters_effective"] = (
            effective_estimator_hyper_snapshot_exclusive
        )

    if holdout_enabled_exclusive and len(retrospective_calendar_index_exclusive) > 0:
        earliest_outcome_calendar_iso_exclusive = outcome_dates_exclusive.loc[
            retrospective_calendar_index_exclusive,
        ].min()

        trailing_outcome_calendar_iso_exclusive = outcome_dates_exclusive.loc[
            retrospective_calendar_index_exclusive,
        ].max()

        hyper_document_exclusive_bundle_dictionary["calendar_retrospective_holdout_evaluation"] = {
            "first_settlement_outcome_iso8601_utc": earliest_outcome_calendar_iso_exclusive.isoformat(),
            "last_settlement_outcome_iso8601_utc": trailing_outcome_calendar_iso_exclusive.isoformat(),
        }

    training_metrics_document_exclusive_dictionary_resolution = {
        "validation_mae_next_close_usd": fitted_bundle_exclusive_ready.validation_absolute_error_mean,
        "residual_rmse_next_close_usd": fitted_bundle_exclusive_ready.residual_standard_error,
        "fitting_row_count_strict_pre_holdout_evaluation": fitted_bundle_exclusive_ready.training_observation_rows,
        "cv_fold_mae_values": fitted_bundle_exclusive_ready.cv_fold_mae_values or [],
        "cv_mean_mae": fitted_bundle_exclusive_ready.cv_mean_mae,
        "cv_std_mae": fitted_bundle_exclusive_ready.cv_std_mae,
    }

    if retrospective_log_mae_exclusive_bucket_float_resolution is not None:
        training_metrics_document_exclusive_dictionary_resolution[
            "retrospective_holdout_mean_absolute_error_next_close_usd"
        ] = retrospective_log_mae_exclusive_bucket_float_resolution

    persisted_model_uuid_identity_exclusive = persist_ml_registry_row(
        backend_base_url=backend_base_url_exclusive,
        admin_api_key=admin_key_exclusive,
        version_tag=version_tag_exclusive[:50],
        asset_id=asset_uuid_exclusive,
        model_type_slug=model_type_slug_exclusive,
        hyperparameter_document=hyper_document_exclusive_bundle_dictionary,
        training_metric_document=training_metrics_document_exclusive_dictionary_resolution,
        artifact_relative_path_on_disk=str(absolute_joblib_filepath_exclusive_resolution),
        activate_model=activate_exclusive,
        display_name=registry_display_name_exclusive,
    )

    for unstructured_retrospective_row_exclusive in retrospective_rows_exclusive_bucket_without_registry_foreign_key_exclusive:
        unstructured_retrospective_row_exclusive["model_id"] = persisted_model_uuid_identity_exclusive

    forward_exclusive_multi_step_rows_exclusive_bucket = build_compounded_horizon_prediction_rows_exclusive(
        asset_uuid_anchor_key_exclusive=asset_uuid_exclusive,
        registry_model_uuid_anchor_key_exclusive=persisted_model_uuid_identity_exclusive,
        forecast_calendar_anchor_exclusive=anchor_features_exclusive.index[-1],
        horizon_days_exclusive_budget=horizon_days_exclusive,
        anchored_forward_log_exclusive_float=terminal_predicted_forward_log_exclusive_float,
        sigma_residual_effective_exclusive_float=sigma_log_for_multi_step_compound_exclusive_float,
        reference_close_exclusive_float=scalar_terminal_reference_close_exclusive,
        confidence_interval_z_score_exclusive_float=forecast_ci_z_score_exclusive_float,
        band_log_half_width_cap_exclusive_float=forecast_band_log_half_width_cap_exclusive_float,
    )

    merged_exclusive_chronological_rows_exclusive_bundle = merge_retrospective_and_forward_prediction_rows(
        retrospective_rows_exclusive_bucket_without_registry_foreign_key_exclusive,
        forward_exclusive_multi_step_rows_exclusive_bucket,
    )

    forward_prediction_row_count_exclusive = len(forward_exclusive_multi_step_rows_exclusive_bucket)
    retrospective_prediction_row_count_exclusive = len(
        retrospective_rows_exclusive_bucket_without_registry_foreign_key_exclusive,
    )

    persist_prediction_batch_rows(
        backend_base_url=backend_base_url_exclusive,
        admin_api_key=admin_key_exclusive,
        prediction_rows=merged_exclusive_chronological_rows_exclusive_bundle,
    )

    response_summary_dictionary_exclusive = {
        "asset_id": asset_text_exclusive,
        "status": "trained",
        "model_id": str(persisted_model_uuid_identity_exclusive),
        "model_type_slug": model_type_slug_exclusive,
        "validation_mae_next_close_usd": fitted_bundle_exclusive_ready.validation_absolute_error_mean,
        "cv_mean_mae": fitted_bundle_exclusive_ready.cv_mean_mae,
        "cv_std_mae": fitted_bundle_exclusive_ready.cv_std_mae,
        "prediction_rows_written": len(merged_exclusive_chronological_rows_exclusive_bundle),
        "forward_prediction_rows_written": forward_prediction_row_count_exclusive,
        "retrospective_prediction_rows_written": retrospective_prediction_row_count_exclusive,
        "forecast_horizon_days": horizon_days_exclusive,
        "artifact_path": str(absolute_joblib_filepath_exclusive_resolution),
    }

    if retrospective_log_mae_exclusive_bucket_float_resolution is not None:
        response_summary_dictionary_exclusive[
            "retrospective_holdout_mean_absolute_error_next_close_usd"
        ] = retrospective_log_mae_exclusive_bucket_float_resolution

    return response_summary_dictionary_exclusive


def _train_ensemble_path(
    *,
    asset_text_exclusive: str,
    asset_uuid_exclusive: UUID,
    postgres_access_configuration_exclusive: PostgresAccessConfig,
    model_root_exclusive: Path,
    backend_base_url_exclusive: str,
    admin_key_exclusive: str,
    horizon_days_exclusive: int,
    forecast_log_sigma_floor_exclusive: float,
    forecast_ci_z_score_exclusive_float: float,
    version_tag_exclusive: str,
    activate_exclusive: bool,
    registry_display_name_exclusive: str | None,
    inclusive_training_data_calendar_cutoff_utc_yyyy_mm_dd_logged_exclusive: str | None = None,
) -> dict[str, Any]:
    """Fit and persist the dedicated transformed-feature ensemble model family."""

    with open_connection(postgres_access_configuration_exclusive) as connection_exclusive:
        feature_frame_exclusive, close_series_exclusive = build_ensemble_feature_matrix_for_asset_exclusive(
            connection=connection_exclusive,
            schema_name=postgres_access_configuration_exclusive.schema_name,
            asset_id=asset_uuid_exclusive,
        )

    if feature_frame_exclusive.empty:
        return {
            "asset_id": asset_text_exclusive,
            "status": "skipped",
            "detail": "No transformed feature rows available for ensemble_ocm.",
        }

    resolved_cutoff_exclusive: pd.Timestamp
    if inclusive_training_data_calendar_cutoff_utc_yyyy_mm_dd_logged_exclusive:
        try:
            resolved_cutoff_exclusive = _exclusive_calendar_cutoff_timestamp_from_literal_or_raise_exclusive(
                inclusive_training_data_calendar_cutoff_utc_yyyy_mm_dd_logged_exclusive,
            )
        except (ValueError, TypeError):
            return {
                "asset_id": asset_text_exclusive,
                "status": "failed",
                "detail": "maximum_training_feature_calendar_day_utc must be yyyy-mm-dd in UTC.",
            }
    else:
        inferred_last_feature_day_exclusive = pd.Timestamp(feature_frame_exclusive.index.max())
        if inferred_last_feature_day_exclusive.tzinfo is None:
            resolved_cutoff_exclusive = inferred_last_feature_day_exclusive.tz_localize("UTC").normalize()
        else:
            resolved_cutoff_exclusive = inferred_last_feature_day_exclusive.tz_convert("UTC").normalize()

    temporary_registry_placeholder_exclusive = uuid4()
    trained_outcome_exclusive = train_multi_step_ensemble_for_cutoff_exclusive(
        transformed_feature_frame_exclusive=feature_frame_exclusive,
        close_series_exclusive=close_series_exclusive,
        asset_id=asset_uuid_exclusive,
        model_id=temporary_registry_placeholder_exclusive,
        inclusive_cutoff_day_utc_exclusive=resolved_cutoff_exclusive,
        horizon_days_exclusive=horizon_days_exclusive,
        confidence_interval_z_score_exclusive=forecast_ci_z_score_exclusive_float,
        residual_sigma_floor_return_exclusive=max(forecast_log_sigma_floor_exclusive, 1e-6),
    )

    model_root_exclusive.mkdir(parents=True, exist_ok=True)
    asset_directory_exclusive = model_root_exclusive / str(asset_uuid_exclusive)
    asset_directory_exclusive.mkdir(parents=True, exist_ok=True)
    joblib_filename_exclusive = version_tag_exclusive.replace("/", "_") + ".joblib"
    absolute_artifact_path_exclusive = asset_directory_exclusive / joblib_filename_exclusive
    joblib.dump(trained_outcome_exclusive.artifact_payload, absolute_artifact_path_exclusive)

    per_horizon_mae_exclusive = list(trained_outcome_exclusive.mae_by_horizon.values())
    per_horizon_sigma_exclusive = list(trained_outcome_exclusive.residual_sigma_by_horizon.values())
    mean_horizon_mae_exclusive = float(np.mean(per_horizon_mae_exclusive)) if per_horizon_mae_exclusive else None
    mean_horizon_sigma_exclusive = (
        float(np.mean(per_horizon_sigma_exclusive)) if per_horizon_sigma_exclusive else None
    )

    hyperparameter_document_exclusive: dict[str, Any] = {
        "framework": "sklearn_voting_ridge_xgboost",
        "model_type_slug": "ensemble_ocm",
        "feature_source": "stationary_transformed_onchain_and_market_signals",
        "target_definition": "cumulative_percentage_return_from_cutoff_to_horizon_step",
        "model_target_space": "cumulative_return_ratio",
        "training_policy": "fit_on_all_rows_where_feature_day_lte_cutoff_without_train_test_split",
        "ensemble_components": {
            "linear_anchor": "Ridge(alpha=8.0)",
            "non_linear_engine": "XGBRegressor(max_depth=3)",
            "combiner": "VotingRegressor(weights=[0.45,0.55])",
        },
        "confidence_interval_method": "historical_residuals_scaled_by_sqrt_horizon",
        "forecast_horizon_days": horizon_days_exclusive,
        "forecast_ci_z_score": forecast_ci_z_score_exclusive_float,
        "residual_sigma_floor_return": max(forecast_log_sigma_floor_exclusive, 1e-6),
        "transformed_features": [
            "net_exchange_flow",
            "net_exchange_flow_ma7",
            "mvrv_ratio",
            "nvt_ratio",
            "active_addresses_growth_14d",
            "average_transaction_fee",
            "daily_volatility_14d",
            "distance_from_30d_ma",
            "momentum_7d",
            "momentum_30d",
        ],
        "training_rows_by_horizon": trained_outcome_exclusive.training_rows_by_horizon,
    }
    if inclusive_training_data_calendar_cutoff_utc_yyyy_mm_dd_logged_exclusive:
        hyperparameter_document_exclusive["training_data_calendar_cutoff_utc_day_inclusive"] = (
            inclusive_training_data_calendar_cutoff_utc_yyyy_mm_dd_logged_exclusive
        )

    training_metric_document_exclusive: dict[str, Any] = {
        "mean_mae_cumulative_return": mean_horizon_mae_exclusive,
        "mean_residual_sigma_cumulative_return": mean_horizon_sigma_exclusive,
        "mae_by_horizon": trained_outcome_exclusive.mae_by_horizon,
        "residual_sigma_by_horizon": trained_outcome_exclusive.residual_sigma_by_horizon,
        "forecast_anchor_day_iso8601_utc": trained_outcome_exclusive.forecast_anchor_day.isoformat(),
        "forecast_anchor_close_usd": trained_outcome_exclusive.forecast_anchor_close,
    }

    persisted_model_uuid_exclusive = persist_ml_registry_row(
        backend_base_url=backend_base_url_exclusive,
        admin_api_key=admin_key_exclusive,
        version_tag=version_tag_exclusive[:50],
        asset_id=asset_uuid_exclusive,
        model_type_slug="ensemble_ocm",
        hyperparameter_document=hyperparameter_document_exclusive,
        training_metric_document=training_metric_document_exclusive,
        artifact_relative_path_on_disk=str(absolute_artifact_path_exclusive),
        activate_model=activate_exclusive,
        display_name=registry_display_name_exclusive,
    )

    finalized_prediction_rows_exclusive = []
    for row_payload_exclusive in trained_outcome_exclusive.prediction_rows:
        copied_payload_exclusive = dict(row_payload_exclusive)
        copied_payload_exclusive["model_id"] = persisted_model_uuid_exclusive
        finalized_prediction_rows_exclusive.append(copied_payload_exclusive)

    persist_prediction_batch_rows(
        backend_base_url=backend_base_url_exclusive,
        admin_api_key=admin_key_exclusive,
        prediction_rows=finalized_prediction_rows_exclusive,
    )

    return {
        "asset_id": asset_text_exclusive,
        "status": "trained",
        "model_id": str(persisted_model_uuid_exclusive),
        "model_type_slug": "ensemble_ocm",
        "prediction_rows_written": len(finalized_prediction_rows_exclusive),
        "forward_prediction_rows_written": len(finalized_prediction_rows_exclusive),
        "retrospective_prediction_rows_written": 0,
        "forecast_horizon_days": horizon_days_exclusive,
        "artifact_path": str(absolute_artifact_path_exclusive),
        "mean_mae_cumulative_return": mean_horizon_mae_exclusive,
    }


def _train_lstm_path(
    *,
    asset_text_exclusive: str,
    asset_uuid_exclusive: UUID,
    training_features_exclusive: pd.DataFrame,
    training_targets_exclusive: pd.Series,
    sorted_full_features_exclusive: pd.DataFrame,
    sorted_full_targets_exclusive: pd.Series,
    sorted_full_closes_exclusive: pd.Series,
    anchor_features_exclusive: pd.DataFrame,
    anchor_closes_exclusive: pd.Series,
    outcome_dates_exclusive: pd.Series,
    retrospective_calendar_index_exclusive: pd.Index,
    model_root_exclusive: Path,
    backend_base_url_exclusive: str,
    admin_key_exclusive: str,
    horizon_days_exclusive: int,
    forecast_log_sigma_floor_exclusive: float,
    version_tag_exclusive: str,
    activate_exclusive: bool,
    holdout_enabled_exclusive: bool,
    metric_column_cap_exclusive: int,
    forecast_ci_z_score_exclusive_float: float,
    forecast_band_log_half_width_cap_exclusive_float: float,
    registry_display_name_exclusive: str | None,
    trainer_hyperparameters_dictionary_exclusive: dict[str, Any],
    persist_retrospective_holdout_predictions_exclusive: bool,
    inclusive_training_data_calendar_cutoff_utc_yyyy_mm_dd_logged_exclusive: str | None = None,
) -> dict[str, Any]:
    """Fit Torch LSTM artifacts mirroring segregation contracts established for sklearn estimators."""

    from app.services.lstm_pipeline import (
        lstm_artifact_dictionary_from_train_result,
        predict_lstm,
        save_lstm_artifact,
        train_lstm_for_asset,
    )

    lstm_trainer_kwargs_exclusive = partition_trainer_hyperparameters_for_lstm_exclusive(
        trainer_hyperparameters_dictionary_exclusive,
    )

    lstm_exclusive_train_finalize_outcome_exclusive = train_lstm_for_asset(
        training_features_exclusive,
        training_targets_exclusive,
        **lstm_trainer_kwargs_exclusive,
    )

    torch_filename_exclusive_fragment = version_tag_exclusive.replace("/", "_") + ".pt"

    asset_directory_exclusive_resolution = model_root_exclusive / str(asset_uuid_exclusive)

    asset_directory_exclusive_resolution.mkdir(parents=True, exist_ok=True)

    torch_absolute_filepath_exclusive_resolution = asset_directory_exclusive_resolution / torch_filename_exclusive_fragment

    save_lstm_artifact(lstm_exclusive_train_finalize_outcome_exclusive, torch_absolute_filepath_exclusive_resolution)

    raw_train_tail_sigma_exclusive = lstm_exclusive_train_finalize_outcome_exclusive.final_fold_residual_sigma

    scalar_reference_close_exclusive_float = float(
        anchor_closes_exclusive.iloc[-1],
    )

    effective_exclusive_sigma_usd_exclusive_float = float(
        max(
            raw_train_tail_sigma_exclusive,
            forecast_log_sigma_floor_exclusive * scalar_reference_close_exclusive_float,
        )
    )

    torch_inference_bundle_dictionary_exclusive = lstm_artifact_dictionary_from_train_result(
        lstm_exclusive_train_finalize_outcome_exclusive,
    )

    terminal_predicted_next_close_usd_exclusive_float = float(
        predict_lstm(torch_inference_bundle_dictionary_exclusive, anchor_features_exclusive.sort_index()),
    )

    terminal_forward_log_exclusive_float_prediction = float(
        np.log(
            max(terminal_predicted_next_close_usd_exclusive_float, 1e-12)
            / max(scalar_reference_close_exclusive_float, 1e-12),
        )
    )

    sigma_log_for_multi_step_compound_lstm_exclusive_float = float(
        max(
            raw_train_tail_sigma_exclusive / max(scalar_reference_close_exclusive_float, 1e-12),
            forecast_log_sigma_floor_exclusive,
        )
    )

    hyper_document_exclusive_resolution_dictionary = {
        "framework": "pytorch_lstm",
        "model_type_slug": "lstm_ocm",
        "lookback_window": lstm_exclusive_train_finalize_outcome_exclusive.lookback_window,
        "hidden_size": lstm_exclusive_train_finalize_outcome_exclusive.hidden_size,
        "num_layers": lstm_exclusive_train_finalize_outcome_exclusive.num_layers,
        "forecast_horizon_days": horizon_days_exclusive,
        "feature_source": "on_chain_metrics_daily_wide_lag_augmented",
        "prediction_target": "on_chain_price_usd_next_day_level",
        "model_target_space": "price_usd_next_calendar_close",
        "strict_holdout_precedes_eval_window_exclusive": holdout_enabled_exclusive,
        "max_onchain_metric_columns": metric_column_cap_exclusive,
        "multi_day_path_model": (
            "compound_daily_log_returns_from_implied_log_step: anchored_mu_log equals log(predicted_next_usd over reference_close); "
            "sigma_log_proxy equals max(rmse_usd_over_reference_close, configured_log_floor)."
        ),
        "forecast_volatility_calibration": {
            "next_close_residual_rmse_validation_usd": raw_train_tail_sigma_exclusive,
            "next_close_sigma_effective_usd": effective_exclusive_sigma_usd_exclusive_float,
            "log_sigma_proxy_used_for_compounded_path": sigma_log_for_multi_step_compound_lstm_exclusive_float,
            "log_volatility_effective_floor": forecast_log_sigma_floor_exclusive,
            "confidence_interval_gaussian_multiplier": forecast_ci_z_score_exclusive_float,
            "multi_day_log_band_half_width_cap": forecast_band_log_half_width_cap_exclusive_float,
        },
        "prediction_persistence_policy": {
            "retrospective_holdout_predictions_persisted": persist_retrospective_holdout_predictions_exclusive,
        },
    }

    if inclusive_training_data_calendar_cutoff_utc_yyyy_mm_dd_logged_exclusive:
        hyper_document_exclusive_resolution_dictionary["training_data_calendar_cutoff_utc_day_inclusive"] = (
            inclusive_training_data_calendar_cutoff_utc_yyyy_mm_dd_logged_exclusive
        )

    if trainer_hyperparameters_dictionary_exclusive:
        hyper_document_exclusive_resolution_dictionary["trainer_hyperparameters_submitted"] = (
            trainer_hyperparameters_dictionary_exclusive
        )
    if lstm_trainer_kwargs_exclusive:
        hyper_document_exclusive_resolution_dictionary["lstm_trainer_kwargs_effective"] = (
            lstm_trainer_kwargs_exclusive
        )

    if holdout_enabled_exclusive and len(retrospective_calendar_index_exclusive) > 0:
        hyper_document_exclusive_resolution_dictionary["calendar_retrospective_holdout_evaluation"] = {
            "first_settlement_outcome_iso8601_utc": outcome_dates_exclusive.loc[
                retrospective_calendar_index_exclusive,
            ].min().isoformat(),
            "last_settlement_outcome_iso8601_utc": outcome_dates_exclusive.loc[
                retrospective_calendar_index_exclusive,
            ].max().isoformat(),
        }

    retrospective_rows_without_model_key_exclusive: list[dict[str, Any]] = []

    retrospective_log_mae_resolution_float_exclusive: float | None = None

    if (
        persist_retrospective_holdout_predictions_exclusive
        and holdout_enabled_exclusive
        and len(retrospective_calendar_index_exclusive) > 0
    ):
        (
            retrospective_rows_without_model_key_exclusive,
            retrospective_log_mae_resolution_float_exclusive,
        ) = collect_retrospective_lstm_daily_rows_without_model_foreign_key(
            torch_inference_bundle_dictionary_exclusive,
            sorted_full_features_sorted_reference=sorted_full_features_exclusive,
            sorted_targets_sorted_reference=sorted_full_targets_exclusive,
            mapped_outcome_calendar_series_sorted_exclusive=outcome_dates_exclusive,
            retrospective_feature_calendar_anchor_index_exclusive=retrospective_calendar_index_exclusive,
            calibrated_log_return_sigma_residual_exclusive=effective_exclusive_sigma_usd_exclusive_float,
            confidence_interval_z_score_exclusive_float=forecast_ci_z_score_exclusive_float,
            asset_foreign_key_identity_exclusive=asset_uuid_exclusive,
        )

    training_metrics_exclusive_resolution_dictionary_exclusive = {
        "validation_mae_next_close_usd": lstm_exclusive_train_finalize_outcome_exclusive.final_fold_mae,
        "residual_rmse_next_close_usd": raw_train_tail_sigma_exclusive,
        "fitting_row_count_strict_pre_holdout_evaluation": lstm_exclusive_train_finalize_outcome_exclusive.training_rows,
        "best_val_mae": lstm_exclusive_train_finalize_outcome_exclusive.final_fold_mae,
        "total_epochs_run": len(lstm_exclusive_train_finalize_outcome_exclusive.epoch_val_mae_history),
    }

    if retrospective_log_mae_resolution_float_exclusive is not None:
        training_metrics_exclusive_resolution_dictionary_exclusive[
            "retrospective_holdout_mean_absolute_error_next_close_usd"
        ] = retrospective_log_mae_resolution_float_exclusive

    persisted_uuid_resolution_exclusive_identity = persist_ml_registry_row(
        backend_base_url=backend_base_url_exclusive,
        admin_api_key=admin_key_exclusive,
        version_tag=version_tag_exclusive[:50],
        asset_id=asset_uuid_exclusive,
        model_type_slug="lstm_ocm",
        hyperparameter_document=hyper_document_exclusive_resolution_dictionary,
        training_metric_document=training_metrics_exclusive_resolution_dictionary_exclusive,
        artifact_relative_path_on_disk=str(torch_absolute_filepath_exclusive_resolution),
        activate_model=activate_exclusive,
        display_name=registry_display_name_exclusive,
    )

    for row_without_model_exclusive in retrospective_rows_without_model_key_exclusive:
        row_without_model_exclusive["model_id"] = persisted_uuid_resolution_exclusive_identity

    forward_multi_step_rows_exclusive_bucket_resolution = build_compounded_horizon_prediction_rows_exclusive(
        asset_uuid_anchor_key_exclusive=asset_uuid_exclusive,
        registry_model_uuid_anchor_key_exclusive=persisted_uuid_resolution_exclusive_identity,
        forecast_calendar_anchor_exclusive=anchor_features_exclusive.index[-1],
        horizon_days_exclusive_budget=horizon_days_exclusive,
        anchored_forward_log_exclusive_float=terminal_forward_log_exclusive_float_prediction,
        sigma_residual_effective_exclusive_float=sigma_log_for_multi_step_compound_lstm_exclusive_float,
        reference_close_exclusive_float=scalar_reference_close_exclusive_float,
        confidence_interval_z_score_exclusive_float=forecast_ci_z_score_exclusive_float,
        band_log_half_width_cap_exclusive_float=forecast_band_log_half_width_cap_exclusive_float,
    )

    fused_chronological_bundle_exclusive = merge_retrospective_and_forward_prediction_rows(
        retrospective_rows_without_model_key_exclusive,
        forward_multi_step_rows_exclusive_bucket_resolution,
    )

    lstm_forward_row_count_exclusive = len(forward_multi_step_rows_exclusive_bucket_resolution)
    lstm_retrospective_row_count_exclusive = len(retrospective_rows_without_model_key_exclusive)

    persist_prediction_batch_rows(
        backend_base_url=backend_base_url_exclusive,
        admin_api_key=admin_key_exclusive,
        prediction_rows=fused_chronological_bundle_exclusive,
    )

    summary_return_dictionary_exclusive_resolution = {
        "asset_id": asset_text_exclusive,
        "status": "trained",
        "model_id": str(persisted_uuid_resolution_exclusive_identity),
        "model_type_slug": "lstm_ocm",
        "validation_mae_next_close_usd": lstm_exclusive_train_finalize_outcome_exclusive.final_fold_mae,
        "prediction_rows_written": len(fused_chronological_bundle_exclusive),
        "forward_prediction_rows_written": lstm_forward_row_count_exclusive,
        "retrospective_prediction_rows_written": lstm_retrospective_row_count_exclusive,
        "forecast_horizon_days": horizon_days_exclusive,
        "artifact_path": str(torch_absolute_filepath_exclusive_resolution),
    }

    if retrospective_log_mae_resolution_float_exclusive is not None:
        summary_return_dictionary_exclusive_resolution[
            "retrospective_holdout_mean_absolute_error_next_close_usd"
        ] = retrospective_log_mae_resolution_float_exclusive

    return summary_return_dictionary_exclusive_resolution


def build_compounded_horizon_prediction_rows_exclusive(
    *,
    asset_uuid_anchor_key_exclusive: UUID,
    registry_model_uuid_anchor_key_exclusive: UUID,
    forecast_calendar_anchor_exclusive: Any,
    horizon_days_exclusive_budget: int,
    anchored_forward_log_exclusive_float: float,
    sigma_residual_effective_exclusive_float: float,
    reference_close_exclusive_float: float,
    confidence_interval_z_score_exclusive_float: float,
    band_log_half_width_cap_exclusive_float: float,
) -> list[dict[str, Any]]:
    """Construct compounded multi-step path geometry leveraging shared sigma residuals.

    Band half-width in log-return space compounds as ``sqrt(step) * sigma * z`` alongside the midpoint path.
    When ``band_log_half_width_cap_exclusive_float`` is zero or positive, widening is capped at that many
    log units; negative values disable the cap entirely.
    """

    band_half_exclusive_width_log_residual = (
        sigma_residual_effective_exclusive_float * confidence_interval_z_score_exclusive_float
    )

    anchor_midnight_exclusive_anchor = datetime(
        forecast_calendar_anchor_exclusive.year,
        forecast_calendar_anchor_exclusive.month,
        forecast_calendar_anchor_exclusive.day,
        tzinfo=timezone.utc,
    )

    prediction_rows_exclusive_accumulator: list[dict[str, Any]] = []

    for step_index_exclusive in range(1, horizon_days_exclusive_budget + 1):
        forecast_timestamp_naive_exclusive = anchor_midnight_exclusive_anchor + timedelta(days=step_index_exclusive)

        multiplier_float_exclusive = float(step_index_exclusive)

        ito_exclusive_bias_log_accumulator = (
            0.5 * (sigma_residual_effective_exclusive_float ** 2) * multiplier_float_exclusive
        )

        cumulative_mid_log_exclusive_float = (
            multiplier_float_exclusive * anchored_forward_log_exclusive_float + ito_exclusive_bias_log_accumulator
        )

        widening_factor_sqrt_scaling_exclusive = (
            float(np.sqrt(multiplier_float_exclusive)) * band_half_exclusive_width_log_residual
        )

        if band_log_half_width_cap_exclusive_float >= 0.0:
            widening_factor_sqrt_scaling_exclusive = float(
                min(widening_factor_sqrt_scaling_exclusive, band_log_half_width_cap_exclusive_float)
            )

        predicted_level_exclusive_float = float(
            reference_close_exclusive_float * np.exp(cumulative_mid_log_exclusive_float),
        )

        high_fence_exclusive_float = float(
            reference_close_exclusive_float * np.exp(
                cumulative_mid_log_exclusive_float + widening_factor_sqrt_scaling_exclusive,
            ),
        )

        low_fence_exclusive_float = float(
            reference_close_exclusive_float * np.exp(
                cumulative_mid_log_exclusive_float - widening_factor_sqrt_scaling_exclusive,
            ),
        )

        prediction_rows_exclusive_accumulator.append(
            {
                "time": forecast_timestamp_naive_exclusive,
                "asset_id": asset_uuid_anchor_key_exclusive,
                "model_id": registry_model_uuid_anchor_key_exclusive,
                "predicted_value": predicted_level_exclusive_float,
                "confidence_interval_high": high_fence_exclusive_float,
                "confidence_interval_low": low_fence_exclusive_float,
                "horizon_step": step_index_exclusive,
            }
        )

    return prediction_rows_exclusive_accumulator
