"""Synchronous inference using persisted joblib payloads and Postgres feature alignment."""

from __future__ import annotations

from pathlib import Path
from typing import Any
from uuid import UUID

import joblib
import numpy as np

from app.db.postgres_accessor import PostgresAccessConfig, fetch_ml_model_registration, open_connection
from app.services.feature_matrix_builder import (
    build_latest_feature_row_for_inference,
    resolve_reference_close_on_anchor_day_for_inference,
)
from app.services.training_pipeline import revive_bundle_from_disk


def predict_for_registered_model_blocking(
    *,
    database_url_sync: str,
    schema_fragment: str,
    ssl_toggle: bool,
    model_uuid: UUID,
) -> dict[str, Any]:
    """Rebuild on-chain features, align latest daily close, emit next-close estimate in price space."""

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

        hydrated_blob = joblib.load(artifact_absolute_path)
        restored_bundle = revive_bundle_from_disk(hydrated_blob)

        asset_uuid_literal = UUID(str(asset_reference))

        latest_aligned_row = build_latest_feature_row_for_inference(
            connection=connection,
            schema_name=schema_fragment,
            asset_id=asset_uuid_literal,
            ordered_feature_columns=restored_bundle.feature_column_order,
        )

        reshaped_inference_matrix = latest_aligned_row.to_frame().T.astype(float)

        predicted_log_forward_return_one_day = float(restored_bundle.pipeline.predict(reshaped_inference_matrix)[0])
        sigma_log_return_component = restored_bundle.residual_standard_error * 1.96

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
        "reference_market_close_on_feature_day": reference_close_before_extension,
        "predicted_log_forward_return_one_day": predicted_log_forward_return_one_day,
        "predicted_next_close_mid": predicted_next_close_mid,
        "predicted_next_close_high_ci": predicted_next_close_high_ci,
        "predicted_next_close_low_ci": predicted_next_close_low_ci,
        "prediction_confidence_proxy": confidence_proxy,
        "reference_interval_log_forward_return_band": float(sigma_log_return_component),
    }
