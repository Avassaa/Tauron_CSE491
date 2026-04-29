"""ORM model for user price alerts."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Numeric, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PriceAlert(Base):
    """User-defined threshold alert for one asset/symbol."""

    __tablename__ = "price_alerts"
    __table_args__ = (
        CheckConstraint("condition IN ('above', 'below')", name="ck_price_alert_condition"),
        Index("ix_price_alerts_active_symbol", "is_active", "symbol"),
        Index("ix_price_alerts_user_created", "user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    asset_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("assets.id", ondelete="CASCADE"),
        nullable=False,
    )
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    condition: Mapped[str] = mapped_column(String(10), nullable=False)
    target_price: Mapped[Decimal] = mapped_column(Numeric(24, 8), nullable=False)
    reference_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(24, 8), nullable=True)
    percentage_change: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    triggered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_checked_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(24, 8), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
