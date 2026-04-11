"""Contract tests for ``/api/v1/curated-news``."""

import uuid

import pytest
from fastapi.testclient import TestClient

from tests.conftest import create_asset_admin


def test_list_curated_news_requires_jwt(client: TestClient) -> None:
    response = client.get("/api/v1/curated-news")
    assert response.status_code == 401


def test_curated_news_admin_crud(
    client: TestClient,
    admin_headers: dict[str, str],
    auth_headers: dict[str, str],
) -> None:
    asset = create_asset_admin(client, admin_headers)
    create = client.post(
        "/api/v1/curated-news",
        headers=admin_headers,
        json={
            "summary": "Market moved higher on ETF flows.",
            "asset_id": asset["id"],
            "sentiment_score": 0.7,
        },
    )
    assert create.status_code == 201
    nid = create.json()["id"]
    get_one = client.get(f"/api/v1/curated-news/{nid}", headers=auth_headers)
    assert get_one.status_code == 200
    assert get_one.json()["summary"].startswith("Market")
    patch = client.patch(
        f"/api/v1/curated-news/{nid}",
        headers=admin_headers,
        json={"summary": "Updated summary text."},
    )
    assert patch.status_code == 200
    delete = client.delete(f"/api/v1/curated-news/{nid}", headers=admin_headers)
    assert delete.status_code == 204
    missing = client.get(f"/api/v1/curated-news/{nid}", headers=auth_headers)
    assert missing.status_code == 404


def test_post_curated_news_forbidden_without_admin(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.post(
        "/api/v1/curated-news",
        headers=auth_headers,
        json={"summary": "No admin"},
    )
    assert response.status_code == 403


def test_curated_news_list_paginated(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.get("/api/v1/curated-news?page=1&page_size=5", headers=auth_headers)
    assert response.status_code == 200
    assert set(response.json().keys()) == {"items", "total", "page", "page_size"}
