"""Application entry point.

This is the main FastAPI application module. It sets up logging,
creates the FastAPI app with middleware, and includes routers.
"""

from app.core.app_factory import HealthCheck, create_app, create_lifespan
from app.workers.news_scraper_worker import start_news_scraper_worker, stop_news_scraper_worker
from app.core.logging import setup_logging
from app.core.security import configure_default_rate_limiter
from app.config import settings
from app.api.v1.routes import (
    assets_router,
    auth_router,
    backtest_results_router,
    chat_history_admin_router,
    chat_history_router,
    curated_news_router,
    health_router,
    knowledge_base_router,
    market_data_router,
    ml_models_router,
    news_scrape_router,
    on_chain_metrics_router,
    predictions_router,
    scraper_logs_router,
    technical_indicators_router,
    users_router,
    watchlists_router,
)


async def _bootstrap_database_on_startup() -> None:
    """Create PostgreSQL schema, tables, and extensions when configured."""
    from app.db.bootstrap import bootstrap_database
    from app.db.session import engine

    await bootstrap_database(engine)


async def _cancel_background_news_scrapes() -> None:
    from app.api.v1.routes.news_scrape import cancel_background_news_scrape_tasks

    await cancel_background_news_scrape_tasks()

setup_logging(
    service_name=settings.SERVICE_ID,
    log_level=settings.LOG_LEVEL,
)

configure_default_rate_limiter(
    max_attempts=settings.RATE_LIMIT_MAX_ATTEMPTS,
    window_hours=settings.RATE_LIMIT_WINDOW_HOURS,
)

lifespan = create_lifespan(
    on_startup=[_bootstrap_database_on_startup, start_news_scraper_worker],
    on_shutdown=[_cancel_background_news_scrapes, stop_news_scraper_worker],
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
app.include_router(users_router, prefix="/api/v1", tags=["Users"])
app.include_router(watchlists_router, prefix="/api/v1", tags=["Watchlists"])
app.include_router(assets_router, prefix="/api/v1", tags=["Assets"])
app.include_router(ml_models_router, prefix="/api/v1", tags=["ML models"])
app.include_router(news_scrape_router, prefix="/api/v1", tags=["News"])
app.include_router(predictions_router, prefix="/api/v1", tags=["Predictions"])
app.include_router(market_data_router, prefix="/api/v1", tags=["Market data"])
app.include_router(technical_indicators_router, prefix="/api/v1", tags=["Technical indicators"])
app.include_router(on_chain_metrics_router, prefix="/api/v1", tags=["On-chain metrics"])
app.include_router(curated_news_router, prefix="/api/v1", tags=["Curated news"])
app.include_router(knowledge_base_router, prefix="/api/v1", tags=["Knowledge base"])
app.include_router(chat_history_router, prefix="/api/v1", tags=["Chat history"])
app.include_router(chat_history_admin_router, prefix="/api/v1", tags=["Chat history (admin)"])
app.include_router(backtest_results_router, prefix="/api/v1", tags=["Backtest results"])
app.include_router(scraper_logs_router, prefix="/api/v1", tags=["Scraper logs"])


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
