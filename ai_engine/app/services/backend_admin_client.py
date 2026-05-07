"""HTTP client mutations against backend admin ingestion routes."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import httpx


def persist_ml_registry_row(
    *,
    backend_base_url: str,
    admin_api_key: str,
    version_tag: str,
    asset_id: UUID,
    model_type_slug: str,
    hyperparameter_document: dict[str, Any],
    training_metric_document: dict[str, Any],
    artifact_relative_path_on_disk: str,
    activate_model: bool,
    display_name: str | None = None,
) -> UUID:
    """
    POST a new ML model registry entry and return the issued primary identifier.

    ``artifact_relative_path_on_disk`` mirrors what is persisted into ``ml_models.file_path``.
    """
    normalized_base = backend_base_url.rstrip("/")
    url = f"{normalized_base}/api/v1/ml-models"
    headers = {"X-Admin-Key": admin_api_key}
    payload = {
        "version_tag": version_tag,
        "asset_id": str(asset_id),
        "model_type": model_type_slug,
        "hyperparameters": hyperparameter_document,
        "training_metrics": training_metric_document,
        "file_path": artifact_relative_path_on_disk,
        "is_active": activate_model,
    }
    trimmed_label = display_name.strip() if display_name and display_name.strip() else ""
    if trimmed_label:
        payload["display_name"] = trimmed_label[:120]
    with httpx.Client(timeout=120.0) as client:
        response = client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        body = response.json()
    return UUID(str(body["id"]))


def persist_prediction_batch_rows(
    *,
    backend_base_url: str,
    admin_api_key: str,
    prediction_rows: list[dict[str, Any]],
) -> int:
    """POST many forecast rows to the backend Timescale writer."""
    if not prediction_rows:
        return 0
    normalized_base = backend_base_url.rstrip("/")
    url = f"{normalized_base}/api/v1/predictions/batch"
    headers = {"X-Admin-Key": admin_api_key}
    serializable_rows: list[dict[str, Any]] = []
    for row in prediction_rows:
        time_value = row["time"]
        if isinstance(time_value, datetime):
            if time_value.tzinfo is None:
                time_value = time_value.replace(tzinfo=timezone.utc)
            else:
                time_value = time_value.astimezone(timezone.utc)
            time_string = time_value.isoformat().replace("+00:00", "Z")
        else:
            time_string = str(time_value)

        serialized = {
            "time": time_string,
            "asset_id": str(row["asset_id"]),
            "model_id": str(row["model_id"]),
            "predicted_value": float(row["predicted_value"]),
        }
        if row.get("confidence_interval_high") is not None:
            serialized["confidence_interval_high"] = float(row["confidence_interval_high"])
        if row.get("confidence_interval_low") is not None:
            serialized["confidence_interval_low"] = float(row["confidence_interval_low"])
        serializable_rows.append(serialized)

    request_body = {"rows": serializable_rows}
    with httpx.Client(timeout=120.0) as client:
        response = client.post(url, json=request_body, headers=headers)
        response.raise_for_status()
        insertion_payload = response.json()
    inserted = insertion_payload.get("inserted") if isinstance(insertion_payload, dict) else None
    return int(inserted) if inserted is not None else len(prediction_rows)
