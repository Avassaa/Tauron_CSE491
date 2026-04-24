"""Contract tests for ``POST /api/v1/news/scrape`` (admin ``X-Admin-Key`` only)."""

import time
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient


def test_news_scrape_requires_admin(client: TestClient) -> None:
    response = client.post("/api/v1/news/scrape")
    assert response.status_code == 403


def test_news_scrape_rejects_wrong_admin_key(client: TestClient) -> None:
    response = client.post(
        "/api/v1/news/scrape",
        headers={"X-Admin-Key": "invalid"},
    )
    assert response.status_code == 403


def test_news_scrape_503_when_prerequisites_missing(
    client: TestClient,
    admin_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.api.v1.routes.news_scrape.news_scrape_prerequisite_error",
        lambda: "uv executable not found on PATH",
    )
    response = client.post("/api/v1/news/scrape", headers=admin_headers)
    assert response.status_code == 503
    assert "uv" in response.json()["detail"].lower()


def test_news_scrape_returns_503_when_admin_key_unconfigured(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.config as app_config

    monkeypatch.setattr(app_config.settings, "ADMIN_API_KEY", "")
    response = client.post("/api/v1/news/scrape", headers={"X-Admin-Key": "any"})
    assert response.status_code == 503


@patch(
    "app.api.v1.routes.news_scrape.run_news_scraper_ingest_once",
    new_callable=AsyncMock,
    return_value={"articles_in_file": 3, "rows_inserted": 1},
)
def test_news_scrape_accepted_immediately(
    mock_run: AsyncMock,
    client: TestClient,
    admin_headers: dict[str, str],
) -> None:
    response = client.post("/api/v1/news/scrape", headers=admin_headers)
    assert response.status_code == 202
    assert response.json() == {
        "status": "accepted",
        "message": "News scrape and ingest started in the background.",
    }
    # Let the fire-and-forget task invoke the mock before the test process exits.
    time.sleep(0.1)
    mock_run.assert_awaited()
