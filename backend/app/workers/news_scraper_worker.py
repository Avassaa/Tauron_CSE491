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

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models.curated_news import CuratedNews
from app.db.models.knowledge_base import KnowledgeBase
from app.db.models.news_data import NewsData
from app.db.repositories.scraper_log_repository import ScraperLogRepository
from app.db.session import async_session_factory

logger = logging.getLogger(__name__)

_news_worker_task: Optional[asyncio.Task[None]] = None

# Fixed operational defaults (not env-configurable).
_SCRAPER_INITIAL_DELAY_SECONDS = 300
_SCRAPER_SUBPROCESS_TIMEOUT_SECONDS = 7200
_UV_COMMAND = "uv"
_EMBED_BASE_DELAY_SECONDS = 6.0
_EMBED_BATCH_SIZE = 20
_CURATE_BASE_DELAY_SECONDS = 6.0

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
    """``…/repo/scrapers`` when the repo layout is ``…/repo/backend/app/workers/``."""
    return Path(__file__).resolve().parents[3] / "scrapers"


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


async def _embed_texts_with_gemini(
    text_values: list[str],
    *,
    delay_state: Optional[dict[str, float]] = None,
) -> list[Optional[list[float]]]:
    if not settings.GEMINI_API_KEY.strip() or not text_values:
        return [None for _ in text_values]
    if delay_state is not None:
        current_delay = float(
            max(delay_state.get("current_delay", _EMBED_BASE_DELAY_SECONDS), 0.0),
        )
        await asyncio.sleep(current_delay)
    endpoint = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.GEMINI_EMBEDDING_MODEL}:embedContent?key={settings.GEMINI_API_KEY}"
    )
    payload = {
        "requests": [
            {
                "model": f"models/{settings.GEMINI_EMBEDDING_MODEL}",
                "content": {"parts": [{"text": text_value}]},
                "outputDimensionality": settings.GEMINI_EMBEDDING_DIMENSIONS,
            }
            for text_value in text_values
        ]
    }
    endpoint = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.GEMINI_EMBEDDING_MODEL}:batchEmbedContents?key={settings.GEMINI_API_KEY}"
    )
    try:
        response = await asyncio.to_thread(_gemini_post_json_sync, endpoint, payload)
    except HTTPError as exc:
        if exc.code == 429 and delay_state is not None:
            current_delay = float(
                max(delay_state.get("current_delay", _EMBED_BASE_DELAY_SECONDS), 0.0),
            )
            next_delay = max(current_delay, _EMBED_BASE_DELAY_SECONDS) * 2
            delay_state["current_delay"] = next_delay
            logger.warning(
                "Gemini embedding rate-limited (429). Increasing embed delay to %.1fs.",
                next_delay,
            )
        logger.warning("Gemini embedding request failed: %s", exc)
        return [None for _ in text_values]
    except (HTTPError, URLError, TimeoutError) as exc:
        logger.warning("Gemini embedding request failed: %s", exc)
        return [None for _ in text_values]

    embeddings_raw = response.get("embeddings")
    if not isinstance(embeddings_raw, list):
        logger.warning("Gemini batch embedding response missing embeddings array.")
        return [None for _ in text_values]

    vectors = [_parse_embedding_vector(item) for item in embeddings_raw]
    if len(vectors) < len(text_values):
        vectors.extend([None] * (len(text_values) - len(vectors)))
    return vectors[: len(text_values)]


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
            max(delay_state.get("current_delay", _CURATE_BASE_DELAY_SECONDS), 0.0),
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
        "You are a crypto news editor. Rephrase the following single news article into a concise, "
        "neutral, end-user friendly summary.\n"
        "Return strict JSON with keys: summary (string), sentiment_score (number between -1 and 1).\n\n"
        f"Source: {source}\n"
        f"Published at: {published_at.isoformat()}\n"
        f"Title: {cleaned_title}\n"
        f"Content: {cleaned_content}"
    )
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    try:
        response = await asyncio.to_thread(_gemini_post_json_sync, endpoint, payload)
    except HTTPError as exc:
        if exc.code == 429 and delay_state is not None:
            current_delay = float(
                max(delay_state.get("current_delay", _CURATE_BASE_DELAY_SECONDS), 0.0),
            )
            next_delay = max(current_delay, _CURATE_BASE_DELAY_SECONDS) * 2
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
    }


async def _sync_news_into_knowledge_base_and_curated_news(
    *,
    force_curate: bool = False,
) -> dict[str, int]:
    if not settings.NEWS_KNOWLEDGE_SYNC_ENABLED:
        return {"knowledge_rows_inserted": 0, "curated_rows_inserted": 0}

    news_table = _schema_table("news_data")
    knowledge_table = _schema_table("knowledge_base")
    inserted_knowledge = 0
    embedding_failures = 0
    embedding_backfilled = 0
    embed_delay_state: dict[str, float] = {"current_delay": _EMBED_BASE_DELAY_SECONDS}
    should_run_embedding_phase = False

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

    if should_run_embedding_phase:
        # First, try to repair all existing rows that previously landed with NULL embeddings.
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

                for start in range(0, len(valid_candidates), _EMBED_BATCH_SIZE):
                    chunk = valid_candidates[start : start + _EMBED_BATCH_SIZE]
                    vectors = await _embed_texts_with_gemini(
                        [text_value for _, text_value in chunk],
                        delay_state=embed_delay_state,
                    )
                    for (row_id, _text_value), vector in zip(chunk, vectors):
                        if vector is None:
                            embedding_failures += 1
                            continue
                        await session.execute(
                            text(f"UPDATE {knowledge_table} SET embedding = :embedding WHERE id = :row_id"),
                            {"embedding": vector, "row_id": row_id},
                        )
                        embedding_backfilled += 1
                        round_updates += 1

                if round_updates > 0:
                    await session.commit()
                else:
                    # Avoid infinite loop when current quota prevents any successful backfill.
                    break

        # Then process all news_data rows not represented in knowledge_base (in batches).
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
                prepared = [
                    (
                        row,
                        _build_embedding_input(row.get("title"), row.get("content") or ""),
                    )
                    for row in rows
                ]
                valid_prepared = [(row, text_value) for row, text_value in prepared if text_value]
                embedding_failures += len(prepared) - len(valid_prepared)
                to_add: list[KnowledgeBase] = []
                for start in range(0, len(valid_prepared), _EMBED_BATCH_SIZE):
                    chunk = valid_prepared[start : start + _EMBED_BATCH_SIZE]
                    vectors = await _embed_texts_with_gemini(
                        [text_value for _row, text_value in chunk],
                        delay_state=embed_delay_state,
                    )
                    for (row, _text_value), vector in zip(chunk, vectors):
                        if vector is None:
                            # Do not insert a knowledge row without embedding.
                            embedding_failures += 1
                            continue
                        to_add.append(
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
                if to_add:
                    session.add_all(to_add)
                    await session.commit()
                    inserted_knowledge += len(to_add)
                else:
                    # Avoid infinite loop when every row in current batch fails embedding.
                    break

    inserted_curated = 0
    curated_failures = 0
    curate_delay_state: dict[str, float] = {"current_delay": _CURATE_BASE_DELAY_SECONDS}
    curation_enabled = force_curate or settings.NEWS_CURATION_ENABLED
    if curation_enabled and settings.GEMINI_API_KEY.strip() and not should_run_embedding_phase:
        async with async_session_factory() as session:
            # Queue-style capped throughput: process only one curation batch per run.
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
                        "max_items": max(settings.NEWS_CURATION_MAX_ITEMS, 1),
                    },
                )
            ).mappings().all()

            for row in missing_curated_rows:
                source = str(row.get("source") or "NEWS")
                title = str(row.get("title") or "")
                content = str(row.get("content") or "")
                published_at_value = row.get("published_at") or row.get("scraped_at")
                if not isinstance(published_at_value, datetime):
                    published_at_value = datetime.now(timezone.utc)

                curated = await _rephrase_news_item_with_gemini(
                    source=source,
                    title=title,
                    content=content,
                    published_at=published_at_value,
                    delay_state=curate_delay_state,
                )
                if not curated:
                    curated_failures += 1
                    continue

                session.add(
                    CuratedNews(
                        summary=curated["summary"],
                        sentiment_score=curated["sentiment_score"],
                        data_points_used={
                            "news_data_id": str(row["id"]),
                            "source": source,
                            "title": title,
                        },
                    )
                )
                inserted_curated += 1

            if inserted_curated > 0:
                await session.commit()

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
    return {
        "knowledge_rows_inserted": inserted_knowledge,
        "knowledge_embeddings_backfilled": embedding_backfilled,
        "knowledge_embedding_failures": embedding_failures,
        "curated_rows_inserted": inserted_curated,
        "curated_rows_failed": curated_failures,
    }


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
