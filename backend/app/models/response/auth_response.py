"""Pydantic schemas for authentication responses."""

import uuid

from pydantic import BaseModel, EmailStr


class TokenResponse(BaseModel):
    """OAuth2-style bearer token response."""

    access_token: str
    token_type: str = "bearer"
    user_id: uuid.UUID


class RegisterResponse(BaseModel):
    """Successful registration with immediate token."""

    access_token: str
    token_type: str = "bearer"
    user_id: uuid.UUID
    username: str
    email: EmailStr
