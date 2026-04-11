"""Contract tests for ``GET /`` and health endpoints."""

import pytest
from fastapi.testclient import TestClient


def test_root_returns_service_payload(client: TestClient) -> None:
    """Frontend can call ``GET /`` for service name, version, and docs paths."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "service" in data and "service_id" in data and "version" in data
    assert data["docs"] == "/docs"
    assert data["health"] == "/health"


def test_health_summary_returns_status(client: TestClient) -> None:
    """Liveness-style JSON from app factory ``GET /health``."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json().get("status") == "healthy"


def test_health_live_and_ready(client: TestClient) -> None:
    """Kubernetes-style probes exposed on the app root."""
    live = client.get("/health/live")
    assert live.status_code == 200
    assert live.json()["status"] == "alive"
    ready = client.get("/health/ready")
    assert ready.status_code == 200
    assert ready.json()["status"] == "ready"


def test_api_v1_health_details_requires_no_auth(client: TestClient) -> None:
    """``GET /api/v1/health/details`` returns service metadata (JWT not required)."""
    response = client.get("/api/v1/health/details")
    assert response.status_code == 200
    body = response.json()
    assert "service" in body and "service_id" in body
    assert "debug_mode" in body and "log_level" in body
