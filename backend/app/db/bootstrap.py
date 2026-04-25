"""Create PostgreSQL schema, extensions, ORM tables, hypertables, and vector indexes on startup."""

import asyncio
import json
import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Optional
from urllib.parse import quote, urlparse, urlunparse
from urllib.request import Request, urlopen

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.config import settings
from app.db.session import _postgres_connect_args_for_url

logger = logging.getLogger(__name__)
_COINMETRICS_URL = "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics"
_COINMETRICS_CATALOG_URL = "https://community-api.coinmetrics.io/v4/catalog/asset-metrics"
_METRIC_BATCH_SIZE = 30

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


def _parse_csv_setting(raw: str) -> list[str]:
    return [part.strip() for part in raw.split(",") if part.strip()]


def _chunked(values: list[str], chunk_size: int) -> list[list[str]]:
    if chunk_size <= 0:
        return [values]
    return [values[i : i + chunk_size] for i in range(0, len(values), chunk_size)]


def _asset_seed_rows_for_symbols(symbols: list[str]) -> list[dict[str, str | None]]:
    defaults: dict[str, tuple[str, str | None]] = {
        "BTC": ("Bitcoin", "bitcoin"),
        "ETH": ("Ethereum", "ethereum"),
        "SOL": ("Solana", "solana"),
        "BNB": ("BNB", "binancecoin"),
        "XRP": ("XRP", "ripple"),
        "ADA": ("Cardano", "cardano"),
        "DOGE": ("Dogecoin", "dogecoin"),
    }
    rows: list[dict[str, str | None]] = []
    for symbol in symbols:
        name, coingecko_id = defaults.get(symbol, (symbol, None))
        rows.append(
            {
                "id": str(uuid.uuid4()),
                "symbol": symbol,
                "name": name,
                "category": "Layer1",
                "coingecko_id": coingecko_id,
            }
        )
    return rows


def _to_decimal(value: str | None) -> Decimal | None:
    if value in (None, ""):
        return None
    try:
        return Decimal(value)
    except (InvalidOperation, ValueError):
        return None


def _parse_ts(raw: str) -> datetime:
    return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(timezone.utc)


def _fetch_coinmetrics_rows_sync(
    symbol: str,
    metrics: list[str],
    start_time: datetime,
    end_time: datetime,
    frequency: str = "1d",
) -> list[dict]:
    params = (
        f"assets={symbol.lower()}"
        f"&metrics={','.join(metrics)}"
        f"&frequency={frequency}"
        f"&start_time={start_time.isoformat().replace('+00:00', 'Z')}"
        f"&end_time={end_time.isoformat().replace('+00:00', 'Z')}"
        "&page_size=10000"
    )
    url = f"{_COINMETRICS_URL}?{params}"
    request = Request(url, headers={"User-Agent": "tauron-bootstrap/1.0"})
    with urlopen(request, timeout=45) as response:
        payload = json.loads(response.read().decode("utf-8"))
    data = payload.get("data")
    if not isinstance(data, list):
        return []
    return data


def _fetch_available_metrics_for_symbol_sync(symbol: str) -> list[str]:
    """
    Query CoinMetrics catalog and return metric names for one asset symbol.

    Falls back to an empty list if catalog shape differs.
    """
    url = f"{_COINMETRICS_CATALOG_URL}?assets={symbol.lower()}"
    request = Request(url, headers={"User-Agent": "tauron-bootstrap/1.0"})
    with urlopen(request, timeout=45) as response:
        payload = json.loads(response.read().decode("utf-8"))
    data = payload.get("data")
    if not isinstance(data, list):
        return []

    metrics: list[str] = []
    symbol_lower = symbol.lower()
    for row in data:
        if not isinstance(row, dict):
            continue
        metric = row.get("metric")
        if isinstance(metric, str):
            metrics.append(metric)
            continue
        row_assets = row.get("assets")
        if isinstance(row_assets, list) and symbol_lower in row_assets:
            nested = row.get("metrics")
            if isinstance(nested, list):
                metrics.extend([m for m in nested if isinstance(m, str)])
    return sorted(set(metrics))


async def auto_populate_onchain_if_empty(engine: AsyncEngine) -> None:
    """
    Seed assets and backfill on-chain metrics when ``on_chain_metrics`` is empty.

    This is intended for first boot in local/docker setups.
    """
    if not settings.AUTO_POPULATE_ONCHAIN_ON_EMPTY_DB:
        return
    if engine.dialect.name != "postgresql":
        return

    schema = settings.effective_database_schema
    symbols = [s.upper() for s in _parse_csv_setting(settings.AUTO_POPULATE_ONCHAIN_SYMBOLS)]
    metrics_config = _parse_csv_setting(settings.AUTO_POPULATE_ONCHAIN_METRICS)
    if not symbols:
        logger.info("Auto-populate skipped: no symbols configured.")
        return

    table_prefix = f'"{schema}".' if schema else ""

    # Always ensure configured assets exist (e.g., SOL) even if metrics table is not empty.
    asset_seed_rows = _asset_seed_rows_for_symbols(symbols)
    async with engine.begin() as conn:
        await conn.execute(
            text(
                f"""
                INSERT INTO {table_prefix}assets (id, symbol, name, category, coingecko_id, is_active)
                VALUES (CAST(:id AS uuid), :symbol, :name, :category, :coingecko_id, TRUE)
                ON CONFLICT (symbol) DO NOTHING
                """
            ),
            asset_seed_rows,
        )

    async with engine.connect() as conn:
        onchain_count = int(
            (await conn.scalar(text(f"SELECT COUNT(*) FROM {table_prefix}on_chain_metrics"))) or 0
        )
    if onchain_count > 0:
        logger.info("Auto-populate metrics skipped: on_chain_metrics already has data.")
        return

    logger.info("Auto-populate: on_chain_metrics is empty, seeding assets and backfilling.")

    async with engine.connect() as conn:
        rows = (
            await conn.execute(
                text(
                    f"SELECT id::text AS id, symbol FROM {table_prefix}assets"
                ),
            )
        ).mappings()
        symbol_to_asset_id = {
            row["symbol"].upper(): row["id"]
            for row in rows
            if row["symbol"] and row["symbol"].upper() in symbols
        }

    missing_symbols = [symbol for symbol in symbols if symbol not in symbol_to_asset_id]
    if missing_symbols:
        logger.warning("Auto-populate skipped missing assets: %s", ", ".join(missing_symbols))
        return

    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(days=max(settings.AUTO_POPULATE_ONCHAIN_YEARS, 1) * 365)

    to_insert: list[dict[str, object]] = []
    for symbol in symbols:
        requested_metrics = metrics_config
        if len(metrics_config) == 1 and metrics_config[0].upper() == "ALL":
            try:
                requested_metrics = await asyncio.to_thread(
                    _fetch_available_metrics_for_symbol_sync, symbol
                )
            except Exception as exc:
                logger.warning("Auto-populate metric catalog fetch failed for %s: %s", symbol, exc)
                requested_metrics = []

        if not requested_metrics:
            logger.warning("Auto-populate found no metrics for %s; skipping.", symbol)
            continue

        try:
            points: list[dict] = []
            for metric_chunk in _chunked(requested_metrics, _METRIC_BATCH_SIZE):
                points.extend(
                    await asyncio.to_thread(
                        _fetch_coinmetrics_rows_sync,
                        symbol,
                        metric_chunk,
                        start_time,
                        end_time,
                        "1d",
                    )
                )
        except Exception as exc:
            logger.warning("Auto-populate fetch failed for %s: %s", symbol, exc)
            continue

        asset_id = symbol_to_asset_id[symbol]
        points_by_time: dict[str, dict] = {}
        for point in points:
            time_raw = point.get("time")
            if isinstance(time_raw, str):
                points_by_time.setdefault(time_raw, {}).update(point)

        for time_raw, point in points_by_time.items():
            if not isinstance(time_raw, str):
                continue
            point_time = _parse_ts(time_raw)
            for metric in requested_metrics:
                value = _to_decimal(point.get(metric))
                if value is None:
                    continue
                to_insert.append(
                    {
                        "time": point_time,
                        "asset_id": asset_id,
                        "metric_name": metric,
                        "value": value,
                    }
                )
        logger.info(
            "Auto-populate %s: collected %s rows from %s metrics.",
            symbol,
            len([r for r in to_insert if r["asset_id"] == asset_id]),
            len(requested_metrics),
        )

    if not to_insert:
        logger.warning("Auto-populate finished with 0 rows fetched.")
        return

    async with engine.begin() as conn:
        await conn.execute(
            text(
                f"""
                INSERT INTO {table_prefix}on_chain_metrics (time, asset_id, metric_name, value)
                VALUES (:time, CAST(:asset_id AS uuid), :metric_name, :value)
                ON CONFLICT (time, asset_id, metric_name)
                DO UPDATE SET value = EXCLUDED.value
                """
            ),
            to_insert,
        )
    logger.info("Auto-populate completed: %s on_chain_metrics rows upserted.", len(to_insert))
