"""Contract tests for ``/api/v1/comment-images``."""

import base64

from fastapi.testclient import TestClient

ONE_PX_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def test_comment_image_requires_jwt(client: TestClient) -> None:
    files = {"file": ("x.png", ONE_PX_PNG, "image/png")}
    res = client.post("/api/v1/comment-images", files=files)
    assert res.status_code == 401


def test_comment_image_upload_get_roundtrip(client: TestClient, auth_headers: dict[str, str]) -> None:
    files = {"file": ("x.png", ONE_PX_PNG, "image/png")}
    up = client.post("/api/v1/comment-images", headers=auth_headers, files=files)
    assert up.status_code == 201, up.text
    url = up.json()["url"]
    assert "/api/v1/comment-images/" in url

    path = url.split("/api/v1/", 1)[1]
    get_res = client.get(f"/api/v1/{path}")
    assert get_res.status_code == 200
    assert get_res.content == ONE_PX_PNG
