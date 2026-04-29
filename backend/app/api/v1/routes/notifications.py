"""Authenticated user notifications."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.repositories.notification_repository import NotificationRepository
from app.db.session import get_db_session
from app.models.response.table_responses import (
    NotificationResponse,
    PaginatedResponse,
    UnreadNotificationCountResponse,
)

router = APIRouter(prefix="/users/me/notifications")


@router.get("", response_model=PaginatedResponse[NotificationResponse])
async def list_my_notifications(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    unread_only: bool = Query(default=False),
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    """List notification inbox items for the current user."""
    repository = NotificationRepository(session)
    total = await repository.count_for_user(user_id, unread_only=unread_only)
    rows = await repository.list_for_user(
        user_id,
        unread_only=unread_only,
        offset=(page - 1) * page_size,
        limit=page_size,
    )
    return PaginatedResponse(
        items=[NotificationResponse.model_validate(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/unread-count", response_model=UnreadNotificationCountResponse)
async def get_unread_notification_count(
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    """Return unread notification count."""
    repository = NotificationRepository(session)
    return UnreadNotificationCountResponse(
        count=await repository.count_for_user(user_id, unread_only=True),
    )


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    """Mark one notification as read."""
    repository = NotificationRepository(session)
    row = await repository.mark_read(user_id, notification_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return NotificationResponse.model_validate(row)


@router.patch("/read-all")
async def mark_all_notifications_read(
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    """Mark all current user's notifications as read."""
    repository = NotificationRepository(session)
    updated = await repository.mark_all_read(user_id)
    return {"updated": updated}


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    """Delete one notification."""
    repository = NotificationRepository(session)
    deleted = await repository.delete_one(user_id, notification_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
