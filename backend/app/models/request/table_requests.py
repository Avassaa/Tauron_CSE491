"""Pydantic request bodies for domain CRUD routes."""

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, Field


class PatchMeRequest(BaseModel):
    """Partial update for the authenticated user profile."""

    username: Optional[str] = None
    email: Optional[EmailStr] = None
    preferences: Optional[dict[str, Any]] = None


class ChangePasswordRequest(BaseModel):
    """Change password with verification of the current password."""

    current_password: str
    new_password: str = Field(min_length=8)


class CreateAssetRequest(BaseModel):
    """Create a tradable asset (admin)."""

    symbol: str = Field(max_length=10)
    name: str = Field(max_length=100)
    category: Optional[str] = Field(default=None, max_length=50)
    coingecko_id: Optional[str] = Field(default=None, max_length=100)
    is_active: bool = True


class UpdateAssetRequest(BaseModel):
    """Patch an asset (admin)."""

    symbol: Optional[str] = Field(default=None, max_length=10)
    name: Optional[str] = Field(default=None, max_length=100)
    category: Optional[str] = Field(default=None, max_length=50)
    coingecko_id: Optional[str] = Field(default=None, max_length=100)
    is_active: Optional[bool] = None


class CreateMlModelRequest(BaseModel):
    """Register an ML model version (admin)."""

    version_tag: str = Field(max_length=50)
    asset_id: Optional[uuid.UUID] = None
    model_type: Optional[str] = Field(default=None, max_length=20)
    hyperparameters: Optional[dict[str, Any]] = None
    training_metrics: Optional[dict[str, Any]] = None
    file_path: Optional[str] = None
    is_active: bool = False


class UpdateMlModelRequest(BaseModel):
    """Patch ML model metadata (admin)."""

    asset_id: Optional[uuid.UUID] = None
    version_tag: Optional[str] = Field(default=None, max_length=50)
    model_type: Optional[str] = Field(default=None, max_length=20)
    hyperparameters: Optional[dict[str, Any]] = None
    training_metrics: Optional[dict[str, Any]] = None
    file_path: Optional[str] = None
    is_active: Optional[bool] = None


class PredictionRowRequest(BaseModel):
    """One prediction row for batch insert."""

    time: datetime
    asset_id: uuid.UUID
    model_id: uuid.UUID
    predicted_value: float
    confidence_interval_high: Optional[float] = None
    confidence_interval_low: Optional[float] = None


class PredictionBatchRequest(BaseModel):
    """Batch create predictions (admin)."""

    rows: list[PredictionRowRequest]


class UpdatePredictionRequest(BaseModel):
    """Patch one prediction row (admin)."""

    predicted_value: Optional[float] = None
    confidence_interval_high: Optional[float] = None
    confidence_interval_low: Optional[float] = None


class MarketDataRowRequest(BaseModel):
    """One OHLCV row."""

    time: datetime
    asset_id: uuid.UUID
    open: float
    high: float
    low: float
    close: float
    volume: float
    resolution: str = Field(max_length=5)


class MarketDataBatchRequest(BaseModel):
    """Batch insert market data (admin)."""

    rows: list[MarketDataRowRequest]


class UpdateMarketDataRequest(BaseModel):
    """Patch one candle (admin)."""

    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: Optional[float] = None
    volume: Optional[float] = None
    resolution: Optional[str] = Field(default=None, max_length=5)


class TechnicalIndicatorRowRequest(BaseModel):
    """One technical indicator row."""

    time: datetime
    asset_id: uuid.UUID
    indicator_name: str = Field(max_length=50)
    value: float


class TechnicalIndicatorBatchRequest(BaseModel):
    """Batch insert technical indicators (admin)."""

    rows: list[TechnicalIndicatorRowRequest]


class UpdateTechnicalIndicatorRequest(BaseModel):
    """Patch one indicator value (admin)."""

    value: float


class OnChainMetricRowRequest(BaseModel):
    """One on-chain metric row."""

    time: datetime
    asset_id: uuid.UUID
    metric_name: str = Field(max_length=50)
    value: float


class OnChainMetricBatchRequest(BaseModel):
    """Batch insert on-chain metrics (admin)."""

    rows: list[OnChainMetricRowRequest]


class UpdateOnChainMetricRequest(BaseModel):
    """Patch one metric value (admin)."""

    value: float


class CreateCuratedNewsRequest(BaseModel):
    """Create curated news (admin)."""

    summary: str
    asset_id: Optional[uuid.UUID] = None
    sentiment_score: Optional[float] = None
    data_points_used: Optional[dict[str, Any]] = None


class UpdateCuratedNewsRequest(BaseModel):
    """Patch curated news (admin)."""

    asset_id: Optional[uuid.UUID] = None
    summary: Optional[str] = None
    sentiment_score: Optional[float] = None
    data_points_used: Optional[dict[str, Any]] = None


class CreateKnowledgeBaseRequest(BaseModel):
    """Create a knowledge row (admin). JSON field ``metadata`` maps to ``extra_metadata``."""

    content: str
    published_at: datetime
    asset_id: Optional[uuid.UUID] = None
    source_type: Optional[str] = Field(default=None, max_length=20)
    title: Optional[str] = None
    url: Optional[str] = None
    embedding: Optional[list[float]] = None
    extra_metadata: Optional[dict[str, Any]] = Field(default=None, alias="metadata")

    model_config = {"populate_by_name": True}


class UpdateKnowledgeBaseRequest(BaseModel):
    """Patch knowledge row (admin)."""

    content: Optional[str] = None
    published_at: Optional[datetime] = None
    asset_id: Optional[uuid.UUID] = None
    source_type: Optional[str] = Field(default=None, max_length=20)
    title: Optional[str] = None
    url: Optional[str] = None
    embedding: Optional[list[float]] = None
    extra_metadata: Optional[dict[str, Any]] = Field(default=None, alias="metadata")

    model_config = {"populate_by_name": True}


class CreateChatMessageRequest(BaseModel):
    """Append a chat message."""

    session_id: uuid.UUID
    role: str = Field(max_length=10)
    content: str
    ui_payload: Optional[dict[str, Any]] = None


class UpdateChatMessageRequest(BaseModel):
    """Patch a chat message."""

    role: Optional[str] = Field(default=None, max_length=10)
    content: Optional[str] = None
    ui_payload: Optional[dict[str, Any]] = None


class CreateBacktestResultRequest(BaseModel):
    """Create a backtest summary."""

    user_id: Optional[uuid.UUID] = None
    model_id: Optional[uuid.UUID] = None
    strategy_name: Optional[str] = Field(default=None, max_length=100)
    total_return: Optional[float] = None
    sharpe_ratio: Optional[float] = None
    max_drawdown: Optional[float] = None
    trades_log: Optional[dict[str, Any]] = None


class UpdateBacktestResultRequest(BaseModel):
    """Patch a backtest row."""

    user_id: Optional[uuid.UUID] = None
    model_id: Optional[uuid.UUID] = None
    strategy_name: Optional[str] = Field(default=None, max_length=100)
    total_return: Optional[float] = None
    sharpe_ratio: Optional[float] = None
    max_drawdown: Optional[float] = None
    trades_log: Optional[dict[str, Any]] = None


class CreateScraperLogRequest(BaseModel):
    """Append a scraper log (admin)."""

    source: Optional[str] = Field(default=None, max_length=50)
    status: Optional[str] = Field(default=None, max_length=20)
    error_msg: Optional[str] = None
    rows_affected: Optional[int] = None


class UpdateScraperLogRequest(BaseModel):
    """Patch a scraper log (admin)."""

    source: Optional[str] = Field(default=None, max_length=50)
    status: Optional[str] = Field(default=None, max_length=20)
    error_msg: Optional[str] = None
    rows_affected: Optional[int] = None
