"""Contract tests for ``/api/v1/assets`` (JWT read, admin write)."""

import uuid

import pytest
from fastapi.testclient import TestClient

from tests.conftest import create_asset_admin


def test_list_assets_requires_jwt(client: TestClient) -> None:
    """Listing assets without token returns 401."""
    response = client.get("/api/v1/assets")
    assert response.status_code == 401


def test_list_assets_returns_paginated_shape(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    """List response includes items, total, page, page_size."""
    response = client.get("/api/v1/assets?page=1&page_size=10", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert set(data.keys()) == {"items", "total", "page", "page_size"}
    assert isinstance(data["items"], list)


def test_create_asset_requires_admin_key(client: TestClient, auth_headers: dict[str, str]) -> None:
    """JWT alone cannot POST assets (403 without admin key)."""
    sym = f"X{uuid.uuid4().hex[:8].upper()}"
    response = client.post(
        "/api/v1/assets",
        headers=auth_headers,
        json={"symbol": sym, "name": "No Admin", "is_active": True},
    )
    assert response.status_code == 403


def test_admin_create_get_patch_delete_asset(
    client: TestClient,
    admin_headers: dict[str, str],
    auth_headers: dict[str, str],
) -> None:
    """Admin creates asset; JWT can read; admin patches and deletes."""
    created = create_asset_admin(client, admin_headers)
    asset_id = created["id"]
    get_one = client.get(f"/api/v1/assets/{asset_id}", headers=auth_headers)
    assert get_one.status_code == 200
    assert get_one.json()["symbol"] == created["symbol"]
    patch = client.patch(
        f"/api/v1/assets/{asset_id}",
        headers=admin_headers,
        json={"name": "Updated Name"},
    )
    assert patch.status_code == 200
    assert patch.json()["name"] == "Updated Name"
    delete = client.delete(f"/api/v1/assets/{asset_id}", headers=admin_headers)
    assert delete.status_code == 204
    missing = client.get(f"/api/v1/assets/{asset_id}", headers=auth_headers)
    assert missing.status_code == 404


def test_get_asset_404_unknown_id(client: TestClient, auth_headers: dict[str, str]) -> None:
    """Unknown UUID returns 404."""
    response = client.get(
        f"/api/v1/assets/{uuid.uuid4()}",
        headers=auth_headers,
    )
    assert response.status_code == 404


def test_admin_rejects_wrong_api_key(client: TestClient) -> None:
    """Invalid ``X-Admin-Key`` yields 403."""
    response = client.post(
        "/api/v1/assets",
        headers={"X-Admin-Key": "wrong-key"},
        json={"symbol": f"Z{uuid.uuid4().hex[:6]}", "name": "Z", "is_active": True},
    )
    assert response.status_code == 403
