"""Manual trigger for news scraper + ``news_data`` ingest (authenticated users)."""

import asyncio
import logging
import uuid
from typing import Set

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user_id
from app.models.response.table_responses import NewsScrapeAcceptedResponse
from app.workers.news_scraper_worker import (
    news_scrape_prerequisite_error,
    run_news_curation_once,
    run_news_scraper_ingest_once,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/news")

_background_scrape_tasks: Set[asyncio.Task[None]] = set()
_background_curate_tasks: Set[asyncio.Task[None]] = set()


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


def _schedule_background_curate() -> None:
    async def _runner() -> None:
        try:
            summary = await run_news_curation_once()
            logger.info("Background news curation finished: %s", summary)
        except Exception:
            logger.exception("Background news curation failed")

    task = asyncio.create_task(_runner())
    _background_curate_tasks.add(task)
    task.add_done_callback(_background_curate_tasks.discard)


async def cancel_background_news_scrape_tasks() -> None:
    """Cancel in-flight manual scrape/curation tasks (called on app shutdown)."""
    pending = list(_background_scrape_tasks | _background_curate_tasks)
    if not pending:
        return
    for task in pending:
        task.cancel()
    await asyncio.gather(*pending, return_exceptions=True)
    _background_scrape_tasks.clear()
    _background_curate_tasks.clear()


@router.post(
    "/scrape",
    response_model=NewsScrapeAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Queue news scrapers and ingest into news_data",
)
async def trigger_news_scrape(
    _user_id: uuid.UUID = Depends(get_current_user_id),
) -> NewsScrapeAcceptedResponse:
    """
    Return **202 Accepted** immediately and run scrape + ``news_data`` ingest in the
    background. Check logs for completion and row counts. Requires ``uv`` on ``PATH``
    and repo layout ``…/scrapers`` beside ``…/backend``.
    """
    err = news_scrape_prerequisite_error()
    if err is not None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=err,
        )
    _schedule_background_ingest()
    return NewsScrapeAcceptedResponse()


@router.post(
    "/curate",
    response_model=NewsScrapeAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Queue curation and embedding backfill from existing news rows",
)
async def trigger_news_curation(
    _user_id: uuid.UUID = Depends(get_current_user_id),
) -> NewsScrapeAcceptedResponse:
    """
    Return **202 Accepted** immediately and run DB-only embedding backfill + curated summary
    generation in the background. This endpoint does not call external scrapers.
    """
    _schedule_background_curate()
    return NewsScrapeAcceptedResponse(
        message="News curation and embedding backfill started in the background.",
    )
