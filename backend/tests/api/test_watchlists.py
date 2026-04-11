"""Contract tests for ``/api/v1/users/me/watchlist``."""

import uuid

import pytest
from fastapi.testclient import TestClient

from tests.conftest import create_asset_admin


def test_list_watchlist_requires_jwt(client: TestClient) -> None:
    response = client.get("/api/v1/users/me/watchlist")
    assert response.status_code == 401


def test_add_list_remove_watchlist(
    client: TestClient,
    admin_headers: dict[str, str],
    auth_headers: dict[str, str],
) -> None:
    """PUT adds asset to watchlist; GET lists it; DELETE removes."""
    asset = create_asset_admin(client, admin_headers)
    asset_id = asset["id"]
    put = client.put(
        f"/api/v1/users/me/watchlist/{asset_id}",
        headers=auth_headers,
    )
    assert put.status_code == 204
    listed = client.get("/api/v1/users/me/watchlist", headers=auth_headers)
    assert listed.status_code == 200
    rows = listed.json()
    assert len(rows) >= 1
    assert rows[0]["asset"]["id"] == asset_id
    delete = client.delete(
        f"/api/v1/users/me/watchlist/{asset_id}",
        headers=auth_headers,
    )
    assert delete.status_code == 204
    empty = client.get("/api/v1/users/me/watchlist", headers=auth_headers)
    ids = [r["asset"]["id"] for r in empty.json()]
    assert asset_id not in ids


def test_put_watchlist_unknown_asset_404(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.put(
        f"/api/v1/users/me/watchlist/{uuid.uuid4()}",
        headers=auth_headers,
    )
    assert response.status_code == 404


def test_delete_watchlist_not_found_returns_404(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.delete(
        f"/api/v1/users/me/watchlist/{uuid.uuid4()}",
        headers=auth_headers,
    )
    assert response.status_code == 404


def test_put_watchlist_idempotent(
    client: TestClient,
    admin_headers: dict[str, str],
    auth_headers: dict[str, str],
) -> None:
    """Second PUT when already watching still returns 204."""
    asset = create_asset_admin(client, admin_headers)
    aid = asset["id"]
    client.put(f"/api/v1/users/me/watchlist/{aid}", headers=auth_headers)
    again = client.put(f"/api/v1/users/me/watchlist/{aid}", headers=auth_headers)
    assert again.status_code == 204
