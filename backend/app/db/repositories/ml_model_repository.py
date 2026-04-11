"""Persistence helpers for ``ml_models`` rows."""

import uuid
from typing import Any, Optional

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.ml_models import MlModel


class MlModelRepository:
    """CRUD for registered ML model metadata."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def count(
        self,
        asset_id: Optional[uuid.UUID] = None,
        is_active: Optional[bool] = None,
    ) -> int:
        """Return total models with optional filters matching ``list_page``."""
        statement = select(func.count()).select_from(MlModel)
        if asset_id is not None:
            statement = statement.where(MlModel.asset_id == asset_id)
        if is_active is not None:
            statement = statement.where(MlModel.is_active == is_active)
        result = await self._session.execute(statement)
        return int(result.scalar_one() or 0)

    async def list_page(
        self,
        offset: int,
        limit: int,
        asset_id: Optional[uuid.UUID] = None,
        is_active: Optional[bool] = None,
    ) -> list[MlModel]:
        """Return a page of models ordered by ``created_at`` descending."""
        statement = select(MlModel).order_by(MlModel.created_at.desc()).offset(offset).limit(limit)
        if asset_id is not None:
            statement = statement.where(MlModel.asset_id == asset_id)
        if is_active is not None:
            statement = statement.where(MlModel.is_active == is_active)
        result = await self._session.execute(statement)
        return list(result.scalars().all())

    async def get_by_id(self, model_id: uuid.UUID) -> Optional[MlModel]:
        """Load a model by primary key."""
        result = await self._session.execute(select(MlModel).where(MlModel.id == model_id))
        return result.scalar_one_or_none()

    async def create(
        self,
        version_tag: str,
        asset_id: Optional[uuid.UUID] = None,
        model_type: Optional[str] = None,
        hyperparameters: Optional[dict[str, Any]] = None,
        training_metrics: Optional[dict[str, Any]] = None,
        file_path: Optional[str] = None,
        is_active: bool = False,
    ) -> MlModel:
        """Insert a new model row."""
        row = MlModel(
            asset_id=asset_id,
            version_tag=version_tag.strip(),
            model_type=model_type,
            hyperparameters=hyperparameters,
            training_metrics=training_metrics,
            file_path=file_path,
            is_active=is_active,
        )
        self._session.add(row)
        try:
            await self._session.commit()
        except IntegrityError:
            await self._session.rollback()
            raise
        await self._session.refresh(row)
        return row

    async def update(self, model_id: uuid.UUID, fields: dict[str, Any]) -> Optional[MlModel]:
        """Apply partial updates."""
        row = await self.get_by_id(model_id)
        if row is None:
            return None
        allowed = {
            "asset_id",
            "version_tag",
            "model_type",
            "hyperparameters",
            "training_metrics",
            "file_path",
            "is_active",
        }
        for key, value in fields.items():
            if key not in allowed:
                continue
            if key == "is_active" or value is not None:
                setattr(row, key, value)
        try:
            await self._session.commit()
        except IntegrityError:
            await self._session.rollback()
            raise
        await self._session.refresh(row)
        return row

    async def delete(self, model_id: uuid.UUID) -> bool:
        """Delete a model row."""
        result = await self._session.execute(delete(MlModel).where(MlModel.id == model_id))
        await self._session.commit()
        return result.rowcount > 0
