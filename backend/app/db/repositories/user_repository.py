"""Data access for user accounts."""

import uuid
from typing import Any, Optional

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User


DEFAULT_USER_PREFERENCES: dict[str, Any] = {
    "theme": "dark",
    "currency": "USD",
    "risk_level": "medium",
}


class UserRepository:
    """Persistence helpers for ``users`` rows."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        """Load a user by primary key."""
        result = await self._session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[User]:
        """Load a user by email address."""
        result = await self._session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_by_username(self, username: str) -> Optional[User]:
        """Load a user by username."""
        result = await self._session.execute(select(User).where(User.username == username))
        return result.scalar_one_or_none()

    async def create(
        self,
        username: str,
        email: str,
        password_hash: str,
        preferences: Optional[dict[str, Any]] = None,
    ) -> User:
        """Insert a new user and return the persisted row."""
        user = User(
            username=username,
            email=email,
            password_hash=password_hash,
            preferences=preferences if preferences is not None else dict(DEFAULT_USER_PREFERENCES),
        )
        self._session.add(user)
        try:
            await self._session.commit()
        except IntegrityError:
            await self._session.rollback()
            raise
        await self._session.refresh(user)
        return user

    async def update_profile(self, user_id: uuid.UUID, **updates: Any) -> Optional[User]:
        """Update only keys present in ``updates`` (non-None values)."""
        user = await self.get_by_id(user_id)
        if user is None:
            return None
        for key in ("username", "email", "preferences"):
            if key in updates and updates[key] is not None:
                setattr(user, key, updates[key])
        try:
            await self._session.commit()
        except IntegrityError:
            await self._session.rollback()
            raise
        await self._session.refresh(user)
        return user

    async def update_password_hash(self, user_id: uuid.UUID, password_hash: str) -> bool:
        """Replace stored password hash."""
        user = await self.get_by_id(user_id)
        if user is None:
            return False
        user.password_hash = password_hash
        await self._session.commit()
        await self._session.refresh(user)
        return True

    async def delete_user(self, user_id: uuid.UUID) -> bool:
        """Remove a user row."""
        result = await self._session.execute(delete(User).where(User.id == user_id))
        await self._session.commit()
        return result.rowcount > 0
