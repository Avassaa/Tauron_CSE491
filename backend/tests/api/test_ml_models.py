"""Contract tests for ``/api/v1/ml-models``."""

import uuid

import pytest
from fastapi.testclient import TestClient

from tests.conftest import create_asset_admin


def test_list_ml_models_requires_jwt(client: TestClient) -> None:
    response = client.get("/api/v1/ml-models")
    assert response.status_code == 401


def test_list_ml_models_paginated(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.get("/api/v1/ml-models?page=1&page_size=5", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert set(data.keys()) == {"items", "total", "page", "page_size"}


def test_admin_crud_ml_model(
    client: TestClient,
    admin_headers: dict[str, str],
    auth_headers: dict[str, str],
) -> None:
    asset = create_asset_admin(client, admin_headers)
    create = client.post(
        "/api/v1/ml-models",
        headers=admin_headers,
        json={"version_tag": f"vt-{uuid.uuid4().hex[:8]}", "asset_id": asset["id"], "is_active": True},
    )
    assert create.status_code == 201
    mid = create.json()["id"]
    get_one = client.get(f"/api/v1/ml-models/{mid}", headers=auth_headers)
    assert get_one.status_code == 200
    patch = client.patch(
        f"/api/v1/ml-models/{mid}",
        headers=admin_headers,
        json={"model_type": "lstm"},
    )
    assert patch.status_code == 200
    assert patch.json()["model_type"] == "lstm"
    delete = client.delete(f"/api/v1/ml-models/{mid}", headers=admin_headers)
    assert delete.status_code == 204


def test_get_ml_model_404(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.get(f"/api/v1/ml-models/{uuid.uuid4()}", headers=auth_headers)
    assert response.status_code == 404


def test_post_ml_model_forbidden_without_admin(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.post(
        "/api/v1/ml-models",
        headers=auth_headers,
        json={"version_tag": "x", "is_active": False},
    )
    assert response.status_code == 403
