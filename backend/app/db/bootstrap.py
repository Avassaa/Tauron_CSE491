"""Create PostgreSQL schema, extensions, ORM tables, hypertables, and vector indexes on startup."""

import asyncio
import json
import logging
import re
import ssl
import uuid
from datetime import datetime, timedelta, timezone
from decimal import InvalidOperation
from typing import Optional
from urllib.parse import quote, urlencode, urlparse, urlunparse
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import certifi
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import settings
from app.db.session import _postgres_connect_args_for_url

logger = logging.getLogger(__name__)
_COINMETRICS_URL = "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics"
_COINMETRICS_CATALOG_URL = "https://community-api.coinmetrics.io/v4/catalog/asset-metrics"
_BINANCE_EXCHANGE_INFO_URL = "https://api.binance.com/api/v3/exchangeInfo"
_BINANCE_TICKER_24H_URL = "https://api.binance.com/api/v3/ticker/24hr"
_BINANCE_KLINES_URL = "https://api.binance.com/api/v3/klines"
_COINMETRICS_SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
_METRIC_BATCH_SIZE = 30
_FALLBACK_METRICS = ["ReferenceRateUSD", "CapMrktCurUSD", "SplyCur", "TxCnt"]
_DEFAULT_ONCHAIN_SYMBOLS = [
    "BTC",
    "ETH",
    "USDT",
    "SOL",
    "ADA",
    "XRP",
    "DOT",
    "DOGE",
    "AVAX",
    "LINK",
    "SHIB",
    "MATIC",
    "LTC",
    "NEAR",
    "UNI",
    "ICP",
    "DAI",
    "BCH",
    "STX",
    "ATOM",
    "OP",
    "ARB",
    "APT",
    "SUI",
    "PEPE",
    "RNDR",
    "FET",
    "TIA",
    "INJ",
    "FIL",
    "VET",
    "ALGO",
    "QNT",
    "IMX",
    "EGLD",
    "THETA",
    "HBAR",
    "AAVE",
    "MKR",
    "SNX",
    "GRT",
    "BNB",
    "TRX",
    "XLM",
    "ETC",
    "EOS",
    "XTZ",
    "SAND",
    "MANA",
    "AXS",
    "RUNE",
    "FLOW",
    "KAVA",
    "GALA",
    "LDO",
    "CRV",
    "COMP",
    "ZEC",
    "DASH",
    "MINA",
]

_MISSING_DATABASE_HINT = (
    "The PostgreSQL database in your URL (POSTGRES_DB or the path in "
    "DATABASE_URL_OVERRIDE) does not exist yet. Connect to the default "
    "`postgres` database and run CREATE DATABASE with that name, enable "
    "POSTGRES_AUTO_CREATE_DATABASE (default true), or point POSTGRES_MAINTENANCE_DATABASE "
    "at a database your role can use."
)

_SAFE_DATABASE_IDENTIFIER = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")
_SAFE_ASSET_SYMBOL = re.compile(r"^[A-Z0-9]{1,10}$")


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
    import app.db.models.news_comment
    import app.db.models.news_data
    import app.db.models.on_chain_metrics
    import app.db.models.predictions
    import app.db.models.price_alerts
    import app.db.models.scraper_logs
    import app.db.models.technical_indicators
    import app.db.models.user
    import app.db.models.user_notifications
    import app.db.models.watchlists
    import app.db.models.watchlist_lists


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

    curated_table = f'"{schema}".curated_news' if schema else "curated_news"
    news_comments_table = f'"{schema}".news_comments' if schema else "news_comments"
    async with engine.begin() as conn:
        await conn.execute(
            text(
                f"ALTER TABLE {curated_table} "
                "ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ"
            )
        )
    async with engine.begin() as conn:
        await conn.execute(
            text(
                f"ALTER TABLE {news_comments_table} "
                "ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ"
            )
        )
    async with engine.begin() as conn:
        await conn.execute(
            text(
                f"ALTER TABLE {news_comments_table} "
                "ADD COLUMN IF NOT EXISTS parent_id UUID"
            )
        )
    async with engine.begin() as conn:
        try:
            await conn.execute(
                text(
                    f"ALTER TABLE {news_comments_table} ADD CONSTRAINT "
                    "news_comments_parent_id_fkey FOREIGN KEY (parent_id) "
                    f"REFERENCES {news_comments_table} (id) ON DELETE CASCADE"
                )
            )
        except Exception as exc:
            logger.warning(
                "news_comments.parent_id foreign key not added (may already exist): %s",
                exc,
            )
    async with engine.begin() as conn:
        if schema:
            await conn.execute(text(f'SET search_path TO "{schema}", public'))
        try:
            await conn.execute(
                text(
                    """
                    UPDATE curated_news cn
                    SET published_at = nd.published_at
                    FROM news_data nd
                    WHERE cn.data_points_used->>'news_data_id' = nd.id::text
                      AND cn.published_at IS NULL
                      AND nd.published_at IS NOT NULL
                    """
                )
            )
        except Exception as exc:
            logger.warning("curated_news published_at backfill skipped: %s", exc)

    async with engine.begin() as conn:
        if schema:
            await conn.execute(
                text(
                    f"""
                    ALTER TABLE "{schema}".on_chain_metrics
                    ALTER COLUMN value TYPE DOUBLE PRECISION
                    """
                )
            )
        else:
            await conn.execute(
                text(
                    """
                    ALTER TABLE on_chain_metrics
                    ALTER COLUMN value TYPE DOUBLE PRECISION
                    """
                )
            )

    ml_models_rel = f'"{schema}".ml_models' if schema else "ml_models"
    async with engine.begin() as conn:
        await conn.execute(
            text(f"ALTER TABLE {ml_models_rel} ADD COLUMN IF NOT EXISTS display_name VARCHAR(120)"),
        )

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


def _unique_upper(values: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for value in values:
        symbol = value.strip().upper()
        if not symbol or symbol in seen:
            continue
        seen.add(symbol)
        out.append(symbol)
    return out


def _chunked(values: list[str], chunk_size: int) -> list[list[str]]:
    if chunk_size <= 0:
        return [values]
    return [values[i : i + chunk_size] for i in range(0, len(values), chunk_size)]


def _asset_seed_rows_for_symbols(symbols: list[str]) -> list[dict[str, str | None]]:
    defaults: dict[str, tuple[str, str | None, str]] = {
        "BTC": ("Bitcoin", "bitcoin", "Layer1"),
        "ETH": ("Ethereum", "ethereum", "Layer1"),
        "USDT": ("Tether", "tether", "Stablecoin"),
        "SOL": ("Solana", "solana", "Layer1"),
        "ADA": ("Cardano", "cardano", "Layer1"),
        "XRP": ("XRP", "ripple", "Layer1"),
        "DOT": ("Polkadot", "polkadot", "Layer1"),
        "DOGE": ("Dogecoin", "dogecoin", "Meme"),
        "AVAX": ("Avalanche", "avalanche-2", "Layer1"),
        "LINK": ("Chainlink", "chainlink", "Infrastructure"),
        "SHIB": ("Shiba Inu", "shiba-inu", "Meme"),
        "MATIC": ("Polygon", "matic-network", "Layer2"),
        "LTC": ("Litecoin", "litecoin", "Layer1"),
        "NEAR": ("NEAR Protocol", "near", "Layer1"),
        "UNI": ("Uniswap", "uniswap", "DeFi"),
        "ICP": ("Internet Computer", "internet-computer", "Layer1"),
        "DAI": ("Dai", "dai", "Stablecoin"),
        "BCH": ("Bitcoin Cash", "bitcoin-cash", "Layer1"),
        "STX": ("Stacks", "stacks", "Layer2"),
        "ATOM": ("Cosmos", "cosmos", "Layer1"),
        "OP": ("Optimism", "optimism", "Layer2"),
        "ARB": ("Arbitrum", "arbitrum", "Layer2"),
        "APT": ("Aptos", "aptos", "Layer1"),
        "SUI": ("Sui", "sui", "Layer1"),
        "PEPE": ("Pepe", "pepe", "Meme"),
        "RNDR": ("Render", "render-token", "AI"),
        "FET": ("Fetch.ai", "fetch-ai", "AI"),
        "TIA": ("Celestia", "celestia", "Modular"),
        "INJ": ("Injective", "injective-protocol", "DeFi"),
        "FIL": ("Filecoin", "filecoin", "Storage"),
        "VET": ("VeChain", "vechain", "Supply Chain"),
        "ALGO": ("Algorand", "algorand", "Layer1"),
        "QNT": ("Quant", "quant-network", "Infrastructure"),
        "IMX": ("Immutable", "immutable-x", "Gaming"),
        "EGLD": ("MultiversX", "elrond-erd-2", "Layer1"),
        "THETA": ("Theta Network", "theta-token", "Streaming"),
        "HBAR": ("Hedera", "hedera-hashgraph", "Layer1"),
        "AAVE": ("Aave", "aave", "DeFi"),
        "MKR": ("Maker", "maker", "DeFi"),
        "SNX": ("Synthetix", "synthetix-network-token", "DeFi"),
        "GRT": ("The Graph", "the-graph", "Indexing"),
        "BNB": ("BNB", "binancecoin", "Exchange"),
        "TRX": ("TRON", "tron", "Layer1"),
        "XLM": ("Stellar", "stellar", "Payments"),
        "ETC": ("Ethereum Classic", "ethereum-classic", "Layer1"),
        "EOS": ("EOS", "eos", "Layer1"),
        "XTZ": ("Tezos", "tezos", "Layer1"),
        "SAND": ("The Sandbox", "the-sandbox", "Gaming"),
        "MANA": ("Decentraland", "decentraland", "Gaming"),
        "AXS": ("Axie Infinity", "axie-infinity", "Gaming"),
        "RUNE": ("THORChain", "thorchain", "DeFi"),
        "FLOW": ("Flow", "flow", "NFT"),
        "KAVA": ("Kava", "kava", "DeFi"),
        "GALA": ("Gala", "gala", "Gaming"),
        "LDO": ("Lido DAO", "lido-dao", "DeFi"),
        "CRV": ("Curve DAO", "curve-dao-token", "DeFi"),
        "COMP": ("Compound", "compound-governance-token", "DeFi"),
        "ZEC": ("Zcash", "zcash", "Privacy"),
        "DASH": ("Dash", "dash", "Payments"),
        "MINA": ("Mina Protocol", "mina-protocol", "Zero Knowledge"),
    }
    rows: list[dict[str, str | None]] = []
    for symbol in symbols:
        name, coingecko_id, category = defaults.get(symbol, (symbol, None, "Layer1"))
        rows.append(
            {
                "id": str(uuid.uuid4()),
                "symbol": symbol,
                "name": name,
                "category": category,
                "coingecko_id": coingecko_id,
            }
        )
    return rows


def _fetch_top_markets_from_binance_sync(limit: int) -> list[dict[str, str | None]]:
    requested = max(int(limit), 1)
    exchange_req = Request(
        _BINANCE_EXCHANGE_INFO_URL,
        headers={"User-Agent": "tauron-bootstrap/1.0"},
    )
    with urlopen(exchange_req, timeout=45, context=_COINMETRICS_SSL_CONTEXT) as response:
        exchange_payload = json.loads(response.read().decode("utf-8"))
    symbols_payload = exchange_payload.get("symbols") if isinstance(exchange_payload, dict) else None
    if not isinstance(symbols_payload, list):
        return []

    tradable_pairs: set[str] = set()
    for row in symbols_payload:
        if not isinstance(row, dict):
            continue
        symbol = row.get("symbol")
        status = row.get("status")
        quote = row.get("quoteAsset")
        if not isinstance(symbol, str) or status != "TRADING":
            continue
        if quote not in {"USDT", "USD"}:
            continue
        tradable_pairs.add(symbol.upper())

    ticker_req = Request(
        _BINANCE_TICKER_24H_URL,
        headers={"User-Agent": "tauron-bootstrap/1.0"},
    )
    with urlopen(ticker_req, timeout=45, context=_COINMETRICS_SSL_CONTEXT) as response:
        ticker_payload = json.loads(response.read().decode("utf-8"))
    if not isinstance(ticker_payload, list):
        return []

    best_by_base: dict[str, float] = {}
    for row in ticker_payload:
        if not isinstance(row, dict):
            continue
        pair = row.get("symbol")
        if not isinstance(pair, str):
            continue
        pair = pair.upper()
        if pair not in tradable_pairs:
            continue
        quote = "USDT" if pair.endswith("USDT") else ("USD" if pair.endswith("USD") else None)
        if quote is None:
            continue
        base = pair[: -len(quote)]
        if not _SAFE_ASSET_SYMBOL.match(base):
            continue
        try:
            qv = float(row.get("quoteVolume") or 0.0)
        except (TypeError, ValueError):
            qv = 0.0
        if qv > best_by_base.get(base, -1.0):
            best_by_base[base] = qv

    ranked = sorted(best_by_base.items(), key=lambda kv: kv[1], reverse=True)[:requested]
    return [{"symbol": base, "name": base, "coingecko_id": None} for base, _ in ranked]


def _to_decimal(value: str | None) -> float | None:
    if value in (None, ""):
        return None
    try:
        parsed = float(value)
        if parsed == float("inf") or parsed == float("-inf"):
            return None
        if parsed != parsed:
            return None
        return parsed
    except (InvalidOperation, ValueError, OverflowError):
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
        "&ignore_forbidden_errors=true"
    )
    url = f"{_COINMETRICS_URL}?{params}"
    request = Request(url, headers={"User-Agent": "tauron-bootstrap/1.0"})
    with urlopen(request, timeout=45, context=_COINMETRICS_SSL_CONTEXT) as response:
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
    symbol_lower = symbol.lower()
    urls = [
        f"{_COINMETRICS_CATALOG_URL}?assets={symbol_lower}",
        _COINMETRICS_CATALOG_URL,
    ]
    payload: dict | None = None
    for idx, url in enumerate(urls):
        request = Request(url, headers={"User-Agent": "tauron-bootstrap/1.0"})
        try:
            with urlopen(request, timeout=45, context=_COINMETRICS_SSL_CONTEXT) as response:
                payload = json.loads(response.read().decode("utf-8"))
            break
        except HTTPError as exc:
            # Some assets (e.g. SOL) can fail with filtered catalog query.
            # Retry once with the unfiltered catalog and filter locally.
            if idx == 0 and exc.code == 400:
                continue
            raise
    if payload is None:
        return []
    data = payload.get("data")
    if not isinstance(data, list):
        return []

    metrics: list[str] = []
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
    configured_symbols = _parse_csv_setting(settings.AUTO_POPULATE_ONCHAIN_SYMBOLS)
    symbols = _unique_upper(configured_symbols)
    fetched_top_coins: list[dict[str, str | None]] = []
    if not symbols:
        top_n = max(settings.AUTO_POPULATE_ONCHAIN_TOP_MARKETS, 1)
        try:
            fetched_top_coins = await asyncio.to_thread(
                _fetch_top_markets_from_binance_sync,
                top_n,
            )
            symbols = _unique_upper([coin["symbol"] for coin in fetched_top_coins])
            logger.info(
                "Auto-populate symbols sourced from Binance top markets: requested=%s fetched=%s unique=%s",
                top_n,
                len(fetched_top_coins),
                len(symbols),
            )
        except Exception as exc:
            logger.warning(
                "Auto-populate Binance fetch failed; falling back to defaults: %s",
                exc,
            )
            symbols = _unique_upper(_DEFAULT_ONCHAIN_SYMBOLS)

    metrics_config = _parse_csv_setting(settings.AUTO_POPULATE_ONCHAIN_METRICS)
    if not symbols:
        logger.info("Auto-populate skipped: no symbols configured.")
        return

    table_prefix = f'"{schema}".' if schema else ""

    asset_seed_rows = _asset_seed_rows_for_symbols(symbols)
    if fetched_top_coins:
        coin_map = {coin["symbol"]: coin for coin in fetched_top_coins}
        for row in asset_seed_rows:
            symbol = row["symbol"]
            coin = coin_map.get(symbol) if isinstance(symbol, str) else None
            if coin is None:
                continue
            row["name"] = coin["name"]
            row["coingecko_id"] = coin["coingecko_id"]
            row["category"] = "Crypto"

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

    await auto_populate_market_data_if_empty(engine)

    logger.info("Auto-populate: ensuring configured symbols have on-chain metrics.")

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
        logger.warning(
            "Auto-populate missing assets (will continue with available symbols): %s",
            ", ".join(missing_symbols),
        )

    symbols_to_backfill: list[str] = []
    async with engine.connect() as conn:
        for symbol in symbols:
            asset_id = symbol_to_asset_id[symbol]
            metric_count = int(
                (
                    await conn.scalar(
                        text(
                            f"""
                            SELECT COUNT(*) FROM {table_prefix}on_chain_metrics
                            WHERE asset_id = CAST(:asset_id AS uuid)
                            """
                        ),
                        {"asset_id": asset_id},
                    )
                )
                or 0
            )
            if metric_count <= 0:
                symbols_to_backfill.append(symbol)
            else:
                logger.info(
                    "Auto-populate %s: skipped (%s metric rows already exist).",
                    symbol,
                    metric_count,
                )

    if not symbols_to_backfill:
        logger.info("Auto-populate skipped: all configured symbols already have on-chain metrics.")
        return
    logger.info(
        "Auto-populate symbols queued for backfill: %s",
        ", ".join(symbols_to_backfill),
    )

    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(days=max(settings.AUTO_POPULATE_ONCHAIN_YEARS, 1) * 365)

    to_insert: list[dict[str, object]] = []
    total_symbols = len(symbols_to_backfill)
    for index, symbol in enumerate(symbols_to_backfill, start=1):
        logger.info(
            "Auto-populate progress: %s/%s symbol=%s remaining=%s",
            index,
            total_symbols,
            symbol,
            total_symbols - index,
        )
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

        points: list[dict] = []
        for metric_chunk in _chunked(requested_metrics, _METRIC_BATCH_SIZE):
            try:
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
            except HTTPError as exc:
                logger.warning(
                    "Auto-populate fetch chunk failed for %s (HTTP %s): %s; continuing.",
                    symbol,
                    exc.code,
                    ",".join(metric_chunk),
                )
            except Exception as exc:
                logger.warning(
                    "Auto-populate fetch chunk failed for %s: %s; continuing.",
                    symbol,
                    exc,
                )

        if not points:
            if len(metrics_config) == 1 and metrics_config[0].upper() == "ALL":
                logger.warning(
                    "Auto-populate ALL metrics returned no points for %s; trying fallback metrics.",
                    symbol,
                )
                for metric_chunk in _chunked(_FALLBACK_METRICS, _METRIC_BATCH_SIZE):
                    try:
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
                        requested_metrics = _FALLBACK_METRICS
                    except Exception as exc:
                        logger.warning(
                            "Auto-populate fallback chunk failed for %s: %s; continuing.",
                            symbol,
                            exc,
                        )
            if not points:
                logger.warning("Auto-populate fetch failed for %s: no points returned.", symbol)
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
            "Auto-populate progress: %s/%s symbol=%s collected_rows=%s metrics=%s",
            index,
            total_symbols,
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


def _compose_binance_spot_pair_slug(base_asset_symbol: str, quote_asset: str) -> str | None:
    """Join base and quote for Binance Spot klines requests, or decline invalid pairs."""

    stripped_base = base_asset_symbol.strip().upper()
    stripped_quote = quote_asset.strip().upper()
    if not stripped_base or not stripped_quote:
        return None
    if stripped_base == stripped_quote:
        return None
    if not _SAFE_ASSET_SYMBOL.match(stripped_base):
        return None
    composite = f"{stripped_base}{stripped_quote}"
    if len(composite) > 24:
        return None
    return composite


def _fetch_binance_klines_segment_sync(*, pair_symbol: str, interval: str, start_ms: int, end_ms: int) -> list[list]:
    """
    Retrieve up to ``limit`` klines ascending by open time inside an inclusive millis window.

    Returns the raw Binance JSON array payloads (list rows) upon success, otherwise [].
    """

    window_lo = int(min(start_ms, end_ms))
    window_hi = int(max(start_ms, end_ms))
    query = urlencode(
        {
            "symbol": pair_symbol,
            "interval": interval,
            "startTime": str(window_lo),
            "endTime": str(window_hi),
            "limit": "1000",
        }
    )
    full_url = f"{_BINANCE_KLINES_URL}?{query}"
    request_builder = Request(full_url, headers={"User-Agent": "tauron-bootstrap/1.0"})
    try:
        with urlopen(request_builder, timeout=60, context=_COINMETRICS_SSL_CONTEXT) as response_handle:
            payload = json.loads(response_handle.read().decode("utf-8"))
    except HTTPError:
        return []
    except Exception:
        logger.exception(
            "Binance klines request failed unexpectedly for interval=%s symbol=%s",
            interval,
            pair_symbol,
        )
        return []

    return payload if isinstance(payload, list) else []


def _materialize_daily_market_payloads_from_klines(
    *,
    asset_primary_key_text: str,
    klines_nested_arrays: list[list],
) -> list[dict[str, object]]:
    """Flatten Binance kline arrays into dictionaries suitable for Postgres upsert."""

    materialized_batches: list[dict[str, object]] = []

    for kline_row in klines_nested_arrays:
        if not isinstance(kline_row, list) or len(kline_row) < 6:
            continue
        opened_at_millis_raw = kline_row[0]
        try:
            opened_at_epoch_ms = int(opened_at_millis_raw)
        except (TypeError, ValueError):
            continue

        bucket_open_wallclock = datetime.fromtimestamp(
            opened_at_epoch_ms / 1000.0,
            tz=timezone.utc,
        )

        numeric_open_price = float(kline_row[1])
        numeric_high_price = float(kline_row[2])
        numeric_low_price = float(kline_row[3])
        numeric_close_price = float(kline_row[4])
        numeric_base_volume_total = float(kline_row[5])

        materialized_batches.append(
            {
                "time": bucket_open_wallclock,
                "asset_id": asset_primary_key_text,
                "open": numeric_open_price,
                "high": numeric_high_price,
                "low": numeric_low_price,
                "close": numeric_close_price,
                "volume": numeric_base_volume_total,
                "resolution": "1d",
            }
        )

    return materialized_batches


def _harvest_daily_klines_across_deep_history_sync(pair_symbol: str, lookback_days: int) -> list[list]:
    """Page Binance ``1d`` klines forward from the lookback horizon through the current wall clock."""

    if lookback_days <= 0:
        return []

    millisecond_span_per_day = 86_400_000

    coarse_end_epoch_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    coarse_start_epoch_ms = int(
        (datetime.now(timezone.utc) - timedelta(days=lookback_days)).timestamp() * 1000
    )

    chronological_accumulator: list[list] = []
    rolling_window_start_ms = coarse_start_epoch_ms

    maximum_http_round_trips = max(lookback_days // 900 + 6, 12)
    http_round_trips_completed = 0

    while rolling_window_start_ms <= coarse_end_epoch_ms and http_round_trips_completed < maximum_http_round_trips:
        http_round_trips_completed += 1
        segment_payload = _fetch_binance_klines_segment_sync(
            pair_symbol=pair_symbol,
            interval="1d",
            start_ms=rolling_window_start_ms,
            end_ms=coarse_end_epoch_ms,
        )
        if not segment_payload:
            break
        chronological_accumulator.extend(segment_payload)
        last_kline_open_ms = int(segment_payload[-1][0])
        rolling_window_start_ms = last_kline_open_ms + millisecond_span_per_day
        if len(segment_payload) < 1000:
            break

    deduplicated_by_open_time: dict[int, list] = {}
    for candidate_row in chronological_accumulator:
        if not isinstance(candidate_row, list) or not candidate_row:
            continue
        opened_at_key = int(candidate_row[0])
        if opened_at_key < coarse_start_epoch_ms or opened_at_key > coarse_end_epoch_ms:
            continue
        deduplicated_by_open_time[opened_at_key] = candidate_row

    ordered_open_stamps = sorted(deduplicated_by_open_time.keys())
    return [deduplicated_by_open_time[stamp] for stamp in ordered_open_stamps]


async def auto_populate_market_data_if_empty(engine: AsyncEngine) -> None:
    """
    When ``market_data`` is empty, hydrate daily Binance Spot OHLC rows for capped active assets.

    Intended for compose-first-boot alongside ``auto_populate_onchain_if_empty`` so ML joins close prices.
    """

    if not settings.AUTO_POPULATE_MARKET_DATA_ON_EMPTY_DB:
        return

    if engine.dialect.name != "postgresql":
        return

    schema_namespace = settings.effective_database_schema

    dotted_table_prefix_piece = f'"{schema_namespace}".' if schema_namespace else ""

    async with engine.connect() as conn:
        count_scalar = await conn.scalar(text(f"SELECT COUNT(*) FROM {dotted_table_prefix_piece}market_data"))

    total_rows_existing = int(count_scalar or 0)

    if total_rows_existing > 0:
        logger.info(
            "Market-data auto-populate skipped: market_data already has %s rows.",
            total_rows_existing,
        )
        return

    asset_row_cap = max(int(settings.AUTO_POPULATE_MARKET_DATA_MAX_ASSETS), 1)
    lookback_span_days = max(int(settings.AUTO_POPULATE_MARKET_DATA_LOOKBACK_DAYS), 30)
    quote_currency = settings.AUTO_POPULATE_MARKET_DATA_QUOTE_ASSET.strip().upper() or "USDT"

    async with engine.connect() as conn:
        asset_cursor = await conn.execute(
            text(
                f"""
                SELECT id::text AS asset_id_text, symbol
                FROM {dotted_table_prefix_piece}assets
                WHERE is_active IS TRUE
                ORDER BY symbol ASC
                LIMIT :row_cap
                """
            ),
            {"row_cap": asset_row_cap},
        )
        asset_mapping_tuples = asset_cursor.mappings().all()

    if not asset_mapping_tuples:
        logger.warning("Market-data auto-populate skipped: zero active assets in registry.")
        return

    logger.info(
        "Market-data auto-populate starting for up to %s assets (lookback_days=%s quote=%s).",
        len(asset_mapping_tuples),
        lookback_span_days,
        quote_currency,
    )

    accumulated_market_rows: list[dict[str, object]] = []

    for asset_row in asset_mapping_tuples:
        symbol_text = str(asset_row["symbol"]).strip().upper()
        asset_uuid_text = str(asset_row["asset_id_text"])

        pair_token = _compose_binance_spot_pair_slug(symbol_text, quote_currency)
        if pair_token is None:
            logger.warning(
                "Market-data auto-populate skipped symbol=%s (cannot compose Binance pair).",
                symbol_text,
            )
            continue

        deep_klines_nested = await asyncio.to_thread(
            _harvest_daily_klines_across_deep_history_sync,
            pair_token,
            lookback_span_days,
        )

        if not deep_klines_nested:
            logger.warning(
                "Market-data auto-populate Binance returned no rows for symbol=%s pair=%s",
                symbol_text,
                pair_token,
            )
            continue

        accumulated_market_rows.extend(
            _materialize_daily_market_payloads_from_klines(
                asset_primary_key_text=asset_uuid_text,
                klines_nested_arrays=deep_klines_nested,
            )
        )

        await asyncio.sleep(0.12)

    if not accumulated_market_rows:
        logger.warning("Market-data auto-populate finished with zero rows inserted.")
        return

    async with engine.begin() as conn:
        await conn.execute(
            text(
                f"""
                INSERT INTO {dotted_table_prefix_piece}market_data
                    (time, asset_id, open, high, low, close, volume, resolution)
                VALUES
                    (:time, CAST(:asset_id AS uuid), :open, :high, :low, :close, :volume, :resolution)
                ON CONFLICT (time, asset_id)
                DO UPDATE SET
                    open = EXCLUDED.open,
                    high = EXCLUDED.high,
                    low = EXCLUDED.low,
                    close = EXCLUDED.close,
                    volume = EXCLUDED.volume,
                    resolution = EXCLUDED.resolution
                """
            ),
            accumulated_market_rows,
        )

    logger.info(
        "Market-data auto-populate completed: %s market_data rows upserted.",
        len(accumulated_market_rows),
    )


async def backfill_onchain_for_asset(
    session: AsyncSession,
    *,
    asset_id: str,
    symbol: str,
    years: int | None = None,
) -> int:
    """
    Backfill one asset's on-chain metrics using CoinMetrics.

    Returns the number of upserted metric rows.
    """
    normalized_symbol = symbol.strip().upper()
    if not normalized_symbol:
        return 0

    metrics_config = _parse_csv_setting(settings.AUTO_POPULATE_ONCHAIN_METRICS)
    requested_metrics = metrics_config
    if len(metrics_config) == 1 and metrics_config[0].upper() == "ALL":
        try:
            requested_metrics = await asyncio.to_thread(
                _fetch_available_metrics_for_symbol_sync, normalized_symbol
            )
        except Exception as exc:
            logger.warning(
                "On-chain backfill metric catalog fetch failed for %s: %s",
                normalized_symbol,
                exc,
            )
            requested_metrics = []

    if not requested_metrics:
        logger.warning("On-chain backfill found no metrics for %s.", normalized_symbol)
        return 0

    end_time = datetime.now(timezone.utc)
    lookback_years = max(years if years is not None else settings.AUTO_POPULATE_ONCHAIN_YEARS, 1)
    start_time = end_time - timedelta(days=lookback_years * 365)

    points: list[dict] = []
    for metric_chunk in _chunked(requested_metrics, _METRIC_BATCH_SIZE):
        try:
            points.extend(
                await asyncio.to_thread(
                    _fetch_coinmetrics_rows_sync,
                    normalized_symbol,
                    metric_chunk,
                    start_time,
                    end_time,
                    "1d",
                )
            )
        except Exception as exc:
            logger.warning(
                "On-chain backfill fetch chunk failed for %s: %s; continuing.",
                normalized_symbol,
                exc,
            )

    if not points and len(metrics_config) == 1 and metrics_config[0].upper() == "ALL":
        logger.warning(
            "On-chain backfill ALL metrics returned no points for %s; trying fallback metrics.",
            normalized_symbol,
        )
        for metric_chunk in _chunked(_FALLBACK_METRICS, _METRIC_BATCH_SIZE):
            try:
                points.extend(
                    await asyncio.to_thread(
                        _fetch_coinmetrics_rows_sync,
                        normalized_symbol,
                        metric_chunk,
                        start_time,
                        end_time,
                        "1d",
                    )
                )
                requested_metrics = _FALLBACK_METRICS
            except Exception as exc:
                logger.warning(
                    "On-chain backfill fallback chunk failed for %s: %s; continuing.",
                    normalized_symbol,
                    exc,
                )

    points_by_time: dict[str, dict] = {}
    for point in points:
        time_raw = point.get("time")
        if isinstance(time_raw, str):
            points_by_time.setdefault(time_raw, {}).update(point)

    to_insert: list[dict[str, object]] = []
    for time_raw, point in points_by_time.items():
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

    if not to_insert:
        return 0

    schema = settings.effective_database_schema
    table_prefix = f'"{schema}".' if schema else ""
    await session.execute(
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
    await session.commit()
    logger.info(
        "On-chain backfill completed for %s: %s rows upserted.",
        normalized_symbol,
        len(to_insert),
    )
    return len(to_insert)


async def backfill_onchain_for_asset_detached(
    *,
    asset_id: str,
    symbol: str,
    years: int | None = None,
) -> None:
    """
    Detached helper that creates its own DB session and runs one-asset backfill.

    Intended for fire-and-forget background execution from API routes.
    """
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        pool_pre_ping=True,
        connect_args=_postgres_connect_args_for_url(settings.DATABASE_URL),
    )
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with session_factory() as session:
            await backfill_onchain_for_asset(
                session,
                asset_id=asset_id,
                symbol=symbol,
                years=years,
            )
    finally:
        await engine.dispose()
