"""Contract tests for ``/api/v1/knowledge-base`` (``metadata`` JSON field)."""

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from tests.conftest import create_asset_admin


def test_list_knowledge_base_requires_jwt(client: TestClient) -> None:
    response = client.get("/api/v1/knowledge-base")
    assert response.status_code == 401


def test_knowledge_base_admin_create_get_patch_delete(
    client: TestClient,
    admin_headers: dict[str, str],
    auth_headers: dict[str, str],
) -> None:
    asset = create_asset_admin(client, admin_headers)
    published = datetime(2024, 7, 1, tzinfo=timezone.utc).isoformat()
    create = client.post(
        "/api/v1/knowledge-base",
        headers=admin_headers,
        json={
            "content": "Bitcoin halving reduces issuance.",
            "published_at": published,
            "asset_id": asset["id"],
            "title": "Halving note",
            "metadata": {"source": "internal", "tier": 1},
        },
    )
    assert create.status_code == 201
    row = create.json()
    assert row.get("metadata") == {"source": "internal", "tier": 1}
    rid = row["id"]
    get_one = client.get(f"/api/v1/knowledge-base/{rid}", headers=auth_headers)
    assert get_one.status_code == 200
    patch = client.patch(
        f"/api/v1/knowledge-base/{rid}",
        headers=admin_headers,
        json={"metadata": {"source": "internal", "tier": 2}},
    )
    assert patch.status_code == 200
    assert patch.json()["metadata"]["tier"] == 2
    delete = client.delete(f"/api/v1/knowledge-base/{rid}", headers=admin_headers)
    assert delete.status_code == 204


def test_knowledge_base_post_forbidden_without_admin(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.post(
        "/api/v1/knowledge-base",
        headers=auth_headers,
        json={
            "content": "x",
            "published_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    assert response.status_code == 403


def test_knowledge_base_get_404(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.get(f"/api/v1/knowledge-base/{uuid.uuid4()}", headers=auth_headers)
    assert response.status_code == 404
