"""Manual trigger for news scraper + ``news_data`` ingest (admin only)."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import require_admin_api_key
from app.models.response.table_responses import NewsScrapeTriggerResponse
from app.workers.news_scraper_worker import run_news_scraper_ingest_once

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/news")


@router.post(
    "/scrape",
    response_model=NewsScrapeTriggerResponse,
    summary="Run news scrapers and ingest into news_data",
)
async def trigger_news_scrape(
    _admin: None = Depends(require_admin_api_key),
) -> NewsScrapeTriggerResponse:
    """
    Run ``scrapers/main.py`` via ``uv``, then insert new rows into ``news_data``.

    Duplicate articles (same ``fingerprint``) are skipped. Requires ``uv`` on
    ``PATH`` and ``ADMIN_API_KEY`` (header ``X-Admin-Key``). This can run for a long time.
    """
    try:
        summary = await run_news_scraper_ingest_once()
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
    except TimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=str(exc),
        ) from exc
    except RuntimeError as exc:
        logger.warning("News scraper subprocess failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("News scrape ingest failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="News scrape ingest failed",
        ) from exc

    return NewsScrapeTriggerResponse.model_validate(summary)
