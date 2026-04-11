"""Shared pytest fixtures and helpers for API integration tests.

Tests call the real FastAPI app via ``TestClient`` (runs ASGI lifespan so DB
bootstrap executes). Use the same PostgreSQL URL as your environment.

Each test file maps to a Swagger tag; test names describe status codes and auth.
"""

from __future__ import annotations

import asyncio
import os
import sys
import uuid

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
from datetime import datetime, timezone
from typing import Any

import pytest
from fastapi.testclient import TestClient

os.environ["JWT_SECRET"] = "test-jwt-secret-key-for-pytest-must-be-long-enough-xx"
os.environ["ADMIN_API_KEY"] = "test-admin-api-key-for-pytest-suite-only"

from app.main import app

TEST_ADMIN_KEY = os.environ["ADMIN_API_KEY"]


@pytest.fixture(autouse=True)
def disable_auth_rate_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    """Avoid 429 during repeated register/login in the same test run."""

    import app.core.security as security_module

    monkeypatch.setattr(security_module, "rate_limit_client_ip", lambda request: None)


@pytest.fixture
def client() -> Any:
    """Synchronous TestClient with lifespan (DB bootstrap on startup)."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def admin_headers() -> dict[str, str]:
    """Headers for ``X-Admin-Key`` (ingestion and admin-only routes)."""
    return {"X-Admin-Key": TEST_ADMIN_KEY}


def register_user(
    test_client: TestClient,
    email: str | None = None,
    username: str | None = None,
    password: str = "testpassword123",
) -> dict[str, Any]:
    """Register a new user and return credentials plus ``Authorization`` headers."""
    email = email or f"u_{uuid.uuid4().hex}@example.com"
    username = username or f"user_{uuid.uuid4().hex[:16]}"
    response = test_client.post(
        "/api/v1/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert response.status_code == 201, response.text
    data = response.json()
    token = data["access_token"]
    return {
        "email": email,
        "username": username,
        "password": password,
        "user_id": data["user_id"],
        "headers": {"Authorization": f"Bearer {token}"},
    }


@pytest.fixture
def auth_headers(client: TestClient) -> dict[str, str]:
    """Bearer token for a freshly registered user."""
    user = register_user(client)
    return user["headers"]


@pytest.fixture
def second_user_headers(client: TestClient) -> dict[str, str]:
    """Second user for isolation tests."""
    user = register_user(client)
    return user["headers"]


def iso_range() -> tuple[str, str]:
    """Default UTC window for time-series list endpoints."""
    time_from = datetime(2024, 1, 1, tzinfo=timezone.utc).isoformat()
    time_to = datetime(2024, 12, 31, tzinfo=timezone.utc).isoformat()
    return time_from, time_to


def create_asset_admin(
    test_client: TestClient,
    admin_headers: dict[str, str],
    symbol: str | None = None,
) -> dict[str, Any]:
    """Create an asset via admin API; returns JSON body."""
    sym = symbol or f"T{uuid.uuid4().hex[:8].upper()}"
    response = test_client.post(
        "/api/v1/assets",
        headers=admin_headers,
        json={"symbol": sym, "name": f"Test {sym}", "is_active": True},
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_ml_model_admin(
    test_client: TestClient,
    admin_headers: dict[str, str],
    asset_id: str | None = None,
) -> dict[str, Any]:
    """Create an ML model via admin API."""
    body: dict[str, Any] = {
        "version_tag": f"v-{uuid.uuid4().hex[:8]}",
        "is_active": True,
    }
    if asset_id:
        body["asset_id"] = asset_id
    response = test_client.post(
        "/api/v1/ml-models",
        headers=admin_headers,
        json=body,
    )
    assert response.status_code == 201, response.text
    return response.json()
