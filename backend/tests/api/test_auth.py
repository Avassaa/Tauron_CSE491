"""Contract tests for ``POST /api/v1/auth/register`` and ``/login``."""

import uuid

import pytest
from fastapi.testclient import TestClient

from tests.conftest import register_user


def test_register_returns_token_and_user_fields(client: TestClient) -> None:
    """Successful registration returns bearer token and user identifiers."""
    user = register_user(client)
    assert "user_id" in user and "headers" in user
    assert user["headers"]["Authorization"].startswith("Bearer ")


def test_register_conflict_on_duplicate_email(client: TestClient) -> None:
    """Second registration with same email yields 409."""
    email = f"dup_{uuid.uuid4().hex}@example.com"
    register_user(client, email=email, username=f"a_{uuid.uuid4().hex[:12]}")
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "username": f"b_{uuid.uuid4().hex[:12]}",
            "password": "testpassword123",
        },
    )
    assert response.status_code == 409
    assert "already" in response.json()["detail"].lower()


def test_login_success(client: TestClient) -> None:
    """Login returns token when email and password match."""
    user = register_user(client)
    response = client.post(
        "/api/v1/auth/login",
        json={"email": user["email"], "password": user["password"]},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert "access_token" in data and "user_id" in data


def test_login_rejects_wrong_password(client: TestClient) -> None:
    """Wrong password yields 401."""
    user = register_user(client)
    response = client.post(
        "/api/v1/auth/login",
        json={"email": user["email"], "password": "wrong-password-xx"},
    )
    assert response.status_code == 401


def test_register_validation_error_on_short_password(client: TestClient) -> None:
    """Password shorter than minimum triggers 422."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"v_{uuid.uuid4().hex}@example.com",
            "username": f"v_{uuid.uuid4().hex[:12]}",
            "password": "short",
        },
    )
    assert response.status_code == 422
