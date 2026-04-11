"""ORM model for strategy backtest summaries."""

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BacktestResult(Base):
    """Backtest run metrics and trade log."""

    __tablename__ = "backtest_results"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    model_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("ml_models.id", ondelete="SET NULL"),
        nullable=True,
    )
    strategy_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    total_return: Mapped[Optional[float]] = mapped_column(Numeric(24, 8), nullable=True)
    sharpe_ratio: Mapped[Optional[float]] = mapped_column(Numeric(24, 8), nullable=True)
    max_drawdown: Mapped[Optional[float]] = mapped_column(Numeric(24, 8), nullable=True)
    trades_log: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
