"""ORM model for model predictions (Timescale hypertable)."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Prediction(Base):
    """Forecast rows keyed by target time, asset, and model."""

    __tablename__ = "predictions"

    time: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    asset_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("assets.id", ondelete="CASCADE"),
        primary_key=True,
    )
    model_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("ml_models.id", ondelete="CASCADE"),
        primary_key=True,
    )
    predicted_value: Mapped[float] = mapped_column(Numeric(24, 8), nullable=False)
    confidence_interval_high: Mapped[float | None] = mapped_column(Numeric(24, 8), nullable=True)
    confidence_interval_low: Mapped[float | None] = mapped_column(Numeric(24, 8), nullable=True)
