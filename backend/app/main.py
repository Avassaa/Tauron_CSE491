"""Application entry point.

This is the main FastAPI application module. It sets up logging,
creates the FastAPI app with middleware, and includes routers.
"""

from app.core.app_factory import HealthCheck, create_app, create_lifespan
from app.core.logging import setup_logging
from app.core.security import configure_default_rate_limiter
from app.config import settings
from app.api.v1.routes import auth_router, example_router, health_router


async def _bootstrap_database_on_startup() -> None:
    """Create PostgreSQL schema, tables, and extensions when configured."""
    from app.db.bootstrap import bootstrap_database
    from app.db.session import engine

    await bootstrap_database(engine)

setup_logging(
    service_name=settings.SERVICE_ID,
    log_level=settings.LOG_LEVEL,
)

configure_default_rate_limiter(
    max_attempts=settings.RATE_LIMIT_MAX_ATTEMPTS,
    window_hours=settings.RATE_LIMIT_WINDOW_HOURS,
)

lifespan = create_lifespan(
    on_startup=[_bootstrap_database_on_startup],
    on_shutdown=[],
)

health_check = HealthCheck()

app = create_app(
    title=settings.SERVICE_NAME,
    description=f"API for {settings.SERVICE_NAME}",
    version="1.0.0",
    lifespan=lifespan,
    cors_origins=settings.CORS_ORIGINS_LIST,
    cors_allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    health_check=health_check,
)

app.include_router(auth_router, prefix="/api/v1", tags=["Auth"])
app.include_router(health_router, prefix="/api/v1", tags=["Health"])
app.include_router(example_router, prefix="/api/v1", tags=["Examples"])


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with service information."""
    return {
        "service": settings.SERVICE_NAME,
        "service_id": settings.SERVICE_ID,
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG,
        log_config=None,
    )
