"""Resolve ``asset_id`` query parameters when callers pass either a UUID or a ticker."""

import uuid

from fastapi import Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories.asset_repository import AssetRepository
from app.db.session import get_db_session


async def resolve_prediction_asset_identifier(
    trimmed_identifier: str,
    session: AsyncSession,
) -> uuid.UUID:
    """Return the asset primary key for a UUID string or a case-insensitive symbol."""
    try:
        return uuid.UUID(trimmed_identifier)
    except ValueError:
        repository = AssetRepository(session)
        row = await repository.get_by_symbol(trimmed_identifier)
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No asset matched identifier {trimmed_identifier!r}",
            )
        return row.id


async def optional_predictions_asset_uuid(
    session: AsyncSession = Depends(get_db_session),
    asset_id: str | None = Query(default=None),
) -> uuid.UUID | None:
    """Return ``None`` when the caller omits ``asset_id``, otherwise resolve it."""
    if asset_id is None:
        return None
    trimmed = asset_id.strip()
    if trimmed == "":
        return None
    return await resolve_prediction_asset_identifier(trimmed, session)


async def required_predictions_asset_uuid(
    session: AsyncSession = Depends(get_db_session),
    asset_id: str = Query(),
) -> uuid.UUID:
    """Require ``asset_id`` as a UUID or resolvable ticker symbol."""
    trimmed = asset_id.strip()
    if trimmed == "":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="asset_id must not be empty",
        )
    return await resolve_prediction_asset_identifier(trimmed, session)
