"""Pydantic response models for domain CRUD routes."""

import uuid
from datetime import datetime
from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated list wrapper."""

    items: list[T]
    total: int
    page: int
    page_size: int


class UserPublicResponse(BaseModel):
    """Safe user profile without credentials."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    email: str
    preferences: dict[str, Any]
    created_at: datetime


class AssetResponse(BaseModel):
    """Tradable asset."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    symbol: str
    name: str
    category: Optional[str]
    coingecko_id: Optional[str]
    is_active: bool
    created_at: datetime


class WatchlistEntryResponse(BaseModel):
    """One watchlist row with nested asset."""

    user_id: uuid.UUID
    asset: AssetResponse


class MlModelResponse(BaseModel):
    """ML model metadata."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    asset_id: Optional[uuid.UUID]
    version_tag: str
    model_type: Optional[str]
    hyperparameters: Optional[dict[str, Any]]
    training_metrics: Optional[dict[str, Any]]
    file_path: Optional[str]
    is_active: bool
    created_at: datetime


class PredictionResponse(BaseModel):
    """One prediction row."""

    time: datetime
    asset_id: uuid.UUID
    model_id: uuid.UUID
    predicted_value: float
    confidence_interval_high: Optional[float]
    confidence_interval_low: Optional[float]


class MarketDataResponse(BaseModel):
    """One OHLCV row."""

    time: datetime
    asset_id: uuid.UUID
    open: float
    high: float
    low: float
    close: float
    volume: float
    resolution: str


class TechnicalIndicatorResponse(BaseModel):
    """One technical indicator row."""

    time: datetime
    asset_id: uuid.UUID
    indicator_name: str
    value: float


class OnChainMetricResponse(BaseModel):
    """One on-chain metric row."""

    time: datetime
    asset_id: uuid.UUID
    metric_name: str
    value: float


class CuratedNewsResponse(BaseModel):
    """Curated news summary."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    asset_id: Optional[uuid.UUID]
    summary: str
    sentiment_score: Optional[float]
    data_points_used: Optional[dict[str, Any]]
    created_at: datetime


class KnowledgeBaseResponse(BaseModel):
    """Knowledge chunk for list views (no embedding)."""

    id: uuid.UUID
    asset_id: Optional[uuid.UUID]
    source_type: Optional[str]
    title: Optional[str]
    content: str
    url: Optional[str]
    published_at: datetime
    metadata: Optional[dict[str, Any]] = None


class KnowledgeBaseDetailResponse(KnowledgeBaseResponse):
    """Knowledge row including optional embedding."""

    embedding: Optional[list[float]] = None


class ChatHistoryResponse(BaseModel):
    """One chat message."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: Optional[uuid.UUID]
    session_id: uuid.UUID
    role: str
    content: str
    ui_payload: Optional[dict[str, Any]]
    created_at: datetime


class BacktestResultResponse(BaseModel):
    """Backtest summary."""

    id: uuid.UUID
    user_id: Optional[uuid.UUID]
    model_id: Optional[uuid.UUID]
    strategy_name: Optional[str]
    total_return: Optional[float]
    sharpe_ratio: Optional[float]
    max_drawdown: Optional[float]
    trades_log: Optional[dict[str, Any]]
    created_at: datetime


class ScraperLogResponse(BaseModel):
    """Scraper execution log."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    source: Optional[str]
    status: Optional[str]
    error_msg: Optional[str]
    rows_affected: Optional[int]
    executed_at: datetime


class NewsScrapeTriggerResponse(BaseModel):
    """Summary after a manual news scraper run and DB ingest."""

    articles_in_file: int
    rows_inserted: int
