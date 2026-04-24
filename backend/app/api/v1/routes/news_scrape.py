"""Manual trigger for news scraper + ``news_data`` ingest (admin only)."""

import asyncio
import logging
from typing import Set

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import require_admin_api_key
from app.models.response.table_responses import NewsScrapeAcceptedResponse
from app.workers.news_scraper_worker import (
    news_scrape_prerequisite_error,
    run_news_scraper_ingest_once,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/news")

_background_scrape_tasks: Set[asyncio.Task[None]] = set()


def _schedule_background_ingest() -> None:
    async def _runner() -> None:
        try:
            summary = await run_news_scraper_ingest_once()
            logger.info("Background news scrape finished: %s", summary)
        except Exception:
            logger.exception("Background news scrape failed")

    task = asyncio.create_task(_runner())
    _background_scrape_tasks.add(task)
    task.add_done_callback(_background_scrape_tasks.discard)


async def cancel_background_news_scrape_tasks() -> None:
    """Cancel in-flight manual scrapes (called on app shutdown)."""
    if not _background_scrape_tasks:
        return
    pending = list(_background_scrape_tasks)
    for task in pending:
        task.cancel()
    await asyncio.gather(*pending, return_exceptions=True)
    _background_scrape_tasks.clear()


@router.post(
    "/scrape",
    response_model=NewsScrapeAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Queue news scrapers and ingest into news_data",
)
async def trigger_news_scrape(
    _admin: None = Depends(require_admin_api_key),
) -> NewsScrapeAcceptedResponse:
    """
    Return **202 Accepted** immediately and run scrape + ``news_data`` ingest in the
    background. Check logs for completion and row counts. Requires ``uv`` on ``PATH``,
    ``ADMIN_API_KEY`` (``X-Admin-Key``), and repo layout ``…/scrapers`` beside ``…/backend``.
    """
    err = news_scrape_prerequisite_error()
    if err is not None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=err,
        )
    _schedule_background_ingest()
    return NewsScrapeAcceptedResponse()
