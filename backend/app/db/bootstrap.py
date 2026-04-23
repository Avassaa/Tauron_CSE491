"""Create PostgreSQL schema, extensions, ORM tables, hypertables, and vector indexes on startup."""

import asyncio
import logging
import re
from typing import Optional
from urllib.parse import quote, urlparse, urlunparse

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.config import settings
from app.db.session import _postgres_connect_args_for_url

logger = logging.getLogger(__name__)

_MISSING_DATABASE_HINT = (
    "The PostgreSQL database in your URL (POSTGRES_DB or the path in "
    "DATABASE_URL_OVERRIDE) does not exist yet. Connect to the default "
    "`postgres` database and run CREATE DATABASE with that name, enable "
    "POSTGRES_AUTO_CREATE_DATABASE (default true), or point POSTGRES_MAINTENANCE_DATABASE "
    "at a database your role can use."
)

_SAFE_DATABASE_IDENTIFIER = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


def _is_duplicate_database_error(primary_exception: BaseException) -> bool:
    """Return True when PostgreSQL reports the database already exists."""
    pending: list[BaseException] = [primary_exception]
    seen: set[int] = set()
    while pending:
        cursor = pending.pop()
        cursor_id = id(cursor)
        if cursor_id in seen:
            continue
        seen.add(cursor_id)
        if getattr(cursor, "pgcode", None) == "42P04":
            return True
        message_lower = str(cursor).lower()
        if "already exists" in message_lower:
            return True
        if cursor.__cause__ is not None:
            pending.append(cursor.__cause__)
        context = getattr(cursor, "__context__", None)
        if context is not None:
            pending.append(context)
        original = getattr(cursor, "orig", None)
        if original is not None:
            pending.append(original)
    return False


def _postgresql_url_swap_path_database(url: str, database_name: str) -> str:
    """Return the same DSN with only the path segment replaced by ``/database_name``."""
    parsed = urlparse(url)
    path = "/" + quote(database_name, safe="")
    return urlunparse((parsed.scheme, parsed.netloc, path, "", "", ""))


async def _ensure_postgres_database_exists_when_enabled() -> None:
    """
    If enabled, connect to the maintenance database and CREATE DATABASE when missing.

    Only simple unquoted PostgreSQL identifiers are supported for auto-creation.
    """
    if not settings.POSTGRES_AUTO_CREATE_DATABASE:
        return
    base_url = settings.DATABASE_URL
    if not base_url.startswith("postgresql"):
        return
    target = settings.effective_database_name
    if not _SAFE_DATABASE_IDENTIFIER.match(target):
        logger.warning(
            "POSTGRES_AUTO_CREATE_DATABASE skipped: database name %r must match "
            "[a-zA-Z_][a-zA-Z0-9_]* for automatic creation.",
            target,
        )
        return
    maintenance_url = _postgresql_url_swap_path_database(
        base_url,
        settings.POSTGRES_MAINTENANCE_DATABASE,
    )
    maintenance_engine = create_async_engine(
        maintenance_url,
        echo=settings.DEBUG,
        pool_pre_ping=True,
        connect_args=_postgres_connect_args_for_url(maintenance_url),
    )
    try:
        exists = None
        for attempt in range(30):
            try:
                async with maintenance_engine.connect() as conn:
                    exists = await conn.scalar(
                        text("SELECT 1 FROM pg_database WHERE datname = :name"),
                        {"name": target},
                    )
                break
            except Exception as exc:
                if attempt == 29:
                    raise exc
                await asyncio.sleep(1.0)
        if exists is not None:
            return
        async with maintenance_engine.connect() as conn:
            await conn.execution_options(isolation_level="AUTOCOMMIT")
            try:
                await conn.execute(text(f"CREATE DATABASE {target}"))
            except Exception as exc:
                if _is_duplicate_database_error(exc):
                    return
                raise
        logger.info("Created PostgreSQL database %s.", target)
    finally:
        await maintenance_engine.dispose()


def _bootstrap_extra_hint(primary_exception: BaseException) -> str:
    """Return a short hint when the exception chain indicates a known bootstrap failure."""
    pending: list[BaseException] = [primary_exception]
    seen: set[int] = set()
    text_blob_parts: list[str] = []
    while pending:
        cursor = pending.pop()
        cursor_id = id(cursor)
        if cursor_id in seen:
            continue
        seen.add(cursor_id)
        if getattr(cursor, "pgcode", None) == "3D000":
            return _MISSING_DATABASE_HINT
        text_blob_parts.append(str(cursor).lower())
        if getattr(cursor, "args", None):
            for arg in cursor.args:
                text_blob_parts.append(str(arg).lower())
        if cursor.__cause__ is not None:
            pending.append(cursor.__cause__)
        context = getattr(cursor, "__context__", None)
        if context is not None:
            pending.append(context)
        original = getattr(cursor, "orig", None)
        if original is not None:
            pending.append(original)
    blob = " ".join(text_blob_parts)
    if "3d000" in blob:
        return _MISSING_DATABASE_HINT
    if "does not exist" in blob and "database" in blob:
        return _MISSING_DATABASE_HINT
    if "veritaban" in blob:
        return _MISSING_DATABASE_HINT
    if "undefined_database" in blob:
        return _MISSING_DATABASE_HINT
    return ""


def _register_all_orm_models() -> None:
    """Import model modules so ``Base.metadata`` contains every table."""
    import app.db.models.asset
    import app.db.models.backtest_results
    import app.db.models.chat_history
    import app.db.models.curated_news
    import app.db.models.knowledge_base
    import app.db.models.market_data
    import app.db.models.ml_models
    import app.db.models.news_data
    import app.db.models.on_chain_metrics
    import app.db.models.predictions
    import app.db.models.scraper_logs
    import app.db.models.technical_indicators
    import app.db.models.user
    import app.db.models.watchlists


async def bootstrap_database(engine: AsyncEngine) -> None:
    """
    Provision the database when using PostgreSQL: schema ``DATABASE_SCHEMA``,
    extensions, tables from ORM metadata, Timescale hypertables when available,
    and an HNSW index on ``knowledge_base.embedding`` when pgvector is available.
    """
    if not settings.BOOTSTRAP_DATABASE_ON_STARTUP:
        logger.info("Database bootstrap skipped (BOOTSTRAP_DATABASE_ON_STARTUP is false).")
        return

    if engine.dialect.name != "postgresql":
        logger.info(
            "Database bootstrap skipped (dialect is %s; PostgreSQL required for full schema).",
            engine.dialect.name,
        )
        return

    schema: Optional[str] = settings.effective_database_schema

    await _ensure_postgres_database_exists_when_enabled()

    try:
        await _run_bootstrap(engine, schema)
    except Exception as exc:
        logger.exception("Database bootstrap failed.")
        extra = _bootstrap_extra_hint(exc)
        base = (
            "Could not connect to PostgreSQL or run DDL. Verify POSTGRES_HOST, POSTGRES_PORT, "
            "POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, and that the server accepts TCP "
            "connections. For Neon, Supabase, Azure, RDS, or other TLS-only hosts, set "
            "POSTGRES_SSL=true. On Windows, if the connection resets immediately, try "
            "POSTGRES_HOST=127.0.0.1 instead of localhost. If problems persist with asyncpg, "
            "set DATABASE_URL_OVERRIDE to use the psycopg3 async driver, for example "
            "postgresql+psycopg://USER:PASSWORD@127.0.0.1:5432/DBNAME (requires the psycopg package)."
        )
        if extra:
            base = f"{base} {extra}"
        raise RuntimeError(base) from exc


async def _run_bootstrap(engine: AsyncEngine, schema: Optional[str]) -> None:
    """Execute schema creation, extensions, tables, hypertables, and indexes."""
    async with engine.begin() as conn:
        if schema:
            await conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))

    async with engine.begin() as conn:
        try:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE"))
        except Exception as exc:
            logger.warning(
                "TimescaleDB extension could not be created (%s); hypertables will be skipped.",
                exc,
            )

    async with engine.begin() as conn:
        try:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        except Exception as exc:
            logger.warning(
                "pgvector extension could not be created (%s); embedding index may be skipped.",
                exc,
            )

    async with engine.begin() as conn:
        _register_all_orm_models()
        from app.db.base import Base

        def create_all_tables(sync_connection):
            Base.metadata.create_all(sync_connection, checkfirst=True)

        await conn.run_sync(create_all_tables)

    hypertable_names = (
        "market_data",
        "technical_indicators",
        "on_chain_metrics",
        "predictions",
    )
    for hypertable_name in hypertable_names:
        async with engine.begin() as conn:
            if schema:
                await conn.execute(text(f'SET search_path TO "{schema}", public'))
            try:
                await conn.execute(
                    text(
                        f"SELECT create_hypertable('{hypertable_name}', 'time', "
                        f"if_not_exists => TRUE)"
                    )
                )
            except Exception as exc:
                logger.warning("%s hypertable: %s", hypertable_name, exc)

    async with engine.begin() as conn:
        if schema:
            await conn.execute(text(f'SET search_path TO "{schema}", public'))
        try:
            await conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_knowledge_base_embedding_hnsw "
                    "ON knowledge_base USING hnsw (embedding vector_l2_ops)"
                )
            )
        except Exception as exc:
            logger.warning("knowledge_base HNSW index: %s", exc)

    logger.info("Database bootstrap completed for schema %s.", schema or "public")
