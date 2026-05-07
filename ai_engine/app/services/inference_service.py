"""Synchronous inference using persisted joblib or torch artifacts and Postgres feature alignment."""

from __future__ import annotations

from pathlib import Path
from typing import Any
from uuid import UUID

import joblib
import numpy as np

from app.db.postgres_accessor import (
    PostgresAccessConfig,
    fetch_ml_model_registration,
    load_market_data_daily_frame,
    open_connection,
)
from app.core.config import settings
from app.services.feature_matrix_builder import (
    build_latest_feature_row_for_inference,
    build_market_data_feature_block,
    resolve_reference_close_on_anchor_day_for_inference,
)
from app.services.ensemble_pipeline import (
    build_ensemble_feature_matrix_for_asset_exclusive,
    predict_one_step_from_ensemble_artifact_exclusive,
)
from app.services.training_pipeline import revive_bundle_from_disk

def _is_torch_artifact_path(filesystem_path: Path) -> bool:
    """Return True when the artifact file extension signals a PyTorch save file."""
    return filesystem_path.suffix.lower() == ".pt"


def _load_market_block_safe(
    *,
    access_configuration: Any,
    schema_fragment: str,
    asset_uuid_literal: UUID,
) -> "pd.DataFrame":
    """Load market-data OHLCV features on a fresh connection; return empty DataFrame on any failure."""
    import pandas as pd

    try:
        with open_connection(access_configuration) as md_conn_exclusive:
            raw_md_exclusive = load_market_data_daily_frame(
                connection=md_conn_exclusive,
                schema_name=schema_fragment,
                asset_id=asset_uuid_literal,
            )
        return build_market_data_feature_block(raw_md_exclusive)
    except Exception:
        return pd.DataFrame()


def predict_for_registered_model_blocking(
    *,
    database_url_sync: str,
    schema_fragment: str,
    ssl_toggle: bool,
    model_uuid: UUID,
) -> dict[str, Any]:
    """Rebuild on-chain features, align latest ``PriceUSD`` anchor, emit next-step estimate in price space.

    Dispatches to the sklearn pipeline path for joblib artifacts and to the LSTM inference path
    for PyTorch ``.pt`` artifacts, identified by file extension.
    """

    access_configuration = PostgresAccessConfig(
        sync_database_url=database_url_sync,
        schema_name=schema_fragment,
        ssl_enabled=ssl_toggle,
    )

    model_identifier_text = str(model_uuid)

    with open_connection(access_configuration) as connection:
        registration_row = fetch_ml_model_registration(config=access_configuration, model_id=model_uuid)
        if registration_row is None:
            raise ValueError("model_id is not present in ml_models")

        asset_reference = registration_row.get("asset_id")
        if asset_reference is None:
            raise ValueError("This model is not scoped to an asset")

        filesystem_path_literal = registration_row.get("file_path")
        if not filesystem_path_literal or not str(filesystem_path_literal).strip():
            raise ValueError("Model registry row lacks file_path")

        artifact_absolute_path = Path(str(filesystem_path_literal)).expanduser().resolve()
        asset_uuid_literal = UUID(str(asset_reference))

        if _is_torch_artifact_path(artifact_absolute_path):
            return _predict_lstm_path(
                connection=connection,
                access_configuration=access_configuration,
                schema_fragment=schema_fragment,
                asset_uuid_literal=asset_uuid_literal,
                artifact_absolute_path=artifact_absolute_path,
                model_identifier_text=model_identifier_text,
            )

        return _predict_sklearn_path(
            connection=connection,
            access_configuration=access_configuration,
            schema_fragment=schema_fragment,
            asset_uuid_literal=asset_uuid_literal,
            artifact_absolute_path=artifact_absolute_path,
            model_identifier_text=model_identifier_text,
        )


def _predict_sklearn_path(
    *,
    connection: Any,
    access_configuration: Any,
    schema_fragment: str,
    asset_uuid_literal: UUID,
    artifact_absolute_path: Path,
    model_identifier_text: str,
) -> dict[str, Any]:
    """Run inference via a joblib-serialised sklearn Pipeline."""

    hydrated_blob = joblib.load(artifact_absolute_path)
    if isinstance(hydrated_blob, dict) and hydrated_blob.get("artifact_kind") == "ensemble_multi_step":
        return _predict_ensemble_path(
            connection=connection,
            schema_fragment=schema_fragment,
            asset_uuid_literal=asset_uuid_literal,
            model_identifier_text=model_identifier_text,
            artifact_payload_exclusive=hydrated_blob,
        )
    restored_bundle = revive_bundle_from_disk(hydrated_blob)

    inference_market_block_exclusive = _load_market_block_safe(
        access_configuration=access_configuration,
        schema_fragment=schema_fragment,
        asset_uuid_literal=asset_uuid_literal,
    )

    latest_aligned_row = build_latest_feature_row_for_inference(
        connection=connection,
        schema_name=schema_fragment,
        asset_id=asset_uuid_literal,
        ordered_feature_columns=restored_bundle.feature_column_order,
        external_market_feature_block=inference_market_block_exclusive,
    )

    reshaped_inference_matrix = latest_aligned_row.to_frame().T.astype(float)

    raw_model_output_scalar = float(restored_bundle.pipeline.predict(reshaped_inference_matrix)[0])
    model_target_space_literal = str(getattr(restored_bundle, "model_target_space", "log_return"))

    anchor_day_marker = latest_aligned_row.name
    if hasattr(anchor_day_marker, "strftime"):
        anchor_calendar_label = anchor_day_marker.strftime("%Y-%m-%d")
    else:
        anchor_calendar_label = str(anchor_day_marker)

    reference_close_before_extension = resolve_reference_close_on_anchor_day_for_inference(
        connection=connection,
        schema_name=schema_fragment,
        asset_id=asset_uuid_literal,
        feature_anchor_day_marker=anchor_day_marker,
    )

    residual_sigma_raw = float(restored_bundle.residual_standard_error)
    confidence_z = float(settings.TRAIN_FORECAST_CI_Z_SCORE)

    if model_target_space_literal == "next_close_usd":
        predicted_next_close_mid = raw_model_output_scalar
        sigma_usd_band_half_width = residual_sigma_raw * confidence_z
        predicted_next_close_high_ci = float(predicted_next_close_mid + sigma_usd_band_half_width)
        predicted_next_close_low_ci = float(max(predicted_next_close_mid - sigma_usd_band_half_width, 1e-9))
        predicted_log_forward_return_one_day = float(
            np.log(predicted_next_close_mid / max(reference_close_before_extension, 1e-12)),
        )
        reference_close_positive = max(reference_close_before_extension, 1e-12)
        sigma_log_return_component = float(
            sigma_usd_band_half_width / reference_close_positive,
        )
    else:
        predicted_log_forward_return_one_day = raw_model_output_scalar
        sigma_log_return_component = residual_sigma_raw * confidence_z
        log_high_forward = predicted_log_forward_return_one_day + sigma_log_return_component
        log_low_forward = predicted_log_forward_return_one_day - sigma_log_return_component
        predicted_next_close_mid = float(
            reference_close_before_extension * np.exp(predicted_log_forward_return_one_day)
        )
        predicted_next_close_high_ci = float(reference_close_before_extension * np.exp(log_high_forward))
        predicted_next_close_low_ci = float(reference_close_before_extension * np.exp(log_low_forward))

    confidence_proxy = float(
        np.clip(
            1.0 / (1.0 + abs(float(sigma_log_return_component)) * 3.5),
            0.05,
            0.995,
        )
    )

    return {
        "model_id": model_identifier_text,
        "asset_id": str(asset_uuid_literal),
        "latest_feature_calendar_day_label": anchor_calendar_label,
        "reference_price_usd_on_feature_day": reference_close_before_extension,
        "predicted_log_forward_return_one_day": predicted_log_forward_return_one_day,
        "predicted_next_close_mid": predicted_next_close_mid,
        "predicted_next_close_high_ci": predicted_next_close_high_ci,
        "predicted_next_close_low_ci": predicted_next_close_low_ci,
        "prediction_confidence_proxy": confidence_proxy,
        "reference_interval_log_forward_return_band": float(sigma_log_return_component),
    }


def _predict_ensemble_path(
    *,
    connection: Any,
    schema_fragment: str,
    asset_uuid_literal: UUID,
    model_identifier_text: str,
    artifact_payload_exclusive: dict[str, Any],
) -> dict[str, Any]:
    """Run one-step inference for the dedicated ensemble_ocm artifact shape."""

    feature_frame_exclusive, close_series_exclusive = build_ensemble_feature_matrix_for_asset_exclusive(
        connection=connection,
        schema_name=schema_fragment,
        asset_id=asset_uuid_literal,
    )
    if feature_frame_exclusive.empty:
        raise ValueError("No transformed feature rows are available for ensemble_ocm inference.")

    latest_feature_row_exclusive = feature_frame_exclusive.sort_index().iloc[-1]
    latest_anchor_day_exclusive = latest_feature_row_exclusive.name
    latest_close_series_exclusive = close_series_exclusive.reindex(feature_frame_exclusive.index).sort_index()
    reference_close_exclusive = float(latest_close_series_exclusive.loc[latest_anchor_day_exclusive])

    predicted_dictionary_exclusive = predict_one_step_from_ensemble_artifact_exclusive(
        artifact_payload_exclusive=artifact_payload_exclusive,
        latest_feature_row_exclusive=latest_feature_row_exclusive,
        reference_close_usd_exclusive=reference_close_exclusive,
    )

    anchor_calendar_label_exclusive = (
        latest_anchor_day_exclusive.strftime("%Y-%m-%d")
        if hasattr(latest_anchor_day_exclusive, "strftime")
        else str(latest_anchor_day_exclusive)
    )

    return {
        "model_id": model_identifier_text,
        "asset_id": str(asset_uuid_literal),
        "latest_feature_calendar_day_label": anchor_calendar_label_exclusive,
        "reference_price_usd_on_feature_day": reference_close_exclusive,
        "predicted_log_forward_return_one_day": predicted_dictionary_exclusive["predicted_log_forward_return_one_day"],
        "predicted_next_close_mid": predicted_dictionary_exclusive["predicted_next_close_mid"],
        "predicted_next_close_high_ci": predicted_dictionary_exclusive["predicted_next_close_high_ci"],
        "predicted_next_close_low_ci": predicted_dictionary_exclusive["predicted_next_close_low_ci"],
        "prediction_confidence_proxy": predicted_dictionary_exclusive["prediction_confidence_proxy"],
        "reference_interval_log_forward_return_band": predicted_dictionary_exclusive[
            "reference_interval_log_forward_return_band"
        ],
    }


def _predict_lstm_path(
    *,
    connection: Any,
    access_configuration: Any,
    schema_fragment: str,
    asset_uuid_literal: UUID,
    artifact_absolute_path: Path,
    model_identifier_text: str,
) -> dict[str, Any]:
    """Run inference via a torch.save LSTM artifact."""

    from app.services.lstm_pipeline import load_lstm_artifact, predict_lstm

    artifact_dict = load_lstm_artifact(artifact_absolute_path)
    feature_column_order: list[str] = list(artifact_dict["feature_column_order"])
    lookback_window: int = int(artifact_dict["lookback_window"])

    from app.db.postgres_accessor import load_on_chain_long_frame
    from app.services.feature_matrix_builder import (
        pivot_on_chain_daily,
        _shift_price_derived_columns_one_day,
        augment_with_temporal_features,
    )

    long_frame = load_on_chain_long_frame(
        connection=connection,
        schema_name=schema_fragment,
        asset_id=asset_uuid_literal,
    )
    if long_frame.empty:
        raise ValueError("No on-chain observations available for this asset")

    wide_on_chain = pivot_on_chain_daily(long_frame)
    wide_on_chain = _shift_price_derived_columns_one_day(wide_on_chain)
    base_cols = list(wide_on_chain.columns)
    wide_on_chain = augment_with_temporal_features(wide_on_chain, base_cols)

    lstm_market_block_exclusive = _load_market_block_safe(
        access_configuration=access_configuration,
        schema_fragment=schema_fragment,
        asset_uuid_literal=asset_uuid_literal,
    )
    if not lstm_market_block_exclusive.empty:
        wide_on_chain = wide_on_chain.join(lstm_market_block_exclusive, how="left")

    feature_history_frame = wide_on_chain.reindex(columns=feature_column_order).sort_index()

    if len(feature_history_frame) < lookback_window:
        raise ValueError(
            f"LSTM inference requires {lookback_window} rows of history; "
            f"only {len(feature_history_frame)} available."
        )

    predicted_raw_output_float = predict_lstm(artifact_dict, feature_history_frame)

    model_target_space_literal = str(artifact_dict.get("model_target_space", "log_return"))

    anchor_day_marker = feature_history_frame.index.max()
    if hasattr(anchor_day_marker, "strftime"):
        anchor_calendar_label = anchor_day_marker.strftime("%Y-%m-%d")
    else:
        anchor_calendar_label = str(anchor_day_marker)

    reference_close_before_extension = resolve_reference_close_on_anchor_day_for_inference(
        connection=connection,
        schema_name=schema_fragment,
        asset_id=asset_uuid_literal,
        feature_anchor_day_marker=anchor_day_marker,
    )

    sigma_residual = float(artifact_dict.get("residual_sigma", 0.02))
    confidence_z = float(settings.TRAIN_FORECAST_CI_Z_SCORE)

    if model_target_space_literal == "next_close_usd":
        predicted_next_close_mid = float(predicted_raw_output_float)
        sigma_usd_band_half_width = sigma_residual * confidence_z
        predicted_next_close_high_ci = float(predicted_next_close_mid + sigma_usd_band_half_width)
        predicted_next_close_low_ci = float(max(predicted_next_close_mid - sigma_usd_band_half_width, 1e-9))
        predicted_log_forward_return_one_day = float(
            np.log(predicted_next_close_mid / max(reference_close_before_extension, 1e-12)),
        )
        reference_close_positive = max(reference_close_before_extension, 1e-12)
        sigma_log_return_component = float(sigma_usd_band_half_width / reference_close_positive)
    else:
        predicted_log_forward_return_one_day = float(predicted_raw_output_float)
        sigma_log_return_component = sigma_residual * confidence_z
        log_high_forward = predicted_log_forward_return_one_day + sigma_log_return_component
        log_low_forward = predicted_log_forward_return_one_day - sigma_log_return_component
        predicted_next_close_mid = float(
            reference_close_before_extension * np.exp(predicted_log_forward_return_one_day)
        )
        predicted_next_close_high_ci = float(reference_close_before_extension * np.exp(log_high_forward))
        predicted_next_close_low_ci = float(reference_close_before_extension * np.exp(log_low_forward))

    confidence_proxy = float(
        np.clip(
            1.0 / (1.0 + abs(float(sigma_log_return_component)) * 3.5),
            0.05,
            0.995,
        )
    )

    return {
        "model_id": model_identifier_text,
        "asset_id": str(asset_uuid_literal),
        "latest_feature_calendar_day_label": anchor_calendar_label,
        "reference_price_usd_on_feature_day": reference_close_before_extension,
        "predicted_log_forward_return_one_day": predicted_log_forward_return_one_day,
        "predicted_next_close_mid": predicted_next_close_mid,
        "predicted_next_close_high_ci": predicted_next_close_high_ci,
        "predicted_next_close_low_ci": predicted_next_close_low_ci,
        "prediction_confidence_proxy": confidence_proxy,
        "reference_interval_log_forward_return_band": float(sigma_log_return_component),
    }
