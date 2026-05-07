"""Synchronous inference using persisted joblib or torch artifacts and Postgres feature alignment."""

from __future__ import annotations

from pathlib import Path
from typing import Any
from uuid import UUID

import joblib
import numpy as np

from app.db.postgres_accessor import PostgresAccessConfig, fetch_ml_model_registration, open_connection
from app.core.config import settings
from app.services.feature_matrix_builder import (
    build_latest_feature_row_for_inference,
    resolve_reference_close_on_anchor_day_for_inference,
)
from app.services.training_pipeline import revive_bundle_from_disk

def _is_torch_artifact_path(filesystem_path: Path) -> bool:
    """Return True when the artifact file extension signals a PyTorch save file."""
    return filesystem_path.suffix.lower() == ".pt"


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
    restored_bundle = revive_bundle_from_disk(hydrated_blob)

    latest_aligned_row = build_latest_feature_row_for_inference(
        connection=connection,
        schema_name=schema_fragment,
        asset_id=asset_uuid_literal,
        ordered_feature_columns=restored_bundle.feature_column_order,
    )

    reshaped_inference_matrix = latest_aligned_row.to_frame().T.astype(float)

    predicted_log_forward_return_one_day = float(restored_bundle.pipeline.predict(reshaped_inference_matrix)[0])
    sigma_log_return_component = restored_bundle.residual_standard_error * float(settings.TRAIN_FORECAST_CI_Z_SCORE)

    log_high_forward = predicted_log_forward_return_one_day + sigma_log_return_component
    log_low_forward = predicted_log_forward_return_one_day - sigma_log_return_component

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

    feature_history_frame = wide_on_chain.reindex(columns=feature_column_order).sort_index()

    if len(feature_history_frame) < lookback_window:
        raise ValueError(
            f"LSTM inference requires {lookback_window} rows of history; "
            f"only {len(feature_history_frame)} available."
        )

    predicted_log_forward_return_one_day = predict_lstm(artifact_dict, feature_history_frame)

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
    sigma_log_return_component = sigma_residual * float(settings.TRAIN_FORECAST_CI_Z_SCORE)

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
