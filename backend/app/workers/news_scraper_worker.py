"""Daily scraper run + ingest into ``news_data`` with fingerprint deduplication."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import shutil
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models.news_data import NewsData
from app.db.session import async_session_factory

logger = logging.getLogger(__name__)

_news_worker_task: Optional[asyncio.Task[None]] = None

# Fixed operational defaults (not env-configurable).
_SCRAPER_INITIAL_DELAY_SECONDS = 300
_SCRAPER_SUBPROCESS_TIMEOUT_SECONDS = 7200
_UV_COMMAND = "uv"


def _default_scrapers_dir() -> Path:
    """``…/repo/scrapers`` when the repo layout is ``…/repo/backend/app/workers/``."""
    return Path(__file__).resolve().parents[3] / "scrapers"


def _article_fingerprint(article: dict[str, Any]) -> str:
    payload = {
        "source": (article.get("source") or "").strip(),
        "publishedAt": article.get("publishedAt"),
        "title": (article.get("title") or "").strip(),
        "content": (article.get("content") or "").strip(),
    }
    canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _parse_iso_datetime(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
    text = str(value).strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _flatten_scraper_payload(data: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    sources = data.get("sources")
    if not isinstance(sources, dict):
        return rows
    for _folder, block in sources.items():
        if not isinstance(block, dict) or not block.get("ok"):
            continue
        articles = block.get("articles")
        if not isinstance(articles, list):
            continue
        for article in articles:
            if isinstance(article, dict):
                rows.append(article)
    return rows


async def _insert_news_rows(session: AsyncSession, articles: list[dict[str, Any]]) -> int:
    by_fp: dict[str, dict[str, Any]] = {}
    for article in articles:
        fp = _article_fingerprint(article)
        scraped = _parse_iso_datetime(article.get("scrapedAt"))
        if scraped is None:
            scraped = datetime.now(timezone.utc)
        by_fp[fp] = {
            "id": uuid.uuid4(),
            "fingerprint": fp,
            "source": str(article.get("source") or "")[:64],
            "scraped_at": scraped,
            "published_at": _parse_iso_datetime(article.get("publishedAt")),
            "title": article.get("title"),
            "content": str(article.get("content") or ""),
        }

    values = list(by_fp.values())
    if not values:
        return 0

    inserted = 0
    batch_size = 500
    for start in range(0, len(values), batch_size):
        batch = values[start : start + batch_size]
        stmt = pg_insert(NewsData).values(batch).on_conflict_do_nothing(
            constraint="uq_news_data_fingerprint",
        )
        result = await session.execute(stmt)
        inserted += int(result.rowcount or 0)
    await session.commit()
    return inserted


async def run_news_scraper_ingest_once() -> dict[str, Any]:
    """
    Run ``scrapers/main.py`` via ``uv``, then upsert-equivalent insert (skip duplicates).

    Returns a small summary dict for logging.
    """
    scrapers_dir = _default_scrapers_dir()
    if not (scrapers_dir / "main.py").is_file():
        raise FileNotFoundError(f"scrapers main.py not found under {scrapers_dir}")
    with tempfile.NamedTemporaryFile(
        prefix="tauron-scrape-",
        suffix=".json",
        delete=False,
    ) as tmp:
        out_path = Path(tmp.name)

    try:
        cmd = [
            _UV_COMMAND,
            "run",
            "python",
            "main.py",
            "-o",
            str(out_path),
            "--log-level",
            "WARNING",
        ]
        logger.info("Running news scrapers: cwd=%s cmd=%s", scrapers_dir, " ".join(cmd))
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=str(scrapers_dir),
            env={**os.environ, "PYTHONUNBUFFERED": "1"},
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(),
                timeout=float(_SCRAPER_SUBPROCESS_TIMEOUT_SECONDS),
            )
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            raise TimeoutError(
                f"Scraper subprocess exceeded {_SCRAPER_SUBPROCESS_TIMEOUT_SECONDS}s",
            ) from None
        if proc.returncode != 0:
            err = (stderr or b"").decode("utf-8", errors="replace").strip()
            out = (stdout or b"").decode("utf-8", errors="replace").strip()
            raise RuntimeError(
                f"Scraper exited {proc.returncode}: stderr={err!r} stdout={out!r}",
            )

        raw = out_path.read_text(encoding="utf-8")
        data = json.loads(raw)
        articles = _flatten_scraper_payload(data)

        async with async_session_factory() as session:
            inserted = await _insert_news_rows(session, articles)

        logger.info(
            "News ingest finished: %d unique articles in file, %d new rows inserted.",
            len(articles),
            inserted,
        )
        return {
            "articles_in_file": len(articles),
            "rows_inserted": inserted,
        }
    finally:
        try:
            out_path.unlink(missing_ok=True)
        except OSError as exc:
            logger.warning("Could not remove temp scrape file %s: %s", out_path, exc)


async def _news_worker_loop() -> None:
    if _SCRAPER_INITIAL_DELAY_SECONDS > 0:
        await asyncio.sleep(float(_SCRAPER_INITIAL_DELAY_SECONDS))
    while True:
        try:
            await run_news_scraper_ingest_once()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("News scraper worker iteration failed")
        await asyncio.sleep(float(settings.NEWS_SCRAPER_INTERVAL_SECONDS))


async def start_news_scraper_worker() -> None:
    """Start the background loop (idempotent if already running)."""
    global _news_worker_task
    if not settings.NEWS_SCRAPER_WORKER_ENABLED:
        logger.info("News scraper worker disabled (NEWS_SCRAPER_WORKER_ENABLED is false).")
        return
    if shutil.which(_UV_COMMAND) is None:
        logger.warning(
            "News scraper worker not started: `%s` not found on PATH (install uv for scraper runs).",
            _UV_COMMAND,
        )
        return
    if _news_worker_task is not None and not _news_worker_task.done():
        return
    _news_worker_task = asyncio.create_task(
        _news_worker_loop(),
        name="news_scraper_worker",
    )
    logger.info(
        "News scraper worker scheduled (first run after %ss, then every %ss).",
        _SCRAPER_INITIAL_DELAY_SECONDS,
        settings.NEWS_SCRAPER_INTERVAL_SECONDS,
    )


async def stop_news_scraper_worker() -> None:
    """Cancel the background loop on application shutdown."""
    global _news_worker_task
    if _news_worker_task is None:
        return
    _news_worker_task.cancel()
    try:
        await _news_worker_task
    except asyncio.CancelledError:
        pass
    _news_worker_task = None
    logger.info("News scraper worker stopped.")
