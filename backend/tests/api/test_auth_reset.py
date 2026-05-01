"""Tests for password reset functionality."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.repositories.user_repository import UserRepository
from app.core.security import hash_password, create_password_reset_token
from tests.conftest import register_user

def test_forgot_password_success(client: TestClient) -> None:
    """Requesting a reset link for an existing user returns 202."""
    user = register_user(client)
    response = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": user["email"]},
    )
    assert response.status_code == 202
    assert "sent" in response.json()["message"].lower()

def test_forgot_password_nonexistent_user(client: TestClient) -> None:
    """Requesting a reset link for a non-existent user still returns 202 (security)."""
    response = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "nonexistent@example.com"},
    )
    assert response.status_code == 202
    assert "sent" in response.json()["message"].lower()

def test_reset_password_success(client: TestClient) -> None:
    """Resetting password with a valid token works."""
    # 1. Register a user
    user = register_user(client)
    email = user["email"]
    
    # 2. Generate a token manually (to avoid background task dependency in this simple test)
    token = create_password_reset_token(email)
    
    # 3. Reset password
    new_password = "newpassword123!"
    response = client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": new_password},
    )
    assert response.status_code == 200
    assert "success" in response.json()["message"].lower()
    
    # 4. Verify login with new password
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": new_password},
    )
    assert login_response.status_code == 200

def test_reset_password_invalid_token(client: TestClient) -> None:
    """Resetting password with an invalid token returns 400."""
    response = client.post(
        "/api/v1/auth/reset-password",
        json={"token": "invalid-token", "new_password": "some-password-123"},
    )
    assert response.status_code == 400
    assert "invalid" in response.json()["detail"].lower()
