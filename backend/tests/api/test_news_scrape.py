"""Contract tests for ``POST /api/v1/news/scrape`` (authenticated users)."""

import time
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient


def test_news_scrape_requires_jwt(client: TestClient) -> None:
    response = client.post("/api/v1/news/scrape")
    assert response.status_code == 401


def test_news_scrape_503_when_prerequisites_missing(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.api.v1.routes.news_scrape.news_scrape_prerequisite_error",
        lambda: "uv executable not found on PATH",
    )
    response = client.post("/api/v1/news/scrape", headers=auth_headers)
    assert response.status_code == 503
    assert "uv" in response.json()["detail"].lower()


@patch(
    "app.api.v1.routes.news_scrape.run_news_scraper_ingest_once",
    new_callable=AsyncMock,
    return_value={"articles_in_file": 3, "rows_inserted": 1},
)
def test_news_scrape_accepted_immediately(
    mock_run: AsyncMock,
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.post("/api/v1/news/scrape", headers=auth_headers)
    assert response.status_code == 202
    assert response.json() == {
        "status": "accepted",
        "message": "News scrape and ingest started in the background.",
    }
    # Let the fire-and-forget task invoke the mock before the test process exits.
    time.sleep(0.1)
    mock_run.assert_awaited()
