"""Persistence helpers for user notifications."""

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user_notifications import UserNotification
from app.services.notification_push import notification_connection_manager, serialize_notification


class NotificationRepository:
    """CRUD helpers for notification inbox rows."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_for_user(
        self,
        user_id: uuid.UUID,
        *,
        unread_only: bool = False,
        offset: int = 0,
        limit: int = 50,
    ) -> list[UserNotification]:
        statement = (
            select(UserNotification)
            .where(UserNotification.user_id == user_id)
            .order_by(UserNotification.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        if unread_only:
            statement = statement.where(UserNotification.is_read.is_(False))
        result = await self._session.execute(statement)
        return list(result.scalars().all())

    async def count_for_user(self, user_id: uuid.UUID, *, unread_only: bool = False) -> int:
        statement = select(func.count()).select_from(UserNotification).where(
            UserNotification.user_id == user_id,
        )
        if unread_only:
            statement = statement.where(UserNotification.is_read.is_(False))
        return int((await self._session.scalar(statement)) or 0)

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        type: str,
        title: str,
        message: str,
        payload: Optional[dict[str, Any]] = None,
        dedupe_key: Optional[str] = None,
    ) -> UserNotification:
        notification = UserNotification(
            user_id=user_id,
            type=type,
            title=title,
            message=message,
            payload=payload,
            dedupe_key=dedupe_key,
        )
        self._session.add(notification)
        try:
            await self._session.commit()
        except IntegrityError:
            await self._session.rollback()
            raise
        await self._session.refresh(notification)
        await notification_connection_manager.publish(
            notification.user_id,
            serialize_notification(notification),
        )
        return notification

    async def mark_read(self, user_id: uuid.UUID, notification_id: uuid.UUID) -> Optional[UserNotification]:
        notification = await self._session.get(UserNotification, notification_id)
        if notification is None or notification.user_id != user_id:
            return None
        notification.is_read = True
        notification.read_at = datetime.now(timezone.utc)
        await self._session.commit()
        await self._session.refresh(notification)
        return notification

    async def mark_all_read(self, user_id: uuid.UUID) -> int:
        result = await self._session.execute(
            update(UserNotification)
            .where(
                UserNotification.user_id == user_id,
                UserNotification.is_read.is_(False),
            )
            .values(is_read=True, read_at=datetime.now(timezone.utc))
        )
        await self._session.commit()
        return result.rowcount or 0

    async def delete_one(self, user_id: uuid.UUID, notification_id: uuid.UUID) -> bool:
        result = await self._session.execute(
            delete(UserNotification).where(
                UserNotification.id == notification_id,
                UserNotification.user_id == user_id,
            )
        )
        await self._session.commit()
        return (result.rowcount or 0) > 0
