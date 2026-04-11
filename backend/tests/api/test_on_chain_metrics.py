"""Contract tests for ``/api/v1/on-chain-metrics``."""

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from tests.conftest import create_asset_admin, iso_range


def test_list_on_chain_metrics_requires_jwt(client: TestClient) -> None:
    time_from, time_to = iso_range()
    response = client.get(
        f"/api/v1/on-chain-metrics?asset_id={uuid.uuid4()}&time_from={time_from}&time_to={time_to}",
    )
    assert response.status_code == 401


def test_on_chain_batch_patch_delete(
    client: TestClient,
    admin_headers: dict[str, str],
    auth_headers: dict[str, str],
) -> None:
    asset = create_asset_admin(client, admin_headers)
    ts = datetime(2024, 5, 1, 0, 0, tzinfo=timezone.utc).isoformat()
    batch = client.post(
        "/api/v1/on-chain-metrics/batch",
        headers=admin_headers,
        json={
            "rows": [
                {
                    "time": ts,
                    "asset_id": asset["id"],
                    "metric_name": "active_addresses",
                    "value": 12345.0,
                }
            ]
        },
    )
    assert batch.status_code == 201
    patch = client.patch(
        "/api/v1/on-chain-metrics/row",
        headers=admin_headers,
        params={"time": ts, "asset_id": asset["id"], "metric_name": "active_addresses"},
        json={"value": 20000.0},
    )
    assert patch.status_code == 200
    delete = client.delete(
        "/api/v1/on-chain-metrics/row",
        headers=admin_headers,
        params={"time": ts, "asset_id": asset["id"], "metric_name": "active_addresses"},
    )
    assert delete.status_code == 204


def test_on_chain_list_ok(
    client: TestClient,
    admin_headers: dict[str, str],
    auth_headers: dict[str, str],
) -> None:
    asset = create_asset_admin(client, admin_headers)
    time_from, time_to = iso_range()
    response = client.get(
        "/api/v1/on-chain-metrics",
        headers=auth_headers,
        params={"asset_id": asset["id"], "time_from": time_from, "time_to": time_to},
    )
    assert response.status_code == 200
    assert "total" in response.json()
