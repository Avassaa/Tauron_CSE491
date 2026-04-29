"""Authenticated user price alerts."""

import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.repositories.asset_repository import AssetRepository
from app.db.repositories.price_alert_repository import PriceAlertRepository
from app.db.session import get_db_session
from app.models.request.table_requests import CreatePriceAlertRequest, UpdatePriceAlertRequest
from app.models.response.table_responses import PriceAlertResponse

router = APIRouter(prefix="/users/me/price-alerts")


def _to_response(alert) -> PriceAlertResponse:
    return PriceAlertResponse(
        id=alert.id,
        user_id=alert.user_id,
        asset_id=alert.asset_id,
        symbol=alert.symbol,
        condition=alert.condition,
        target_price=float(alert.target_price),
        reference_price=float(alert.reference_price) if alert.reference_price is not None else None,
        percentage_change=float(alert.percentage_change) if alert.percentage_change is not None else None,
        is_active=alert.is_active,
        triggered_at=alert.triggered_at,
        last_checked_price=float(alert.last_checked_price) if alert.last_checked_price is not None else None,
        created_at=alert.created_at,
        updated_at=alert.updated_at,
    )


@router.get("", response_model=list[PriceAlertResponse])
async def list_my_price_alerts(
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    """List price alerts for the current user."""
    repository = PriceAlertRepository(session)
    return [_to_response(row) for row in await repository.list_for_user(user_id)]


@router.post("", response_model=PriceAlertResponse, status_code=status.HTTP_201_CREATED)
async def create_price_alert(
    body: CreatePriceAlertRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    """Create an active price alert for one asset."""
    asset_repo = AssetRepository(session)
    asset = await asset_repo.get_by_id(body.asset_id)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    symbol = asset.symbol.upper()
    if symbol == "USDT":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="USDT alerts are not supported")
    if not symbol.endswith("USDT"):
        symbol = f"{symbol}USDT"
    repository = PriceAlertRepository(session)
    target_price = Decimal(str(body.target_price))
    existing_alert = await repository.find_duplicate_target(
        user_id=user_id,
        asset_id=asset.id,
        target_price=target_price,
    )
    if existing_alert is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A price alert with this target price already exists for this asset",
        )
    alert = await repository.create(
        user_id=user_id,
        asset_id=asset.id,
        symbol=symbol,
        condition=body.condition,
        target_price=target_price,
        reference_price=Decimal(str(body.reference_price)) if body.reference_price is not None else None,
        percentage_change=Decimal(str(body.percentage_change)) if body.percentage_change is not None else None,
    )
    return _to_response(alert)


@router.patch("/{alert_id}", response_model=PriceAlertResponse)
async def update_price_alert(
    alert_id: uuid.UUID,
    body: UpdatePriceAlertRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    """Update threshold or active state for one price alert."""
    repository = PriceAlertRepository(session)
    alert = await repository.update_for_user(
        user_id,
        alert_id,
        condition=body.condition,
        target_price=Decimal(str(body.target_price)) if body.target_price is not None else None,
        is_active=body.is_active,
    )
    if alert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    return _to_response(alert)


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_price_alert(
    alert_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    """Delete one price alert."""
    repository = PriceAlertRepository(session)
    deleted = await repository.delete_for_user(user_id, alert_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
