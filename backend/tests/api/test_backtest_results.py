"""Contract tests for ``/api/v1/backtest-results`` (JWT or ``X-Admin-Key`` via ``JwtOrAdminContext``)."""

import uuid

import pytest
from fastapi.testclient import TestClient

from tests.conftest import register_user


def test_list_backtest_requires_auth(client: TestClient) -> None:
    response = client.get("/api/v1/backtest-results")
    assert response.status_code == 401


def test_list_backtest_jwt_sees_only_own_rows(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    """JWT user lists rows where ``user_id`` matches token."""
    create = client.post(
        "/api/v1/backtest-results",
        headers=auth_headers,
        json={"strategy_name": "ma_cross", "total_return": 0.12},
    )
    assert create.status_code == 201
    created = create.json()
    response = client.get("/api/v1/backtest-results?page=1&page_size=20", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    for item in data["items"]:
        assert item["user_id"] == created["user_id"]


def test_list_backtest_admin_key_sees_all(
    client: TestClient,
    admin_headers: dict[str, str],
    auth_headers: dict[str, str],
) -> None:
    """Admin key without JWT returns aggregated list (total across users)."""
    client.post(
        "/api/v1/backtest-results",
        headers=auth_headers,
        json={"strategy_name": "user_strategy"},
    )
    admin_list = client.get(
        "/api/v1/backtest-results?page=1&page_size=50",
        headers=admin_headers,
    )
    assert admin_list.status_code == 200
    assert admin_list.json()["total"] >= 1


def test_admin_create_backtest_with_explicit_user_id(
    client: TestClient,
    admin_headers: dict[str, str],
) -> None:
    user = register_user(client)
    uid = user["user_id"]
    response = client.post(
        "/api/v1/backtest-results",
        headers=admin_headers,
        json={"user_id": uid, "strategy_name": "admin_attached"},
    )
    assert response.status_code == 201
    assert response.json()["user_id"] == uid


def test_get_patch_delete_backtest_owner_or_admin(
    client: TestClient,
    admin_headers: dict[str, str],
    auth_headers: dict[str, str],
) -> None:
    create = client.post(
        "/api/v1/backtest-results",
        headers=auth_headers,
        json={"strategy_name": "to_edit"},
    )
    rid = create.json()["id"]
    get_one = client.get(f"/api/v1/backtest-results/{rid}", headers=auth_headers)
    assert get_one.status_code == 200
    patch = client.patch(
        f"/api/v1/backtest-results/{rid}",
        headers=auth_headers,
        json={"strategy_name": "edited"},
    )
    assert patch.status_code == 200
    delete = client.delete(f"/api/v1/backtest-results/{rid}", headers=auth_headers)
    assert delete.status_code == 204


def test_cannot_read_other_users_backtest(
    client: TestClient,
    auth_headers: dict[str, str],
    second_user_headers: dict[str, str],
) -> None:
    create = client.post(
        "/api/v1/backtest-results",
        headers=auth_headers,
        json={"strategy_name": "private"},
    )
    rid = create.json()["id"]
    other = client.get(f"/api/v1/backtest-results/{rid}", headers=second_user_headers)
    assert other.status_code == 404


def test_backtest_get_404_unknown_id(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.get(f"/api/v1/backtest-results/{uuid.uuid4()}", headers=auth_headers)
    assert response.status_code == 404
