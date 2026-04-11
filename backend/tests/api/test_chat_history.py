"""Contract tests for ``/api/v1/chat-history`` and ``/api/v1/admin/chat-history``."""

import uuid

import pytest
from fastapi.testclient import TestClient

from tests.conftest import register_user


def test_chat_list_requires_jwt(client: TestClient) -> None:
    response = client.get("/api/v1/chat-history")
    assert response.status_code == 401


def test_chat_crud_for_owner(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    session_id = str(uuid.uuid4())
    create = client.post(
        "/api/v1/chat-history",
        headers=auth_headers,
        json={
            "session_id": session_id,
            "role": "user",
            "content": "What is RSI?",
        },
    )
    assert create.status_code == 201
    msg_id = create.json()["id"]
    get_one = client.get(f"/api/v1/chat-history/{msg_id}", headers=auth_headers)
    assert get_one.status_code == 200
    listed = client.get(
        f"/api/v1/chat-history?session_id={session_id}",
        headers=auth_headers,
    )
    assert listed.status_code == 200
    assert listed.json()["total"] >= 1
    patch = client.patch(
        f"/api/v1/chat-history/{msg_id}",
        headers=auth_headers,
        json={"content": "What is RSI exactly?"},
    )
    assert patch.status_code == 200
    delete = client.delete(f"/api/v1/chat-history/{msg_id}", headers=auth_headers)
    assert delete.status_code == 204


def test_chat_message_not_accessible_to_other_user(
    client: TestClient,
    auth_headers: dict[str, str],
    second_user_headers: dict[str, str],
) -> None:
    """Second user cannot GET another user's message (404)."""
    session_id = str(uuid.uuid4())
    create = client.post(
        "/api/v1/chat-history",
        headers=auth_headers,
        json={"session_id": session_id, "role": "user", "content": "Private"},
    )
    msg_id = create.json()["id"]
    other = client.get(f"/api/v1/chat-history/{msg_id}", headers=second_user_headers)
    assert other.status_code == 404


def test_admin_chat_history_requires_admin_key(client: TestClient) -> None:
    response = client.get("/api/v1/admin/chat-history")
    assert response.status_code == 403


def test_admin_chat_history_list_with_admin_key(
    client: TestClient,
    admin_headers: dict[str, str],
) -> None:
    response = client.get("/api/v1/admin/chat-history?page=1&page_size=10", headers=admin_headers)
    assert response.status_code == 200
    assert set(response.json().keys()) == {"items", "total", "page", "page_size"}


def test_admin_chat_history_filter_user_id(
    client: TestClient,
    admin_headers: dict[str, str],
) -> None:
    user = register_user(client)
    uid = user["user_id"]
    session_id = str(uuid.uuid4())
    client.post(
        "/api/v1/chat-history",
        headers=user["headers"],
        json={"session_id": session_id, "role": "user", "content": "Tagged"},
    )
    response = client.get(
        f"/api/v1/admin/chat-history?user_id={uid}&page=1&page_size=20",
        headers=admin_headers,
    )
    assert response.status_code == 200
    assert response.json()["total"] >= 1
