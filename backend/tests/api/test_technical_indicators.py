"""Contract tests for ``/api/v1/technical-indicators``."""

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from tests.conftest import create_asset_admin, iso_range


def test_list_technical_indicators_requires_jwt(client: TestClient) -> None:
    time_from, time_to = iso_range()
    response = client.get(
        f"/api/v1/technical-indicators?asset_id={uuid.uuid4()}&time_from={time_from}&time_to={time_to}",
    )
    assert response.status_code == 401


def test_technical_indicators_batch_patch_delete(
    client: TestClient,
    admin_headers: dict[str, str],
    auth_headers: dict[str, str],
) -> None:
    asset = create_asset_admin(client, admin_headers)
    ts = datetime(2024, 4, 1, 0, 0, tzinfo=timezone.utc).isoformat()
    batch = client.post(
        "/api/v1/technical-indicators/batch",
        headers=admin_headers,
        json={
            "rows": [
                {
                    "time": ts,
                    "asset_id": asset["id"],
                    "indicator_name": "rsi_14",
                    "value": 55.5,
                }
            ]
        },
    )
    assert batch.status_code == 201
    patch = client.patch(
        "/api/v1/technical-indicators/row",
        headers=admin_headers,
        params={"time": ts, "asset_id": asset["id"], "indicator_name": "rsi_14"},
        json={"value": 60.0},
    )
    assert patch.status_code == 200
    assert patch.json()["value"] == 60.0
    delete = client.delete(
        "/api/v1/technical-indicators/row",
        headers=admin_headers,
        params={"time": ts, "asset_id": asset["id"], "indicator_name": "rsi_14"},
    )
    assert delete.status_code == 204


def test_technical_indicators_list_ok(
    client: TestClient,
    admin_headers: dict[str, str],
    auth_headers: dict[str, str],
) -> None:
    asset = create_asset_admin(client, admin_headers)
    time_from, time_to = iso_range()
    response = client.get(
        "/api/v1/technical-indicators",
        headers=auth_headers,
        params={
            "asset_id": asset["id"],
            "time_from": time_from,
            "time_to": time_to,
        },
    )
    assert response.status_code == 200
    assert "items" in response.json()
