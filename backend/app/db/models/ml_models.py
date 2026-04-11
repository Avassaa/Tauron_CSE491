"""ORM model for registered ML model versions."""

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MlModel(Base):
    """Stored ML model metadata and artifact location."""

    __tablename__ = "ml_models"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("assets.id", ondelete="SET NULL"),
        nullable=True,
    )
    version_tag: Mapped[str] = mapped_column(String(50), nullable=False)
    model_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    hyperparameters: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    training_metrics: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    file_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
