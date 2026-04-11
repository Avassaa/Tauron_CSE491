"""ORM model for OHLCV market data (Timescale hypertable)."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MarketData(Base):
    """Standard OHLCV rows keyed by time and asset."""

    __tablename__ = "market_data"

    time: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    asset_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("assets.id", ondelete="CASCADE"),
        primary_key=True,
    )
    open: Mapped[float] = mapped_column(Numeric(24, 8), nullable=False)
    high: Mapped[float] = mapped_column(Numeric(24, 8), nullable=False)
    low: Mapped[float] = mapped_column(Numeric(24, 8), nullable=False)
    close: Mapped[float] = mapped_column(Numeric(24, 8), nullable=False)
    volume: Mapped[float] = mapped_column(Numeric(24, 8), nullable=False)
    resolution: Mapped[str] = mapped_column(String(5), nullable=False)
