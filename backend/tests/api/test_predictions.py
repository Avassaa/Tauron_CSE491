"""Contract tests for ``/api/v1/predictions`` (range GET, admin writes)."""

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from tests.conftest import create_asset_admin, create_ml_model_admin, iso_range


def test_list_predictions_requires_jwt(client: TestClient) -> None:
    time_from, time_to = iso_range()
    response = client.get(
        f"/api/v1/predictions?asset_id={uuid.uuid4()}&time_from={time_from}&time_to={time_to}",
    )
    assert response.status_code == 401


def test_list_predictions_requires_query_params(client: TestClient, auth_headers: dict[str, str]) -> None:
    """Missing required query params yields 422."""
    response = client.get("/api/v1/predictions", headers=auth_headers)
    assert response.status_code == 422


def test_list_predictions_empty_range(
    client: TestClient,
    admin_headers: dict[str, str],
    auth_headers: dict[str, str],
) -> None:
    """Valid range returns paginated list (may be empty)."""
    asset = create_asset_admin(client, admin_headers)
    time_from, time_to = iso_range()
    response = client.get(
        "/api/v1/predictions",
        headers=auth_headers,
        params={
            "asset_id": asset["id"],
            "time_from": time_from,
            "time_to": time_to,
            "page": 1,
            "page_size": 20,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert set(data.keys()) == {"items", "total", "page", "page_size"}


def test_batch_and_row_patch_delete_predictions(
    client: TestClient,
    admin_headers: dict[str, str],
    auth_headers: dict[str, str],
) -> None:
    """Admin inserts batch; PATCH and DELETE row by query composite key."""
    asset = create_asset_admin(client, admin_headers)
    model = create_ml_model_admin(client, admin_headers, asset_id=asset["id"])
    ts = datetime(2024, 6, 15, 12, 0, tzinfo=timezone.utc).isoformat()
    batch = client.post(
        "/api/v1/predictions/batch",
        headers=admin_headers,
        json={
            "rows": [
                {
                    "time": ts,
                    "asset_id": asset["id"],
                    "model_id": model["id"],
                    "predicted_value": 1.23,
                    "confidence_interval_high": 2.0,
                    "confidence_interval_low": 0.5,
                }
            ]
        },
    )
    assert batch.status_code == 201
    assert batch.json()["inserted"] == 1
    patch = client.patch(
        "/api/v1/predictions/row",
        headers=admin_headers,
        params={"time": ts, "asset_id": asset["id"], "model_id": model["id"]},
        json={"predicted_value": 9.99},
    )
    assert patch.status_code == 200
    assert patch.json()["predicted_value"] == 9.99
    delete = client.delete(
        "/api/v1/predictions/row",
        headers=admin_headers,
        params={"time": ts, "asset_id": asset["id"], "model_id": model["id"]},
    )
    assert delete.status_code == 204


def test_batch_predictions_forbidden_for_jwt_only(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.post(
        "/api/v1/predictions/batch",
        headers=auth_headers,
        json={"rows": []},
    )
    assert response.status_code == 403
