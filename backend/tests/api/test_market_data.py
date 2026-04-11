"""Contract tests for ``/api/v1/market-data``."""

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from tests.conftest import create_asset_admin, iso_range


def test_list_market_data_requires_jwt(client: TestClient) -> None:
    time_from, time_to = iso_range()
    response = client.get(
        f"/api/v1/market-data?asset_id={uuid.uuid4()}&time_from={time_from}&time_to={time_to}",
    )
    assert response.status_code == 401


def test_list_market_data_validation(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.get("/api/v1/market-data", headers=auth_headers)
    assert response.status_code == 422


def test_market_data_batch_patch_delete(
    client: TestClient,
    admin_headers: dict[str, str],
    auth_headers: dict[str, str],
) -> None:
    asset = create_asset_admin(client, admin_headers)
    ts = datetime(2024, 3, 1, 0, 0, tzinfo=timezone.utc).isoformat()
    batch = client.post(
        "/api/v1/market-data/batch",
        headers=admin_headers,
        json={
            "rows": [
                {
                    "time": ts,
                    "asset_id": asset["id"],
                    "open": 1,
                    "high": 2,
                    "low": 0.5,
                    "close": 1.5,
                    "volume": 1000,
                    "resolution": "1d",
                }
            ]
        },
    )
    assert batch.status_code == 201
    patch = client.patch(
        "/api/v1/market-data/row",
        headers=admin_headers,
        params={"time": ts, "asset_id": asset["id"]},
        json={"close": 2.5},
    )
    assert patch.status_code == 200
    assert patch.json()["close"] == 2.5
    delete = client.delete(
        "/api/v1/market-data/row",
        headers=admin_headers,
        params={"time": ts, "asset_id": asset["id"]},
    )
    assert delete.status_code == 204


def test_market_data_batch_forbidden_without_admin(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.post(
        "/api/v1/market-data/batch",
        headers=auth_headers,
        json={"rows": []},
    )
    assert response.status_code == 403
