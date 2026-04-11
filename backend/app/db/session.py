"""Async SQLAlchemy engine and session factory for PostgreSQL."""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings


def _asyncpg_connect_args() -> dict:
    """
    Configure asyncpg (timeouts, TLS, optional statement cache).

    ``search_path`` is not set here: passing it via ``server_settings`` in the
    startup packet has been observed to trigger immediate TCP resets on some
    Windows and PostgreSQL combinations. Table names use ``MetaData(schema=...)``
    and DDL in bootstrap uses qualified names, so search_path is not required.
    """
    args: dict = {
        "timeout": settings.POSTGRES_CONNECT_TIMEOUT,
    }
    if settings.POSTGRES_SSL:
        args["ssl"] = True
    if settings.POSTGRES_ASYNCPG_STATEMENT_CACHE_SIZE is not None:
        args["statement_cache_size"] = settings.POSTGRES_ASYNCPG_STATEMENT_CACHE_SIZE
    return args


def _psycopg_connect_args() -> dict:
    """
    Configure psycopg3 async connections.

    psycopg rejects asyncpg's ``timeout`` key; use ``connect_timeout`` (seconds).
    """
    args: dict = {
        "connect_timeout": int(settings.POSTGRES_CONNECT_TIMEOUT),
    }
    if settings.POSTGRES_SSL:
        args["sslmode"] = "require"
    return args


def _postgres_connect_args_for_url(url: str) -> dict:
    """Return driver-specific kwargs for SQLAlchemy ``connect_args``."""
    if "+psycopg" in url:
        return _psycopg_connect_args()
    if "+asyncpg" in url:
        return _asyncpg_connect_args()
    return _asyncpg_connect_args()


def _create_engine():
    """Build the async engine with dialect-appropriate ``connect_args``."""
    url = settings.DATABASE_URL
    kwargs: dict = {
        "echo": settings.DEBUG,
        "pool_pre_ping": True,
    }
    if url.startswith("postgresql"):
        kwargs["connect_args"] = _postgres_connect_args_for_url(url)
    return create_async_engine(url, **kwargs)


engine = _create_engine()

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db_session() -> AsyncIterator[AsyncSession]:
    """Yield an async database session for FastAPI dependency injection."""
    async with async_session_factory() as database_session:
        yield database_session
