"""Persistence for comments on curated news."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.db.models.curated_news import CuratedNews
from app.db.models.news_comment import NewsComment
from app.db.models.user import User


class NewsCommentRepository:
    """List and create ``news_comments`` rows."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def curated_news_exists(self, news_id: uuid.UUID) -> bool:
        result = await self._session.execute(
            select(func.count()).select_from(CuratedNews).where(CuratedNews.id == news_id),
        )
        return int(result.scalar_one() or 0) > 0

    async def count_for_news(self, curated_news_id: uuid.UUID) -> int:
        result = await self._session.execute(
            select(func.count())
            .select_from(NewsComment)
            .where(NewsComment.curated_news_id == curated_news_id),
        )
        return int(result.scalar_one() or 0)

    async def list_page(
        self,
        curated_news_id: uuid.UUID,
        *,
        offset: int,
        limit: int,
    ) -> list[tuple[NewsComment, str, str | None]]:
        """Return comment rows with author username and optional parent author name, oldest first."""
        parent_comment = aliased(NewsComment)
        parent_author = aliased(User)
        stmt = (
            select(NewsComment, User.username, parent_author.username)
            .join(User, User.id == NewsComment.user_id)
            .outerjoin(parent_comment, parent_comment.id == NewsComment.parent_id)
            .outerjoin(parent_author, parent_author.id == parent_comment.user_id)
            .where(NewsComment.curated_news_id == curated_news_id)
            .order_by(NewsComment.created_at.asc())
            .offset(offset)
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.all())

    async def create(
        self,
        *,
        curated_news_id: uuid.UUID,
        user_id: uuid.UUID,
        content: str,
        parent_id: uuid.UUID | None = None,
    ) -> NewsComment:
        row = NewsComment(
            curated_news_id=curated_news_id,
            user_id=user_id,
            content=content,
            parent_id=parent_id,
        )
        self._session.add(row)
        await self._session.commit()
        await self._session.refresh(row)
        return row

    async def get_by_id(self, comment_id: uuid.UUID) -> NewsComment | None:
        result = await self._session.execute(select(NewsComment).where(NewsComment.id == comment_id))
        return result.scalar_one_or_none()

    async def update_content_if_owned(
        self,
        *,
        comment_id: uuid.UUID,
        curated_news_id: uuid.UUID,
        user_id: uuid.UUID,
        content: str,
    ) -> NewsComment | None:
        row = await self.get_by_id(comment_id)
        if row is None:
            return None
        if row.curated_news_id != curated_news_id or row.user_id != user_id:
            return None
        row.content = content
        row.updated_at = datetime.now(timezone.utc)
        await self._session.commit()
        await self._session.refresh(row)
        return row

    async def delete_if_owned(
        self,
        *,
        comment_id: uuid.UUID,
        curated_news_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> bool:
        row = await self.get_by_id(comment_id)
        if row is None:
            return False
        if row.curated_news_id != curated_news_id or row.user_id != user_id:
            return False
        await self._session.execute(delete(NewsComment).where(NewsComment.id == comment_id))
        await self._session.commit()
        return True

    async def username_for_user(self, user_id: uuid.UUID) -> str | None:
        result = await self._session.execute(select(User.username).where(User.id == user_id))
        return result.scalar_one_or_none()
