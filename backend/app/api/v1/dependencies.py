"""FastAPI dependencies for API v1.

This module contains reusable dependencies that can be injected into route handlers.
Dependencies handle cross-cutting concerns like authentication, request context, and pagination.

Usage:
    @router.get("/items")
    async def get_items(
        user_id: uuid.UUID = Depends(get_current_user_id),
    ):
        ...
"""

import uuid

from fastapi import Depends, Query, Request

from app.core.logging import get_trace_id
from app.core.security import get_current_user_id


def get_request_id(request: Request) -> str:
    """
    Get the request ID from the current request.

    The request ID is set by RequestContextMiddleware.
    """
    return getattr(request.state, "request_id", get_trace_id() or "unknown")


def get_client_ip(request: Request) -> str:
    """Get the client IP address."""
    if request.client:
        return request.client.host
    return "unknown"


class PaginationParams:
    """Pagination parameters."""

    def __init__(
        self,
        page: int = Query(default=1, ge=1, description="Page number"),
        page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    ):
        self.page = page
        self.page_size = page_size
        self.offset = (page - 1) * self.page_size

    def to_dict(self) -> dict:
        return {
            "page": self.page,
            "page_size": self.page_size,
            "offset": self.offset,
        }


def get_pagination(
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
) -> PaginationParams:
    """
    Get pagination parameters.

    Usage:
        @router.get("/items")
        async def list_items(pagination = Depends(get_pagination)):
            offset = pagination.offset
            limit = pagination.page_size
            ...
    """
    return PaginationParams(page=page, page_size=page_size)


async def get_authenticated_context(
    request: Request,
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    """
    Combined dependency for authenticated requests.

    Returns a dict with common context needed by handlers.
    """
    return {
        "user_id": user_id,
        "request_id": get_request_id(request),
        "client_ip": get_client_ip(request),
    }
