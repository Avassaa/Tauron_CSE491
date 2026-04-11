"""Contract tests for ``/api/v1/scraper-logs`` (admin ``X-Admin-Key`` only)."""

import pytest
from fastapi.testclient import TestClient


def test_scraper_logs_list_requires_admin(client: TestClient) -> None:
    response = client.get("/api/v1/scraper-logs")
    assert response.status_code == 403


def test_scraper_logs_admin_crud(
    client: TestClient,
    admin_headers: dict[str, str],
) -> None:
    create = client.post(
        "/api/v1/scraper-logs",
        headers=admin_headers,
        json={"source": "coingecko", "status": "ok", "rows_affected": 10},
    )
    assert create.status_code == 201
    body = create.json()
    assert set(body.keys()) >= {"id", "source", "status", "executed_at"}
    log_id = body["id"]
    get_one = client.get(f"/api/v1/scraper-logs/{log_id}", headers=admin_headers)
    assert get_one.status_code == 200
    patch = client.patch(
        f"/api/v1/scraper-logs/{log_id}",
        headers=admin_headers,
        json={"status": "fixed"},
    )
    assert patch.status_code == 200
    delete = client.delete(f"/api/v1/scraper-logs/{log_id}", headers=admin_headers)
    assert delete.status_code == 204


def test_scraper_logs_rejects_wrong_admin_key(client: TestClient) -> None:
    response = client.get("/api/v1/scraper-logs", headers={"X-Admin-Key": "invalid"})
    assert response.status_code == 403


def test_scraper_logs_list_paginated(client: TestClient, admin_headers: dict[str, str]) -> None:
    response = client.get("/api/v1/scraper-logs?page=1&page_size=10", headers=admin_headers)
    assert response.status_code == 200
    assert set(response.json().keys()) == {"items", "total", "page", "page_size"}


def test_admin_routes_return_503_when_admin_key_unconfigured(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """If ``ADMIN_API_KEY`` is empty, admin dependency returns 503."""
    import app.config as app_config

    monkeypatch.setattr(app_config.settings, "ADMIN_API_KEY", "")
    response = client.get("/api/v1/scraper-logs", headers={"X-Admin-Key": "any"})
    assert response.status_code == 503
