"""Chat transcript messages (user-scoped; admin list under ``/admin``)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import PaginationParams, get_pagination
from app.core.security import get_current_user_id, require_admin_api_key
from app.db.repositories.chat_history_repository import ChatHistoryRepository
from app.db.session import get_db_session
from app.models.request.table_requests import CreateChatMessageRequest, UpdateChatMessageRequest
from app.models.response.table_responses import ChatHistoryResponse, PaginatedResponse

router = APIRouter(prefix="/chat-history")
admin_router = APIRouter(prefix="/admin/chat-history")


@router.get("", response_model=PaginatedResponse[ChatHistoryResponse])
async def list_my_chat_history(
    pagination: PaginationParams = Depends(get_pagination),
    session_id: uuid.UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    """List chat messages for the current user."""
    repository = ChatHistoryRepository(session)
    total = await repository.count_for_user(user_id, session_id=session_id)
    rows = await repository.list_page_for_user(
        user_id,
        offset=pagination.offset,
        limit=pagination.page_size,
        session_id=session_id,
    )
    return PaginatedResponse(
        items=[ChatHistoryResponse.model_validate(r) for r in rows],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/{message_id}", response_model=ChatHistoryResponse)
async def get_chat_message(
    message_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    """Return one message if owned by the current user."""
    repository = ChatHistoryRepository(session)
    row = await repository.get_by_id(message_id)
    if row is None or row.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return ChatHistoryResponse.model_validate(row)


@router.post("", response_model=ChatHistoryResponse, status_code=status.HTTP_201_CREATED)
async def create_chat_message(
    body: CreateChatMessageRequest,
    session: AsyncSession = Depends(get_db_session),
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    """Append a chat message for the current user."""
    repository = ChatHistoryRepository(session)
    try:
        row = await repository.create(
            user_id=user_id,
            session_id=body.session_id,
            role=body.role,
            content=body.content,
            ui_payload=body.ui_payload,
        )
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not create message",
        ) from exc
    return ChatHistoryResponse.model_validate(row)


@router.patch("/{message_id}", response_model=ChatHistoryResponse)
async def update_chat_message(
    message_id: uuid.UUID,
    body: UpdateChatMessageRequest,
    session: AsyncSession = Depends(get_db_session),
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    """Patch a message owned by the current user."""
    repository = ChatHistoryRepository(session)
    row = await repository.get_by_id(message_id)
    if row is None or row.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    data = body.model_dump(exclude_unset=True)
    try:
        updated = await repository.update(message_id, data)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Update conflict",
        ) from exc
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return ChatHistoryResponse.model_validate(updated)


@router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat_message(
    message_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    """Delete a message owned by the current user."""
    repository = ChatHistoryRepository(session)
    row = await repository.get_by_id(message_id)
    if row is None or row.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    await repository.delete(message_id)


@admin_router.get("", response_model=PaginatedResponse[ChatHistoryResponse])
async def admin_list_chat_history(
    pagination: PaginationParams = Depends(get_pagination),
    user_id: uuid.UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """List chat messages across users (admin)."""
    repository = ChatHistoryRepository(session)
    total = await repository.count_admin(user_id=user_id)
    rows = await repository.list_all_page_admin(
        offset=pagination.offset,
        limit=pagination.page_size,
        user_id=user_id,
    )
    return PaginatedResponse(
        items=[ChatHistoryResponse.model_validate(r) for r in rows],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
