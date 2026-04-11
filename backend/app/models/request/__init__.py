"""Request models (Pydantic schemas for incoming data)."""

from .auth_request import LoginRequest, RegisterRequest

__all__ = ["LoginRequest", "RegisterRequest"]
