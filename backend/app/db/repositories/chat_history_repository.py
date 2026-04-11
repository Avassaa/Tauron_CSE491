"""Persistence helpers for ``chat_history`` rows."""

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.chat_history import ChatHistory


class ChatHistoryRepository:
    """Scoped chat transcripts."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def count_for_user(
        self,
        user_id: uuid.UUID,
        session_id: Optional[uuid.UUID] = None,
    ) -> int:
        """Count messages for a user."""
        statement = select(func.count()).select_from(ChatHistory).where(ChatHistory.user_id == user_id)
        if session_id is not None:
            statement = statement.where(ChatHistory.session_id == session_id)
        result = await self._session.execute(statement)
        return int(result.scalar_one() or 0)

    async def list_page_for_user(
        self,
        user_id: uuid.UUID,
        offset: int,
        limit: int,
        session_id: Optional[uuid.UUID] = None,
    ) -> list[ChatHistory]:
        """List messages for one user."""
        statement = (
            select(ChatHistory)
            .where(ChatHistory.user_id == user_id)
            .order_by(ChatHistory.created_at.asc())
            .offset(offset)
            .limit(limit)
        )
        if session_id is not None:
            statement = statement.where(ChatHistory.session_id == session_id)
        result = await self._session.execute(statement)
        return list(result.scalars().all())

    async def get_by_id(self, message_id: uuid.UUID) -> Optional[ChatHistory]:
        """Load one message."""
        result = await self._session.execute(
            select(ChatHistory).where(ChatHistory.id == message_id),
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        user_id: uuid.UUID,
        session_id: uuid.UUID,
        role: str,
        content: str,
        ui_payload: Optional[dict[str, Any]] = None,
    ) -> ChatHistory:
        """Insert a chat turn."""
        row = ChatHistory(
            user_id=user_id,
            session_id=session_id,
            role=role.strip(),
            content=content,
            ui_payload=ui_payload,
        )
        self._session.add(row)
        try:
            await self._session.commit()
        except IntegrityError:
            await self._session.rollback()
            raise
        await self._session.refresh(row)
        return row

    async def update(
        self,
        message_id: uuid.UUID,
        fields: dict[str, Any],
    ) -> Optional[ChatHistory]:
        """Patch a message (typically ``content`` or ``ui_payload``)."""
        row = await self.get_by_id(message_id)
        if row is None:
            return None
        allowed = {"content", "ui_payload", "role"}
        for key, value in fields.items():
            if key in allowed:
                setattr(row, key, value)
        try:
            await self._session.commit()
        except IntegrityError:
            await self._session.rollback()
            raise
        await self._session.refresh(row)
        return row

    async def delete(self, message_id: uuid.UUID) -> bool:
        """Delete one message."""
        result = await self._session.execute(
            delete(ChatHistory).where(ChatHistory.id == message_id),
        )
        await self._session.commit()
        return result.rowcount > 0

    async def count_admin(self, user_id: Optional[uuid.UUID] = None) -> int:
        """Count messages for admin list."""
        statement = select(func.count()).select_from(ChatHistory)
        if user_id is not None:
            statement = statement.where(ChatHistory.user_id == user_id)
        result = await self._session.execute(statement)
        return int(result.scalar_one() or 0)

    async def list_all_page_admin(
        self,
        offset: int,
        limit: int,
        user_id: Optional[uuid.UUID] = None,
    ) -> list[ChatHistory]:
        """Admin list with optional user filter."""
        statement = (
            select(ChatHistory).order_by(ChatHistory.created_at.desc()).offset(offset).limit(limit)
        )
        if user_id is not None:
            statement = statement.where(ChatHistory.user_id == user_id)
        result = await self._session.execute(statement)
        return list(result.scalars().all())
