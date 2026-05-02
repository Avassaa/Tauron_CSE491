"""Pydantic schemas for authentication requests."""

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    """Payload for user registration."""

    username: str = Field(min_length=1, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    """Payload for obtaining a JWT."""

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    """Payload for refreshing an access token."""

    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    """Payload for requesting a password reset email."""

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Payload for resetting a password using a token."""

    token: str
    new_password: str = Field(min_length=8, max_length=128)
