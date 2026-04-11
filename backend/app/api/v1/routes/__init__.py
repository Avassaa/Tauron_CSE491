"""API v1 routes."""

from .auth import router as auth_router
from .example import router as example_router
from .health import router as health_router

__all__ = ["auth_router", "example_router", "health_router"]
