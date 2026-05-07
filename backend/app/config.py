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
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    RESET_PASSWORD_TOKEN_EXPIRE_MINUTES: int = 15

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
    NEWS_KNOWLEDGE_SYNC_ENABLED: bool = Field(
        default=True,
        description=(
            "When True, after each scrape run sync unsynced news_data rows into knowledge_base."
        ),
    )
    NEWS_CURATION_ENABLED: bool = Field(
        default=True,
        description="When True, create curated_news summaries after knowledge sync.",
    )
    NEWS_CURATION_LOOKBACK_HOURS: int = Field(
        default=24,
        description="How far back (hours) curated summary generation reads news rows from.",
    )
    NEWS_CURATION_MAX_ITEMS: int = Field(
        default=20,
        description="Maximum number of recent news rows used for one curated summary prompt.",
    )
    GEMINI_API_KEY: str = Field(
        default="",
        description="Google Gemini API key used for embeddings and curated summaries.",
    )
    GEMINI_TEXT_MODEL: str = Field(
        default="gemini-2.0-flash",
        description="Gemini model name for text generation (curated summary).",
    )
    GEMINI_EMBEDDING_MODEL: str = Field(
        default="gemini-embedding-001",
        description="Gemini embedding model name for knowledge_base vectors.",
    )
    GEMINI_EMBEDDING_DIMENSIONS: int = Field(
        default=1536,
        description="Target output dimensions for embeddings stored in pgvector.",
    )
    GEMINI_EMBED_BATCH_SIZE: int = Field(
        default=8,
        ge=1,
        le=200,
        description="News texts per Gemini embedding burst; lower reduces 429 risk.",
    )
    GEMINI_EMBED_DELAY_SECONDS: float = Field(
        default=0.0,
        ge=0.0,
        description=(
            "Optional pacing: seconds to sleep before **each** embed HTTP attempt when greater than zero. "
            "Default zero sends requests without a fixed delay."
        ),
    )
    GEMINI_EMBED_429_INITIAL_BACKOFF_SECONDS: float = Field(
        default=4.0,
        ge=0.0,
        description="Sleep duration before retrying embed same text after Gemini HTTP 429 (then doubles until max).",
    )
    GEMINI_EMBED_429_MAX_BACKOFF_SECONDS: float = Field(
        default=120.0,
        ge=1.0,
        description="Cap for exponential backoff after repeated embedding 429 responses.",
    )
    GEMINI_EMBED_429_MAX_RETRIES: int = Field(
        default=14,
        ge=1,
        le=128,
        description="Maximum embedding HTTP attempts per text (counts each HTTP try including 429 retries).",
    )
    GEMINI_CURATE_DELAY_SECONDS: float = Field(
        default=15.0,
        ge=0.0,
        description="Seconds to wait between Gemini curated-summary HTTP calls.",
    )

    # Email Settings
    SMTP_HOST: str = Field(default="", description="SMTP server host (e.g., smtp.gmail.com)")
    SMTP_PORT: int = Field(default=587, description="SMTP server port")
    SMTP_USER: str = Field(default="", description="SMTP username / email")
    SMTP_PASSWORD: str = Field(default="", description="SMTP password or app password")
    SMTP_FROM_EMAIL: str = Field(default="", description="Sender email address")
    FRONTEND_URL: str = Field(
        default="http://localhost:5173",
        description="Base URL of the frontend application for email links",
    )

    COMMENT_IMAGE_STORAGE_DIR: str = Field(
        default="",
        description=(
            "Absolute or cwd-relative directory for news comment images. "
            "Empty uses backend/data/comment_images."
        ),
    )

    AUTO_POPULATE_ONCHAIN_ON_EMPTY_DB: bool = Field(
        default=True,
        description=(
            "When True, startup auto-populates assets and on_chain_metrics if "
            "on_chain_metrics is empty."
        ),
    )
    AUTO_POPULATE_ONCHAIN_SYMBOLS: str = Field(
        default="",
        description="Comma-separated symbols to backfill on startup (optional).",
    )
    AUTO_POPULATE_ONCHAIN_METRICS: str = Field(
        default="ALL",
        description='Comma-separated CoinMetrics metrics to fetch, or "ALL".',
    )
    AUTO_POPULATE_ONCHAIN_YEARS: int = Field(
        default=5,
        description="How many years of historical on-chain data to backfill on empty DB.",
    )
    AUTO_POPULATE_ONCHAIN_TOP_MARKETS: int = Field(
        default=150,
        description=(
            "When AUTO_POPULATE_ONCHAIN_SYMBOLS is empty, fetch this many top "
            "market-cap coins from Binance for startup auto-populate."
        ),
    )
    AUTO_POPULATE_MARKET_DATA_ON_EMPTY_DB: bool = Field(
        default=True,
        description=(
            "When True on first PostgreSQL startup, Binance Spot daily candles are "
            "fetched into market_data whenever that table contains zero rows."
        ),
    )
    AUTO_POPULATE_MARKET_DATA_MAX_ASSETS: int = Field(
        default=150,
        ge=1,
        le=800,
        description="Upper bound on how many active assets receive Binance candles per empty-DB populate.",
    )
    AUTO_POPULATE_MARKET_DATA_LOOKBACK_DAYS: int = Field(
        default=730,
        ge=30,
        le=3660,
        description="Historical depth (UTC calendar days, daily interval) seeded from Binance per asset.",
    )
    AUTO_POPULATE_MARKET_DATA_QUOTE_ASSET: str = Field(
        default="USDT",
        max_length=6,
        description="Binance quote asset used for pairing, e.g. BASE + USDT = BTCUSDT.",
    )

    AI_ENGINE_BASE_URL: str = Field(
        default="",
        description="AI engine origin without trailing slash (e.g. http://ai_engine:8001). Enables /ml-training proxy.",
    )
    AI_ENGINE_ML_SERVICE_KEY: str = Field(
        default="",
        description="Forwarded as X-ML-Service-Key when the backend calls the AI engine.",
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
