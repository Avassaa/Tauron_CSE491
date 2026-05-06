"""Daily scraper run + ingest into ``news_data`` with fingerprint deduplication."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import re
import shutil
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models.curated_news import CuratedNews
from app.db.models.knowledge_base import KnowledgeBase
from app.db.models.news_data import NewsData
from app.db.repositories.scraper_log_repository import ScraperLogRepository
from app.db.session import async_session_factory

logger = logging.getLogger(__name__)

_news_worker_task: Optional[asyncio.Task[None]] = None

_SCRAPER_INITIAL_DELAY_SECONDS = 300
_SCRAPER_SUBPROCESS_TIMEOUT_SECONDS = 7200
_UV_COMMAND = "uv"

# Fixed operational defaults (not env-configurable).
# ``main.py`` output keys -> ``scraper_logs.source`` / article ``source`` field (VARCHAR 50).
_FOLDER_TO_SOURCE_LABEL: dict[str, str] = {
    "bloomberg": "BLOOMBERG",
    "coindesk": "COINDESK",
    "foreks": "FOREKS",
    "forbes": "FORBES",
    "investing": "INVESTING",
    "midas": "MIDAS",
    "theblock": "THEBLOCK",
    "tradingview": "TRADINGVIEW",
}


def news_scrape_prerequisite_error() -> Optional[str]:
    """Return a human-readable reason scrapers cannot run, or ``None`` if OK."""
    scrapers_dir = _default_scrapers_dir()
    if not (scrapers_dir / "main.py").is_file():
        return f"scrapers/main.py not found (expected under {scrapers_dir})"
    if shutil.which(_UV_COMMAND) is None:
        return "uv executable not found on PATH"
    return None


def _default_scrapers_dir() -> Path:
    """
    Resolve the ``scrapers`` tree containing ``main.py``.

    Order: ``SCRAPERS_DIR`` env, then monorepo ``<repo>/scrapers`` (worker at
    ``backend/app/workers/``), then ``/scrapers`` (Docker image or bind mount).
    """
    override = os.environ.get("SCRAPERS_DIR", "").strip()
    if override:
        return Path(override).expanduser().resolve()
    monorepo_root = Path(__file__).resolve().parents[3]
    standard = monorepo_root / "scrapers"
    if (standard / "main.py").is_file():
        return standard
    docker_path = Path("/scrapers")
    if (docker_path / "main.py").is_file():
        return docker_path
    return standard


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

    stripped = re.sub(
        r"^(Yayın\s*Tarihi|Yayınlanma|Published)\s*",
        "",
        text,
        flags=re.IGNORECASE,
    ).strip()
    candidates = [text] if stripped == text else [text, stripped]

    for candidate in candidates:
        c = candidate
        if c.endswith("Z"):
            c = c[:-1] + "+00:00"
        try:
            parsed = datetime.fromisoformat(c)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed
        except ValueError:
            pass

    for candidate in candidates:
        for fmt in (
            "%d.%m.%Y %H:%M",
            "%d.%m.%Y %H.%M",
            "%d/%m/%Y %H:%M",
            "%m/%d/%Y, %I:%M %p",
            "%m/%d/%Y, %H:%M",
        ):
            try:
                return datetime.strptime(candidate.strip(), fmt).replace(tzinfo=timezone.utc)
            except ValueError:
                continue

    m = re.search(r"\b(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})\b", text)
    if m:
        d, mo, y, h, mi = (int(m.group(i)) for i in range(1, 6))
        try:
            return datetime(y, mo, d, h, mi, tzinfo=timezone.utc)
        except ValueError:
            pass

    logger.debug("Could not parse published/scraped datetime: %r", value)
    return None


def _canonical_published_for_fingerprint(article: dict[str, Any]) -> Any:
    """
    Value fed into the fingerprint hash so the same instant does not get multiple digests
    when scrapers emit different string forms (e.g. ``...+03:00`` vs ``Z``).
    """
    raw = article.get("publishedAt")
    parsed = _parse_iso_datetime(raw)
    if parsed is not None:
        z = parsed.astimezone(timezone.utc).replace(microsecond=0)
        return z.isoformat().replace("+00:00", "Z")
    if raw is None:
        return None
    text = str(raw).strip()
    return text or None


def _fingerprint_text_field(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    return re.sub(r"\s+", " ", text)


def _article_fingerprint(article: dict[str, Any]) -> str:
    payload = {
        "source": (article.get("source") or "").strip(),
        "publishedAt": _canonical_published_for_fingerprint(article),
        "title": _fingerprint_text_field(article.get("title")),
    }
    canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


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
        stmt = (
            pg_insert(NewsData)
            .values(batch)
            .on_conflict_do_nothing(constraint="uq_news_data_fingerprint")
            .returning(NewsData.id)
        )
        result = await session.execute(stmt)
        # rowcount is often -1 for multi-row INSERT ... ON CONFLICT with asyncpg/psycopg.
        inserted += len(result.all())
    await session.commit()
    return inserted


async def _append_scraper_log(
    source: str,
    status: str,
    error_msg: Optional[str],
    rows_affected: Optional[int],
) -> None:
    """Append one ``scraper_logs`` row (best-effort). ``source`` is truncated to 50 chars."""
    try:
        async with async_session_factory() as session:
            repo = ScraperLogRepository(session)
            await repo.create(
                source=(source or "")[:50] or None,
                status=status,
                error_msg=error_msg,
                rows_affected=rows_affected,
            )
    except Exception:
        logger.exception("Could not append scraper_logs row for source=%s", source)


def _schema_table(table_name: str) -> str:
    schema = settings.effective_database_schema
    if not schema:
        return table_name
    return f'"{schema}".{table_name}'


def _build_embedding_input(title: Optional[str], content: str) -> str:
    cleaned_title = (title or "").strip()
    cleaned_content = (content or "").strip()
    if cleaned_title and cleaned_content:
        return f"{cleaned_title}\n\n{cleaned_content}"
    return cleaned_title or cleaned_content


def _single_line_log_preview(raw_text: Optional[str], max_chars: int) -> str:
    """Collapse whitespace and truncate for safe single-line log output."""
    collapsed = " ".join(str(raw_text or "").split())
    if len(collapsed) <= max_chars:
        return collapsed
    return f"{collapsed[: max(0, max_chars - 3)]}..."


def _gemini_post_json_sync(url: str, payload: dict[str, Any]) -> dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    request = Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(request, timeout=45) as response:
        raw = response.read().decode("utf-8")
    return json.loads(raw)


def _parse_embedding_vector(payload: Any) -> Optional[list[float]]:
    if not isinstance(payload, dict):
        return None
    raw_values = payload.get("values")
    if not isinstance(raw_values, list):
        nested = payload.get("embedding")
        if isinstance(nested, dict):
            raw_values = nested.get("values")
    if not isinstance(raw_values, list):
        return None
    vector: list[float] = []
    for value in raw_values:
        try:
            vector.append(float(value))
        except (TypeError, ValueError):
            return None
    if len(vector) != settings.GEMINI_EMBEDDING_DIMENSIONS:
        logger.warning(
            "Gemini embedding dimension mismatch: got=%s expected=%s",
            len(vector),
            settings.GEMINI_EMBEDDING_DIMENSIONS,
        )
        return None
    return vector


async def _embed_texts_with_gemini(text_values: list[str]) -> list[Optional[list[float]]]:
    """
    Run Gemini ``embedContent`` for each chunk entry sequentially.

    No fixed pause between successes by default. When Gemini returns HTTP 429, sleeps with
    exponential backoff (``GEMINI_EMBED_429_*`` settings) then retries that same text until
    success or retries are exhausted.

    Setting ``GEMINI_EMBED_DELAY_SECONDS`` above zero adds optional pacing before every attempt.
    """
    if not settings.GEMINI_API_KEY.strip() or not text_values:
        return [None for _ in text_values]

    pacing_seconds = float(max(settings.GEMINI_EMBED_DELAY_SECONDS, 0.0))

    backoff_floor = float(max(settings.GEMINI_EMBED_429_INITIAL_BACKOFF_SECONDS, 1e-3))
    backoff_ceiling = float(max(settings.GEMINI_EMBED_429_MAX_BACKOFF_SECONDS, backoff_floor))
    max_attempts_per_text = int(max(settings.GEMINI_EMBED_429_MAX_RETRIES, 1))

    logger.info(
        "Gemini embedContent: %s text(s); optional_pacing_s=%s; "
        "429_backoff_floor_s=%s 429_cap_s=%s max_attempts_per_text=%s.",
        len(text_values),
        pacing_seconds,
        backoff_floor,
        backoff_ceiling,
        max_attempts_per_text,
    )
    endpoint = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.GEMINI_EMBEDDING_MODEL}:embedContent?key={settings.GEMINI_API_KEY}"
    )
    vectors: list[Optional[list[float]]] = []
    for text_value in text_values:
        payload = {
            "model": f"models/{settings.GEMINI_EMBEDDING_MODEL}",
            "content": {"parts": [{"text": text_value}]},
            "outputDimensionality": settings.GEMINI_EMBEDDING_DIMENSIONS,
        }

        backoff_seconds = backoff_floor
        parsed_vector: Optional[list[float]] = None

        for attempt_index in range(1, max_attempts_per_text + 1):
            if pacing_seconds > 0:
                await asyncio.sleep(pacing_seconds)
            try:
                response_payload = await asyncio.to_thread(_gemini_post_json_sync, endpoint, payload)
            except HTTPError as exc:
                if exc.code == 429:
                    pause_seconds = min(backoff_seconds, backoff_ceiling)
                    logger.warning(
                        "Gemini embedding HTTP 429 (attempt %s/%s); sleeping %.2fs before retry.",
                        attempt_index,
                        max_attempts_per_text,
                        pause_seconds,
                    )
                    await asyncio.sleep(pause_seconds)
                    backoff_seconds = min(backoff_seconds * 2.0, backoff_ceiling)
                    continue
                logger.warning("Gemini embedding request failed: %s", exc)
                parsed_vector = None
                break
            except (URLError, TimeoutError) as exc:
                logger.warning("Gemini embedding request failed: %s", exc)
                parsed_vector = None
                break

            parsed_vector = _parse_embedding_vector(response_payload)
            break

        vectors.append(parsed_vector)

    return vectors


def _extract_text_from_gemini_response(payload: dict[str, Any]) -> str:
    candidates = payload.get("candidates")
    if not isinstance(candidates, list):
        return ""
    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue
        content = candidate.get("content")
        if not isinstance(content, dict):
            continue
        parts = content.get("parts")
        if not isinstance(parts, list):
            continue
        text_parts = [
            part.get("text")
            for part in parts
            if isinstance(part, dict) and isinstance(part.get("text"), str)
        ]
        merged = "\n".join(t for t in text_parts if t and t.strip()).strip()
        if merged:
            return merged
    return ""


async def _rephrase_news_item_with_gemini(
    *,
    source: str,
    title: str,
    content: str,
    published_at: datetime,
    delay_state: Optional[dict[str, float]] = None,
) -> Optional[dict[str, Any]]:
    if not settings.GEMINI_API_KEY.strip():
        return None
    if delay_state is not None:
        current_delay = float(
            max(delay_state.get("current_delay", settings.GEMINI_CURATE_DELAY_SECONDS), 0.0),
        )
        await asyncio.sleep(current_delay)
    endpoint = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.GEMINI_TEXT_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
    )
    cleaned_title = title.strip()
    cleaned_content = content.strip()
    if not cleaned_title and not cleaned_content:
        return None
    prompt = (
        "You are a crypto news editor. The article below may be written in any language.\n"
        "Your entire response MUST be in English only: translate where needed.\n"
        "Return strict JSON with exactly these keys:\n"
        '  "headline": string — plain text only, short English headline for a news feed (max ~120 characters);\n'
        '  "summary": string — English body formatted as GitHub-Flavored Markdown (not raw HTML). '
        "Use short paragraphs, bullet lists for key takeaways when it helps clarity, and **bold** for tickers, "
        "protocols, or pivotal figures. Avoid one long undifferentiated slab of text. "
        "Do not use Markdown level-1 headings (#). Optional ### subheadings are allowed sparingly.\n"
        '  "sentiment_score": number — between -1 (bearish) and +1 (bullish).\n'
        "Do not put non-English text in headline or summary.\n\n"
        f"Source: {source}\n"
        f"Published at: {published_at.isoformat()}\n"
        f"Original title: {cleaned_title}\n"
        f"Article body: {cleaned_content}"
    )
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    try:
        response = await asyncio.to_thread(_gemini_post_json_sync, endpoint, payload)
    except HTTPError as exc:
        if exc.code == 429 and delay_state is not None:
            current_delay = float(
                max(delay_state.get("current_delay", settings.GEMINI_CURATE_DELAY_SECONDS), 0.0),
            )
            next_delay = max(current_delay, settings.GEMINI_CURATE_DELAY_SECONDS) * 2
            delay_state["current_delay"] = next_delay
            logger.warning(
                "Gemini curation rate-limited (429). Increasing curate delay to %.1fs.",
                next_delay,
            )
        logger.warning("Gemini curated summary request failed: %s", exc)
        return None
    except (HTTPError, URLError, TimeoutError) as exc:
        logger.warning("Gemini curated summary request failed: %s", exc)
        return None
    model_text = _extract_text_from_gemini_response(response)
    if not model_text:
        return None
    if model_text.startswith("```"):
        model_text = re.sub(r"^```(?:json)?\s*", "", model_text)
        model_text = re.sub(r"\s*```$", "", model_text)
    try:
        parsed = json.loads(model_text)
    except json.JSONDecodeError:
        logger.warning("Gemini curated summary did not return valid JSON.")
        return None
    if not isinstance(parsed, dict):
        return None
    summary = str(parsed.get("summary") or "").strip()
    if not summary:
        return None
    headline = str(parsed.get("headline") or parsed.get("title") or "").strip()
    if not headline:
        headline = (summary[:118] + "…") if len(summary) > 120 else summary
    sentiment_value = parsed.get("sentiment_score")
    sentiment_score: Optional[float]
    try:
        sentiment_score = float(sentiment_value) if sentiment_value is not None else None
    except (TypeError, ValueError):
        sentiment_score = None
    if sentiment_score is not None:
        sentiment_score = max(-1.0, min(1.0, sentiment_score))
    return {
        "summary": summary,
        "sentiment_score": sentiment_score,
        "headline": headline,
    }


_SHORT_TRADED_SYMBOLS: frozenset[str] = frozenset(
    {
        "BTC",
        "ETH",
        "SOL",
        "BNB",
        "XRP",
        "ADA",
        "DOGE",
        "LTC",
        "TRX",
        "DOT",
        "AVAX",
        "TON",
        "SHIB",
        "MATIC",
        "POL",
        "USDT",
        "USDC",
        "NEAR",
        "UNI",
        "OP",
        "ARB",
        "APT",
        "FIL",
        "ETC",
    },
)


async def _resolve_asset_id_for_news_text(
    session: AsyncSession,
    *text_parts: str,
) -> Optional[uuid.UUID]:
    """Pick one asset when its ticker or full name appears in the headline/summary/body."""
    from app.db.models.asset import Asset

    joined = " ".join(p.strip() for p in text_parts if p)
    if len(joined) < 2:
        return None
    haystack_upper = joined.upper()
    haystack_mixed = joined
    result = await session.execute(
        select(Asset.id, Asset.symbol, Asset.name).where(Asset.is_active.is_(True)),
    )
    triples = list(result.all())
    for asset_id, symbol, _name in sorted(triples, key=lambda r: len(str(r[1])), reverse=True):
        sym = str(symbol).strip().upper()
        if len(sym) < 2:
            continue
        if len(sym) < 3 and sym not in _SHORT_TRADED_SYMBOLS:
            continue
        if re.search(rf"(?<![A-Z0-9]){re.escape(sym)}(?![A-Z0-9])", haystack_upper):
            return asset_id
    for asset_id, _symbol, name in sorted(triples, key=lambda r: len(str(r[2] or "")), reverse=True):
        nm = str(name or "").strip()
        if len(nm) < 5:
            continue
        if re.search(rf"(?<![A-Za-z0-9]){re.escape(nm)}(?![A-Za-z0-9])", haystack_mixed, re.IGNORECASE):
            return asset_id
    return None


async def _sync_news_into_knowledge_base_and_curated_news(
    *,
    force_curate: bool = False,
) -> dict[str, int]:
    logger.info(
        "News knowledge/curation pipeline starting "
        "(force_curate=%s NEWS_KNOWLEDGE_SYNC_ENABLED=%s NEWS_CURATION_ENABLED=%s).",
        force_curate,
        settings.NEWS_KNOWLEDGE_SYNC_ENABLED,
        settings.NEWS_CURATION_ENABLED,
    )
    if not settings.NEWS_KNOWLEDGE_SYNC_ENABLED:
        logger.info(
            "Skipping knowledge_base sync and curated_news pipeline "
            "because NEWS_KNOWLEDGE_SYNC_ENABLED is false.",
        )
        return {
            "knowledge_rows_inserted": 0,
            "knowledge_embeddings_backfilled": 0,
            "knowledge_embedding_failures": 0,
            "curated_rows_inserted": 0,
            "curated_rows_failed": 0,
        }

    news_table = _schema_table("news_data")
    knowledge_table = _schema_table("knowledge_base")
    inserted_knowledge = 0
    embedding_failures = 0
    embedding_backfilled = 0
    should_run_embedding_phase = False

    logger.info(
        "Querying database for knowledge_base embedding backlog (this should be quick).",
    )
    async with async_session_factory() as session:
        missing_embedding_count = int(
            (
                await session.scalar(
                    text(
                        f"""
                        SELECT COUNT(*)
                        FROM {knowledge_table}
                        WHERE source_type = 'news' AND embedding IS NULL
                        """
                    )
                )
            )
            or 0
        )
        unsynced_news_count = int(
            (
                await session.scalar(
                    text(
                        f"""
                        SELECT COUNT(*)
                        FROM {news_table} nd
                        WHERE NOT EXISTS (
                            SELECT 1
                            FROM {knowledge_table} kb
                            WHERE kb.metadata ->> 'news_data_id' = nd.id::text
                        )
                        """
                    )
                )
            )
            or 0
        )
        should_run_embedding_phase = missing_embedding_count > 0 or unsynced_news_count > 0

    logger.info(
        "Knowledge_base counts: rows_with_null_embedding=%s news_data_rows_not_in_kb=%s "
        "embedding_phase=%s",
        missing_embedding_count,
        unsynced_news_count,
        should_run_embedding_phase,
    )

    if should_run_embedding_phase:
        logger.info(
            "Knowledge_base Gemini embedding phase begins: requests send without delay by default "
            "(set GEMINI_EMBED_DELAY_SECONDS>0 for pacing); backoff only after HTTP 429; "
            "large backlogs can still hit quota (see batch logs)."
        )

        while True:
            async with async_session_factory() as session:
                missing_embedding_rows = (
                    await session.execute(
                        text(
                            f"""
                            SELECT id, title, content
                            FROM {knowledge_table}
                            WHERE source_type = 'news' AND embedding IS NULL
                            ORDER BY published_at ASC
                            LIMIT 300
                            """
                        )
                    )
                ).mappings().all()
                if not missing_embedding_rows:
                    break

                logger.info(
                    "Knowledge_base embedding backfill: fetched %s row(s) with NULL embedding.",
                    len(missing_embedding_rows),
                )

                round_updates = 0
                candidates = [
                    (
                        row["id"],
                        _build_embedding_input(row.get("title"), row.get("content") or ""),
                    )
                    for row in missing_embedding_rows
                ]
                valid_candidates = [
                    (row_id, text_value) for row_id, text_value in candidates if text_value
                ]
                embedding_failures += len(candidates) - len(valid_candidates)

                for start in range(0, len(valid_candidates), settings.GEMINI_EMBED_BATCH_SIZE):
                    chunk = valid_candidates[start : start + settings.GEMINI_EMBED_BATCH_SIZE]
                    slice_end_exclusive = min(
                        start + settings.GEMINI_EMBED_BATCH_SIZE,
                        len(valid_candidates),
                    )
                    logger.info(
                        "Knowledge_base backfill calling Gemini for texts %s–%s of %s in this DB batch.",
                        start + 1,
                        slice_end_exclusive,
                        len(valid_candidates),
                    )
                    vectors = await _embed_texts_with_gemini(
                        [text_value for _, text_value in chunk],
                    )
                    for (row_id, _text_value), vector in zip(chunk, vectors):
                        if vector is None:
                            embedding_failures += 1
                            continue
                        await session.execute(
                            text(f"UPDATE {knowledge_table} SET embedding = :embedding WHERE id = :row_id"),
                            {"embedding": vector, "row_id": row_id},
                        )
                        try:
                            await session.commit()
                        except SQLAlchemyError:
                            await session.rollback()
                            logger.exception(
                                "knowledge_base embedding backfill commit failed for row_id=%s",
                                row_id,
                            )
                            embedding_failures += 1
                            continue
                        embedding_backfilled += 1
                        round_updates += 1

                    ok_in_chunk = sum(1 for vector in vectors if vector is not None)
                    logger.info(
                        "Knowledge_base backfill chunk finished: successes_in_chunk=%s failures_in_chunk=%s "
                        "(cumulative backfilled=%s)",
                        ok_in_chunk,
                        len(chunk) - ok_in_chunk,
                        embedding_backfilled,
                    )

                if round_updates <= 0:
                    # Avoid infinite loop when current quota prevents any successful backfill.
                    break

        while True:
            async with async_session_factory() as session:
                result = await session.execute(
                    text(
                        f"""
                        SELECT nd.id, nd.source, nd.title, nd.content, nd.published_at, nd.scraped_at
                        FROM {news_table} nd
                        WHERE NOT EXISTS (
                            SELECT 1
                            FROM {knowledge_table} kb
                            WHERE kb.metadata ->> 'news_data_id' = nd.id::text
                        )
                        ORDER BY nd.scraped_at ASC
                        LIMIT 300
                        """
                    )
                )
                rows = result.mappings().all()
                if not rows:
                    break

                logger.info(
                    "Knowledge_base new inserts batch: syncing up to %s news_data row(s) into kb.",
                    len(rows),
                )

                prepared = [
                    (
                        row,
                        _build_embedding_input(row.get("title"), row.get("content") or ""),
                    )
                    for row in rows
                ]
                valid_prepared = [(row, text_value) for row, text_value in prepared if text_value]
                embedding_failures += len(prepared) - len(valid_prepared)
                inserts_this_iteration = 0
                for start in range(0, len(valid_prepared), settings.GEMINI_EMBED_BATCH_SIZE):
                    chunk = valid_prepared[start : start + settings.GEMINI_EMBED_BATCH_SIZE]
                    slice_end_exclusive = min(
                        start + settings.GEMINI_EMBED_BATCH_SIZE,
                        len(valid_prepared),
                    )
                    logger.info(
                        "Knowledge_base insert batch calling Gemini for texts %s–%s of %s.",
                        start + 1,
                        slice_end_exclusive,
                        len(valid_prepared),
                    )
                    vectors = await _embed_texts_with_gemini(
                        [text_value for _row, text_value in chunk],
                    )
                    for (row, _text_value), vector in zip(chunk, vectors):
                        if vector is None:
                            # Do not insert a knowledge row without embedding.
                            embedding_failures += 1
                            continue
                        session.add(
                            KnowledgeBase(
                                source_type="news",
                                title=row.get("title"),
                                content=row.get("content") or "",
                                embedding=vector,
                                published_at=row.get("published_at") or row.get("scraped_at"),
                                metadata_={
                                    "news_data_id": str(row["id"]),
                                    "source": row.get("source"),
                                },
                            )
                        )
                        try:
                            await session.commit()
                        except SQLAlchemyError:
                            await session.rollback()
                            logger.exception(
                                "knowledge_base insert commit failed for news_data_id=%s",
                                row.get("id"),
                            )
                            embedding_failures += 1
                            continue
                        inserts_this_iteration += 1
                        inserted_knowledge += 1

                    ok_in_chunk = sum(1 for vector in vectors if vector is not None)
                    logger.info(
                        "Knowledge_base insert chunk finished: successes_in_chunk=%s failures_in_chunk=%s "
                        "(cumulative inserted=%s)",
                        ok_in_chunk,
                        len(chunk) - ok_in_chunk,
                        inserted_knowledge,
                    )

                if inserts_this_iteration <= 0:
                    # Avoid infinite loop when every row in current batch fails embedding.
                    break

        logger.info("Knowledge_base Gemini embedding phase finished for this run.")

    remaining_null_embeddings = 0
    remaining_unsynced_news = 0
    async with async_session_factory() as session:
        remaining_null_embeddings = int(
            (
                await session.scalar(
                    text(
                        f"""
                        SELECT COUNT(*)
                        FROM {knowledge_table}
                        WHERE source_type = 'news' AND embedding IS NULL
                        """
                    )
                )
            )
            or 0
        )
        remaining_unsynced_news = int(
            (
                await session.scalar(
                    text(
                        f"""
                        SELECT COUNT(*)
                        FROM {news_table} nd
                        WHERE NOT EXISTS (
                            SELECT 1
                            FROM {knowledge_table} kb
                            WHERE kb.metadata ->> 'news_data_id' = nd.id::text
                        )
                        """
                    )
                )
            )
            or 0
        )
    embedding_backlog_remain = remaining_null_embeddings > 0 or remaining_unsynced_news > 0
    logger.info(
        "Knowledge_base gate for curation: "
        "null_news_embeddings=%s news_data_not_in_knowledge_base=%s backlog_blocks_curation=%s",
        remaining_null_embeddings,
        remaining_unsynced_news,
        embedding_backlog_remain,
    )

    inserted_curated = 0
    curated_failures = 0
    curate_delay_state: dict[str, float] = {"current_delay": settings.GEMINI_CURATE_DELAY_SECONDS}
    curation_enabled = force_curate or settings.NEWS_CURATION_ENABLED

    if curation_enabled and not settings.GEMINI_API_KEY.strip():
        logger.warning(
            "News curation/embeddings skipped: GEMINI_API_KEY is unset.",
        )

    if curation_enabled and settings.GEMINI_API_KEY.strip() and embedding_backlog_remain:
        logger.info(
            "Curated-news phase deferred until knowledge_base sync settles "
            "(news rows with NULL embedding=%s news_data rows not in knowledge_base=%s). "
            "Run /news/curate again after Gemini embedding catches up.",
            remaining_null_embeddings,
            remaining_unsynced_news,
        )

    if curation_enabled and settings.GEMINI_API_KEY.strip() and not embedding_backlog_remain:
        limit_items = max(settings.NEWS_CURATION_MAX_ITEMS, 1)
        logger.info(
            "Curated-news phase running (max_items=%s).",
            limit_items,
        )
        async with async_session_factory() as session:
            missing_curated_rows = (
                await session.execute(
                    text(
                        f"""
                        SELECT nd.id, nd.source, nd.title, nd.content, nd.published_at, nd.scraped_at
                        FROM {news_table} nd
                        WHERE NOT EXISTS (
                            SELECT 1
                            FROM {_schema_table("curated_news")} cn
                            WHERE cn.data_points_used ->> 'news_data_id' = nd.id::text
                        )
                        ORDER BY nd.scraped_at ASC
                        LIMIT :max_items
                        """
                    ),
                    {
                        "max_items": limit_items,
                    },
                )
            ).mappings().all()

            pending_curate_count = len(missing_curated_rows)
            logger.info(
                "Curated-news: loaded %s news row(s) without a curated_news row this run.",
                pending_curate_count,
            )
            if pending_curate_count == 0:
                logger.info(
                    "Curated-news: nothing to do (every ingested story already has curated_news "
                    "or NEWS_CURATION_MAX_ITEMS yielded an empty batch).",
                )

            for row in missing_curated_rows:
                source = str(row.get("source") or "NEWS")
                title = str(row.get("title") or "")
                content = str(row.get("content") or "")
                published_at_value = row.get("published_at") or row.get("scraped_at")
                if not isinstance(published_at_value, datetime):
                    published_at_value = datetime.now(timezone.utc)

                logger.info(
                    "Curated-news: calling Gemini for news_data_id=%s source=%s title_preview=%s",
                    row["id"],
                    source,
                    _single_line_log_preview(title, 160),
                )
                curated = await _rephrase_news_item_with_gemini(
                    source=source,
                    title=title,
                    content=content,
                    published_at=published_at_value,
                    delay_state=curate_delay_state,
                )
                if not curated:
                    logger.warning(
                        "Curated-news: Gemini did not produce a row for news_data_id=%s "
                        "(see earlier WARNING lines for HTTP/JSON details).",
                        row["id"],
                    )
                    curated_failures += 1
                    continue

                story_published_at = row.get("published_at")
                if not isinstance(story_published_at, datetime):
                    story_published_at = row.get("scraped_at")
                if not isinstance(story_published_at, datetime):
                    story_published_at = published_at_value

                english_headline = str(curated.get("headline") or "").strip()
                resolved_asset_id = await _resolve_asset_id_for_news_text(
                    session,
                    english_headline,
                    curated["summary"],
                    content,
                )

                dp_used: dict[str, Any] = {
                    "news_data_id": str(row["id"]),
                    "source": source,
                    "title": english_headline or title,
                }
                raw_title = str(title or "").strip()
                if raw_title and raw_title != dp_used["title"]:
                    dp_used["original_title"] = raw_title

                session.add(
                    CuratedNews(
                        summary=curated["summary"],
                        sentiment_score=curated["sentiment_score"],
                        published_at=story_published_at,
                        asset_id=resolved_asset_id,
                        data_points_used=dp_used,
                    )
                )
                try:
                    await session.commit()
                except SQLAlchemyError:
                    await session.rollback()
                    logger.exception(
                        "curated_news insert commit failed for news_data_id=%s",
                        row.get("id"),
                    )
                    curated_failures += 1
                    continue
                inserted_curated += 1
                logger.info(
                    "Curated-news: committed news_data_id=%s curated_row_count_this_run=%s "
                    "headline_preview=%s sentiment=%s asset_id=%s",
                    row["id"],
                    inserted_curated,
                    _single_line_log_preview(english_headline or title, 160),
                    curated.get("sentiment_score"),
                    resolved_asset_id,
                )

    if inserted_knowledge > 0:
        await _append_scraper_log("KNOWLEDGE_BASE", "SUCCESS", None, inserted_knowledge)
    if embedding_backfilled > 0:
        await _append_scraper_log("KNOWLEDGE_BACKFILL", "SUCCESS", None, embedding_backfilled)
    if embedding_failures > 0:
        await _append_scraper_log(
            "KNOWLEDGE_BASE",
            "ERROR",
            f"Embedding failed for {embedding_failures} row(s).",
            embedding_failures,
        )
    if inserted_curated > 0:
        await _append_scraper_log("CURATED_NEWS", "SUCCESS", None, inserted_curated)
    if curated_failures > 0:
        await _append_scraper_log(
            "CURATED_NEWS",
            "ERROR",
            f"Curation failed for {curated_failures} row(s).",
            curated_failures,
        )
    result_summary: dict[str, int] = {
        "knowledge_rows_inserted": inserted_knowledge,
        "knowledge_embeddings_backfilled": embedding_backfilled,
        "knowledge_embedding_failures": embedding_failures,
        "curated_rows_inserted": inserted_curated,
        "curated_rows_failed": curated_failures,
    }

    logger.info(
        "News knowledge/curation pipeline finished: "
        "knowledge_inserted=%s embedding_backfilled=%s embedding_failures=%s "
        "curated_inserted=%s curated_failed=%s",
        inserted_knowledge,
        embedding_backfilled,
        embedding_failures,
        inserted_curated,
        curated_failures,
    )
    return result_summary

async def run_news_curation_once() -> dict[str, int]:
    """
    Backfill missing embeddings and generate curated news from existing DB rows.

    Unlike ``run_news_scraper_ingest_once``, this function does not call external scrapers.
    """
    return await _sync_news_into_knowledge_base_and_curated_news(force_curate=True)

async def run_news_scraper_ingest_once() -> dict[str, Any]:
    """
    Run ``scrapers/main.py`` via ``uv``, then upsert-equivalent insert (skip duplicates).

    Appends one ``scraper_logs`` row per site (``BLOOMBERG``, ``INVESTING``, …). Failures
    before JSON is parsed use ``source=NEWS_INGEST`` once. Returns aggregate counts for logging.
    """
    out_path: Optional[Path] = None
    per_source_logging_started = False

    try:
        scrapers_dir = _default_scrapers_dir()
        if not (scrapers_dir / "main.py").is_file():
            raise FileNotFoundError(f"scrapers main.py not found under {scrapers_dir}")

        with tempfile.NamedTemporaryFile(
            prefix="tauron-scrape-",
            suffix=".json",
            delete=False,
        ) as tmp:
            out_path = Path(tmp.name)

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
        sources = data.get("sources")
        if not isinstance(sources, dict):
            raise ValueError("Merged scraper JSON missing a 'sources' object.")

        per_source_logging_started = True
        total_articles = 0
        total_inserted = 0

        for folder, block in sources.items():
            label = _FOLDER_TO_SOURCE_LABEL.get(folder, folder.upper())[:50]
            if not isinstance(block, dict):
                await _append_scraper_log(label, "ERROR", "Invalid source block in scrape JSON", None)
                continue
            if not block.get("ok"):
                err = str(block.get("error") or "scrape failed")[:8000]
                await _append_scraper_log(label, "ERROR", err, None)
                continue
            raw_arts = block.get("articles")
            if not isinstance(raw_arts, list):
                await _append_scraper_log(label, "SUCCESS", None, 0)
                continue
            art_list = [a for a in raw_arts if isinstance(a, dict)]
            total_articles += len(art_list)
            inserted = 0
            if art_list:
                async with async_session_factory() as session:
                    inserted = await _insert_news_rows(session, art_list)
            total_inserted += inserted
            await _append_scraper_log(label, "SUCCESS", None, inserted)

        logger.info(
            "News ingest finished: %d articles across sources, %d new rows inserted.",
            total_articles,
            total_inserted,
        )
        sync_summary = await _sync_news_into_knowledge_base_and_curated_news()
        return {
            "articles_in_file": total_articles,
            "rows_inserted": total_inserted,
            **sync_summary,
        }
    except Exception as exc:
        if not per_source_logging_started:
            await _append_scraper_log(
                "NEWS_INGEST",
                "ERROR",
                str(exc)[:8000],
                None,
            )
        raise exc
    finally:
        if out_path is not None:
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
    prereq = news_scrape_prerequisite_error()
    if prereq is not None:
        logger.warning("News scraper worker not started: %s", prereq)
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
