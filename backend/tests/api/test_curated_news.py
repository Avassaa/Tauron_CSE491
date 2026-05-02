"""Contract tests for ``/api/v1/curated-news``."""

import uuid

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


def test_news_comments_require_jwt(client: TestClient) -> None:
    rid = str(uuid.uuid4())
    assert client.get(f"/api/v1/curated-news/{rid}/comments").status_code == 401
    assert client.post(f"/api/v1/curated-news/{rid}/comments", json={"content": "hi"}).status_code == 401


def test_news_comments_create_and_list(
    client: TestClient,
    admin_headers: dict[str, str],
    auth_headers: dict[str, str],
) -> None:
    asset = create_asset_admin(client, admin_headers)
    create = client.post(
        "/api/v1/curated-news",
        headers=admin_headers,
        json={"summary": "Story for comments.", "asset_id": asset["id"]},
    )
    assert create.status_code == 201
    nid = create.json()["id"]

    empty = client.post(
        f"/api/v1/curated-news/{nid}/comments",
        headers=auth_headers,
        json={"content": "   "},
    )
    assert empty.status_code == 400

    post = client.post(
        f"/api/v1/curated-news/{nid}/comments",
        headers=auth_headers,
        json={"content": "  Interesting take.  "},
    )
    assert post.status_code == 201
    body = post.json()
    assert body["content"] == "Interesting take."
    assert body["curated_news_id"] == nid
    assert "username" in body

    listed = client.get(f"/api/v1/curated-news/{nid}/comments", headers=auth_headers)
    assert listed.status_code == 200
    payload = listed.json()
    assert payload["total"] >= 1
    assert any(c["content"] == "Interesting take." for c in payload["items"])


def test_news_comments_reply_to_comment(
    client: TestClient,
    admin_headers: dict[str, str],
    auth_headers: dict[str, str],
) -> None:
    asset = create_asset_admin(client, admin_headers)
    create = client.post(
        "/api/v1/curated-news",
        headers=admin_headers,
        json={"summary": "Story for threaded comments.", "asset_id": asset["id"]},
    )
    assert create.status_code == 201
    nid = create.json()["id"]

    root = client.post(
        f"/api/v1/curated-news/{nid}/comments",
        headers=auth_headers,
        json={"content": "Top-level"},
    )
    assert root.status_code == 201
    rid = root.json()["id"]
    assert root.json().get("parent_comment_id") is None

    reply = client.post(
        f"/api/v1/curated-news/{nid}/comments",
        headers=auth_headers,
        json={"content": "Nested reply", "parent_comment_id": rid},
    )
    assert reply.status_code == 201
    body = reply.json()
    assert body["parent_comment_id"] == rid
    assert body["parent_username"] == root.json()["username"]

    listed = client.get(f"/api/v1/curated-news/{nid}/comments", headers=auth_headers)
    assert listed.status_code == 200
    items = listed.json()["items"]
    reply_row = next(c for c in items if c["content"] == "Nested reply")
    assert reply_row["parent_comment_id"] == rid


def test_news_comments_reply_rejects_foreign_parent(
    client: TestClient,
    admin_headers: dict[str, str],
    auth_headers: dict[str, str],
) -> None:
    asset = create_asset_admin(client, admin_headers)
    a = client.post(
        "/api/v1/curated-news",
        headers=admin_headers,
        json={"summary": "Story A.", "asset_id": asset["id"]},
    )
    b = client.post(
        "/api/v1/curated-news",
        headers=admin_headers,
        json={"summary": "Story B.", "asset_id": asset["id"]},
    )
    assert a.status_code == 201 and b.status_code == 201
    nid_a = a.json()["id"]
    other = client.post(
        f"/api/v1/curated-news/{nid_a}/comments",
        headers=auth_headers,
        json={"content": "Only on A"},
    )
    assert other.status_code == 201
    cid = other.json()["id"]
    nid_b = b.json()["id"]
    bad = client.post(
        f"/api/v1/curated-news/{nid_b}/comments",
        headers=auth_headers,
        json={"content": "Wrong story", "parent_comment_id": cid},
    )
    assert bad.status_code == 404


def test_news_comments_accepts_long_content_base64_markdown(
    client: TestClient,
    admin_headers: dict[str, str],
    auth_headers: dict[str, str],
) -> None:
    """Base64 image markdown exceeds 16k chars; request model must allow large bodies."""
    asset = create_asset_admin(client, admin_headers)
    create = client.post(
        "/api/v1/curated-news",
        headers=admin_headers,
        json={"summary": "Story for long comment.", "asset_id": asset["id"]},
    )
    assert create.status_code == 201
    nid = create.json()["id"]
    # Simulate a big data-URL payload (no need for valid image bytes for this contract test)
    long_b64 = "A" * 30_000
    content = f"note\n\n![](data:image/png;base64,{long_b64})"
    post = client.post(
        f"/api/v1/curated-news/{nid}/comments",
        headers=auth_headers,
        json={"content": content},
    )
    assert post.status_code == 201, post.text
    assert long_b64 in post.json()["content"]


def test_news_comments_not_found_unknown_story(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    missing = str(uuid.uuid4())
    assert client.get(f"/api/v1/curated-news/{missing}/comments", headers=auth_headers).status_code == 404
    assert (
        client.post(
            f"/api/v1/curated-news/{missing}/comments",
            headers=auth_headers,
            json={"content": "x"},
        ).status_code
        == 404
    )


def test_news_comments_patch_delete_own(
    client: TestClient,
    admin_headers: dict[str, str],
    auth_headers: dict[str, str],
    second_user_headers: dict[str, str],
) -> None:
    asset = create_asset_admin(client, admin_headers)
    create_news = client.post(
        "/api/v1/curated-news",
        headers=admin_headers,
        json={"summary": "Story with comments CRUD.", "asset_id": asset["id"]},
    )
    assert create_news.status_code == 201
    nid = create_news.json()["id"]

    post = client.post(
        f"/api/v1/curated-news/{nid}/comments",
        headers=auth_headers,
        json={"content": "Original."},
    )
    assert post.status_code == 201
    cid = post.json()["id"]

    patch = client.patch(
        f"/api/v1/curated-news/{nid}/comments/{cid}",
        headers=auth_headers,
        json={"content": "Updated body."},
    )
    assert patch.status_code == 200
    patched = patch.json()
    assert patched["content"] == "Updated body."
    assert patched.get("updated_at") is not None

    other_patch = client.patch(
        f"/api/v1/curated-news/{nid}/comments/{cid}",
        headers=second_user_headers,
        json={"content": "Nope."},
    )
    assert other_patch.status_code == 404

    delete_other = client.delete(
        f"/api/v1/curated-news/{nid}/comments/{cid}",
        headers=second_user_headers,
    )
    assert delete_other.status_code == 404

    delete_ok = client.delete(
        f"/api/v1/curated-news/{nid}/comments/{cid}",
        headers=auth_headers,
    )
    assert delete_ok.status_code == 204

    listed = client.get(f"/api/v1/curated-news/{nid}/comments", headers=auth_headers)
    assert listed.status_code == 200
    assert listed.json()["total"] == 0
