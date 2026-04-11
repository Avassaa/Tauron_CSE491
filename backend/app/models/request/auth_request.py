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
