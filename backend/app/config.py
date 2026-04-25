"""Environment-driven settings for the service and infrastructure."""

from urllib.parse import quote_plus, unquote, urlparse

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application and infrastructure configuration loaded from the environment."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    SERVICE_ID: str = "tauron"
    SERVICE_NAME: str = "Tauron"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000

    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    ADMIN_API_KEY: str = Field(
        default="",
        description="Shared secret for X-Admin-Key header on ingestion and admin routes.",
    )

    RATE_LIMIT_MAX_ATTEMPTS: int = 100
    RATE_LIMIT_WINDOW_HOURS: int = 1

    CORS_ORIGINS: str = "http://localhost:5173"
    CORS_ALLOW_CREDENTIALS: bool = True

    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = ""
    POSTGRES_DB: str = "tauron"

    POSTGRES_SSL: bool = Field(
        default=False,
        description="Enable TLS for asyncpg (required for many hosted Postgres providers).",
    )

    POSTGRES_CONNECT_TIMEOUT: int = Field(
        default=10,
        description="Seconds to wait when opening a TCP connection to PostgreSQL.",
    )

    POSTGRES_ASYNCPG_STATEMENT_CACHE_SIZE: int | None = Field(
        default=None,
        description="If set (e.g. 0), passed to asyncpg for compatibility with PgBouncer/Neon.",
    )

    DATABASE_URL_OVERRIDE: str = Field(
        default="",
        description="If set, used as the async SQLAlchemy URL instead of POSTGRES_* fields.",
    )

    DATABASE_SCHEMA: str = Field(
        default="tauron",
        description="PostgreSQL schema that holds all application tables. Set empty for public.",
    )

    BOOTSTRAP_DATABASE_ON_STARTUP: bool = Field(
        default=True,
        description="When True and the database is PostgreSQL, create schema, extensions, and tables on startup.",
    )

    POSTGRES_AUTO_CREATE_DATABASE: bool = Field(
        default=True,
        description="When True, connect to the maintenance database and CREATE DATABASE if the target DB is missing.",
    )

    POSTGRES_MAINTENANCE_DATABASE: str = Field(
        default="postgres",
        description="Cluster database used only to run CREATE DATABASE (must already exist).",
    )

    EXTERNAL_API_URL: str = Field(
        default="",
        description="URL of external API to integrate with",
    )
    EXTERNAL_API_KEY: str = Field(
        default="",
        description="API key for external service",
    )
    ENABLE_FEATURE_X: bool = Field(
        default=False,
        description="Enable experimental feature X",
    )
    REQUEST_TIMEOUT_SECONDS: int = Field(
        default=30,
        description="Timeout for external requests",
    )

    NEWS_SCRAPER_WORKER_ENABLED: bool = Field(
        default=False,
        description="When True, run scrapers/main.py on an interval and ingest into news_data.",
    )
    NEWS_SCRAPER_INTERVAL_SECONDS: int = Field(
        default=86400,
        description="Sleep between successful scraper runs (default 86400 = 24 hours).",
    )

    AUTO_POPULATE_ONCHAIN_ON_EMPTY_DB: bool = Field(
        default=True,
        description=(
            "When True, startup auto-populates assets and on_chain_metrics if "
            "on_chain_metrics is empty."
        ),
    )
    AUTO_POPULATE_ONCHAIN_SYMBOLS: str = Field(
        default="BTC,ETH,SOL",
        description="Comma-separated symbols to backfill (must exist or be auto-seeded).",
    )
    AUTO_POPULATE_ONCHAIN_METRICS: str = Field(
        default="ALL",
        description='Comma-separated CoinMetrics metrics to fetch, or "ALL".',
    )
    AUTO_POPULATE_ONCHAIN_YEARS: int = Field(
        default=5,
        description="How many years of historical on-chain data to backfill on empty DB.",
    )

    @property
    def CORS_ORIGINS_LIST(self) -> list[str]:
        """Parse ``CORS_ORIGINS`` as a comma-separated list."""
        return [part.strip() for part in self.CORS_ORIGINS.split(",") if part.strip()]

    @property
    def DATABASE_URL(self) -> str:
        """Async SQLAlchemy URL (PostgreSQL via asyncpg, or ``DATABASE_URL_OVERRIDE``)."""
        if self.DATABASE_URL_OVERRIDE.strip():
            return self.DATABASE_URL_OVERRIDE.strip()
        user = quote_plus(self.POSTGRES_USER)
        password = quote_plus(self.POSTGRES_PASSWORD)
        return (
            f"postgresql+asyncpg://{user}:{password}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def effective_database_schema(self) -> str | None:
        """Return the schema name, or None when empty (use public / default)."""
        cleaned = (self.DATABASE_SCHEMA or "").strip()
        return cleaned if cleaned else None

    @property
    def effective_database_name(self) -> str:
        """Return the database name from POSTGRES_* or from DATABASE_URL_OVERRIDE path."""
        override = self.DATABASE_URL_OVERRIDE.strip()
        if override:
            parsed = urlparse(override)
            raw_segment = (parsed.path or "/").strip("/").split("/")[0]
            if raw_segment:
                return unquote(raw_segment)
        return self.POSTGRES_DB


settings = Settings()
