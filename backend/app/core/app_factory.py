"""FastAPI application factory, lifespan helpers, and default health routes."""

import asyncio
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Awaitable, Callable, List, Optional, Union

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.logging import RequestContextMiddleware


class HealthCheck:
    """Optional hook for extending aggregated ``/health`` responses."""

    def __init__(self) -> None:
        self._details: dict = {}

    def register_detail(self, key: str, value: Any) -> None:
        """Attach static detail fields reported by ``GET /health``."""
        self._details[key] = value

    def get_details(self) -> dict:
        """Return a copy of registered detail fields."""
        return dict(self._details)


def create_lifespan(
    on_startup: Optional[List[Union[Callable[[], Any], Callable[[], Awaitable[Any]]]]] = None,
    on_shutdown: Optional[List[Union[Callable[[], Any], Callable[[], Awaitable[Any]]]]] = None,
) -> Callable[[FastAPI], AsyncIterator[None]]:
    """Build a FastAPI lifespan that runs optional startup and shutdown callables."""

    startup_callbacks = list(on_startup or [])
    shutdown_callbacks = list(on_shutdown or [])

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        for callback in startup_callbacks:
            result = callback()
            if asyncio.iscoroutine(result):
                await result
        yield
        for callback in shutdown_callbacks:
            result = callback()
            if asyncio.iscoroutine(result):
                await result

    return lifespan


def create_app(
    title: str,
    description: str,
    version: str,
    lifespan: Callable[[FastAPI], AsyncIterator[None]],
    cors_origins: List[str],
    cors_allow_credentials: bool,
    health_check: HealthCheck,
) -> FastAPI:
    """Create a FastAPI application with CORS, request context, and health endpoints."""
    application = FastAPI(
        title=title,
        description=description,
        version=version,
        lifespan=lifespan,
    )
    application.add_middleware(RequestContextMiddleware)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=cors_allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @application.get("/health", tags=["Health"])
    async def health_summary():
        body: dict = {"status": "healthy"}
        body.update(health_check.get_details())
        return body

    @application.get("/health/live", tags=["Health"])
    async def health_live():
        return {"status": "alive"}

    @application.get("/health/ready", tags=["Health"])
    async def health_ready():
        return {"status": "ready"}

    return application
