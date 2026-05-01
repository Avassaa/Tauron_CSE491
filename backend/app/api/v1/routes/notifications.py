"""Authenticated user notifications."""

import json
import uuid

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token, get_current_user_id, require_admin_api_key
from app.db.repositories.notification_repository import NotificationRepository
from app.db.session import get_db_session
from app.models.response.table_responses import (
    NotificationResponse,
    PaginatedResponse,
    UnreadNotificationCountResponse,
)
from app.services.notification_push import notification_connection_manager

router = APIRouter(prefix="/users/me/notifications")
admin_router = APIRouter(prefix="/admin/notifications")


class AdminCreateNotificationRequest(BaseModel):
    """Admin-only request for manually creating a test notification."""

    user_id: uuid.UUID
    type: str = Field(default="system_test", max_length=50)
    title: str = Field(default="Test notification", max_length=200)
    message: str = "Manual backend test notification."
    payload: dict | None = None


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


@router.websocket("/ws")
async def notifications_websocket(websocket: WebSocket, token: str = Query(default="")):
    """Push notification-created events to an authenticated user websocket."""
    try:
        payload = decode_access_token(token)
        user_id = uuid.UUID(str(payload.get("sub")))
    except (jwt.PyJWTError, TypeError, ValueError):
        await websocket.close(code=1008)
        return
    await notification_connection_manager.connect(user_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if isinstance(data, dict) and data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        notification_connection_manager.disconnect(user_id, websocket)


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


@admin_router.post("/test", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
async def admin_create_test_notification(
    body: AdminCreateNotificationRequest,
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Create a manual notification for backend/API testing only."""
    repository = NotificationRepository(session)
    row = await repository.create(
        user_id=body.user_id,
        type=body.type,
        title=body.title,
        message=body.message,
        payload=body.payload,
    )
    return NotificationResponse.model_validate(row)
