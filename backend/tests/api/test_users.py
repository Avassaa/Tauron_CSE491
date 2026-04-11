"""Contract tests for ``/api/v1/users/me`` profile and password routes."""

import uuid

import pytest
from fastapi.testclient import TestClient

from tests.conftest import register_user


def test_get_me_requires_jwt(client: TestClient) -> None:
    """``GET /users/me`` without Authorization returns 401."""
    response = client.get("/api/v1/users/me")
    assert response.status_code == 401


def test_get_me_returns_profile_without_password(client: TestClient, auth_headers: dict[str, str]) -> None:
    """Authenticated user receives id, username, email, preferences, created_at."""
    response = client.get("/api/v1/users/me", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) >= {"id", "username", "email", "preferences", "created_at"}
    assert "password" not in body and "password_hash" not in body


def test_patch_me_updates_username(client: TestClient, auth_headers: dict[str, str]) -> None:
    """PATCH accepts partial fields and returns updated profile."""
    new_name = f"renamed_{uuid.uuid4().hex[:10]}"
    response = client.patch(
        "/api/v1/users/me",
        headers=auth_headers,
        json={"username": new_name},
    )
    assert response.status_code == 200
    assert response.json()["username"] == new_name


def test_change_password_then_login_with_new_password(client: TestClient) -> None:
    """POST ``/users/me/password`` rotates password; old token still works until expiry."""
    user = register_user(client)
    headers = user["headers"]
    new_pw = "newpassword456789"
    change = client.post(
        "/api/v1/users/me/password",
        headers=headers,
        json={"current_password": user["password"], "new_password": new_pw},
    )
    assert change.status_code == 204
    login = client.post(
        "/api/v1/auth/login",
        json={"email": user["email"], "password": new_pw},
    )
    assert login.status_code == 200


def test_change_password_rejects_wrong_current(client: TestClient, auth_headers: dict[str, str]) -> None:
    """Wrong current password yields 400."""
    response = client.post(
        "/api/v1/users/me/password",
        headers=auth_headers,
        json={"current_password": "not-the-password", "new_password": "anothernewpass12345"},
    )
    assert response.status_code == 400


def test_delete_me_removes_user(client: TestClient) -> None:
    """DELETE ``/users/me`` returns 204; subsequent me returns 404."""
    user = register_user(client)
    headers = user["headers"]
    delete = client.delete("/api/v1/users/me", headers=headers)
    assert delete.status_code == 204
    again = client.get("/api/v1/users/me", headers=headers)
    assert again.status_code == 404
