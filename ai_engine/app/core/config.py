"""Central settings for ai_engine (environment variables)."""

from pathlib import Path
from urllib.parse import quote_plus

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_AI_ENGINE_DIRECTORY = Path(__file__).resolve().parents[2]
_AI_ENGINE_ENV_FILE = _AI_ENGINE_DIRECTORY / ".env"


class Settings(BaseSettings):
    """Application configuration sourced from ``.env`` and the runtime environment."""

    model_config = SettingsConfigDict(
        env_file=_AI_ENGINE_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "Tauron AI Engine"
    API_V1_STR: str = "/api/v1"
    CORS_ORIGINS: str = Field(
        default="http://localhost:4200,http://localhost:8000",
        description="Comma-separated allowed origins mirrored into CORSMiddleware.",
    )

    MODEL_PATH: str = Field(default="/models", description="Filesystem root for persisted joblib artifacts.")
    DATA_PATH: str = Field(default="./data", description="Optional path for exploratory exports.")

    BACKEND_BASE_URL: str = Field(
        default="http://localhost:8000",
        description="REST base URL of the backend (no trailing slash), used for admin writes.",
    )
    ADMIN_API_KEY: str = Field(
        default="",
        description="Must match backend ADMIN_API_KEY; sent as X-Admin-Key for registry and prediction ingestion.",
    )
    ML_SERVICE_KEY: str = Field(
        default="",
        description="When non-empty, training and inference routes require matching X-ML-Service-Key header.",
    )

    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5433
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = ""
    POSTGRES_DB: str = "tauron"
    POSTGRES_SSL: bool = Field(default=False)
    DATABASE_URL_OVERRIDE: str = ""
    DATABASE_SCHEMA: str = Field(default="tauron", description="Postgres schema for timeseries and registry tables.")

    TRAIN_MAX_WORKERS: int = Field(default=4, ge=1, le=32, description="Process pool upper bound.")
    TRAIN_MIN_SAMPLE_ROWS: int = Field(default=45, ge=10, description="Minimum aligned rows after cleaning.")
    TRAIN_MAX_ONCHAIN_METRIC_COLUMNS: int = Field(
        default=80,
        ge=8,
        le=500,
        description="Cap wide columns after pivot to control memory and fit time.",
    )
    TRAIN_FORECAST_HORIZON_DAYS: int = Field(
        default=14,
        ge=1,
        le=366,
        description=(
            "Daily forward steps persisted after training; each step compounds the one-step log-return from the "
            "anchor close while confidence bands widen with sqrt(step)."
        ),
    )
    TRAIN_FORECAST_LOG_SIGMA_FLOOR: float = Field(
        default=0.015,
        ge=1e-6,
        le=0.5,
        description=(
            "Floors the validation log-return residual scale when persisting multi-day paths so near-zero "
            "errors do not collapse predicted levels and confidence bands across the horizon."
        ),
    )
    TRAIN_FORECAST_CI_Z_SCORE: float = Field(
        default=1.96,
        ge=0.5,
        le=3.5,
        description=(
            "Gaussian multiplier for symmetric log-return confidence bands (one-step retrospectives, live "
            "inference, and per-step widening on compounded multi-day paths)."
        ),
    )
    TRAIN_FORECAST_BAND_LOG_HALF_WIDTH_CAP: float = Field(
        default=0.14,
        ge=-1.0,
        le=1.5,
        description=(
            "Upper bound on cumulative multi-step log half-width after sqrt(step) scaling; values below zero "
            "disable capping so bands follow the unconstrained random-walk style widening."
        ),
    )
    TRAIN_DEFAULT_MODEL_TYPE: str = Field(
        default="hgb_ocm",
        description=(
            "Default model_type_slug used when no override is supplied at request time. "
            "Valid values: hgb_ocm, ridge_ocm, rf_ocm, et_ocm, lgbm_ocm, lstm_ocm, ensemble_ocm."
        ),
    )
    TRAIN_HOLDOUT_EVAL_START_DATE: str = Field(
        default="2026-01-01",
        description=(
            "UTC calendar date marking the beginning of simulated out-of-sample evaluation. Rows whose "
            "next-day prediction target settles on this date or later never enter estimator ``fit``. "
            "Set to empty to disable this split and revert to fitting on full history."
        ),
    )
    TRAIN_HOLDOUT_EVAL_MONTHS: int = Field(
        default=5,
        ge=1,
        le=120,
        description=(
            "Calendar-month span of retrospective one-step evaluations beginning at HOLDOUT_EVAL_START_DATE "
            "(outcome timestamps strictly inside [start, start + months)."
        ),
    )
    TRAIN_VERSION_TAG_PREFIX: str = Field(default="onchain-hgb", description="Prefix for version_tag on new models.")
    TRAIN_MAX_ASSETS: int = Field(
        default=0,
        ge=0,
        description="When nonzero, truncate the active asset enumeration to this length after ordering.",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse ``CORS_ORIGINS`` into a list for Starlette."""
        parts = [chunk.strip() for chunk in self.CORS_ORIGINS.split(",")]
        return [chunk for chunk in parts if chunk]

    @property
    def sync_database_url(self) -> str:
        """Build a synchronous ``postgresql://`` URL for psycopg."""
        if self.DATABASE_URL_OVERRIDE.strip():
            raw = self.DATABASE_URL_OVERRIDE.strip()
            if raw.startswith("postgresql+asyncpg://"):
                return raw.replace("postgresql+asyncpg://", "postgresql://", 1)
            if raw.startswith("postgresql+psycopg://"):
                return raw.replace("postgresql+psycopg://", "postgresql://", 1)
            return raw
        password = quote_plus(self.POSTGRES_PASSWORD or "")
        user = quote_plus(self.POSTGRES_USER or "")
        host = self.POSTGRES_HOST
        port = int(self.POSTGRES_PORT)
        database_name = quote_plus(self.POSTGRES_DB or "")
        return f"postgresql://{user}:{password}@{host}:{port}/{database_name}"

    @property
    def validated_schema_name(self) -> str:
        """Return schema string limited to safe identifier characters."""
        cleaned = self.DATABASE_SCHEMA.strip()
        if not cleaned.replace("_", "").isalnum():
            raise ValueError("DATABASE_SCHEMA must be alphanumeric with underscores only")
        return cleaned


settings = Settings()
