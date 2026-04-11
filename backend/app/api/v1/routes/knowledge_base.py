"""Knowledge base RAG rows (read: JWT; write: admin)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import PaginationParams, get_pagination
from app.core.security import get_current_user_id, require_admin_api_key
from app.db.repositories.knowledge_base_repository import KnowledgeBaseRepository
from app.db.session import get_db_session
from app.models.request.table_requests import CreateKnowledgeBaseRequest, UpdateKnowledgeBaseRequest
from app.models.response.table_responses import (
    KnowledgeBaseDetailResponse,
    KnowledgeBaseResponse,
    PaginatedResponse,
)

router = APIRouter(prefix="/knowledge-base")


def _to_list_response(row) -> KnowledgeBaseResponse:
    """Build list item without embedding."""
    return KnowledgeBaseResponse(
        id=row.id,
        asset_id=row.asset_id,
        source_type=row.source_type,
        title=row.title,
        content=row.content,
        url=row.url,
        published_at=row.published_at,
        metadata=row.metadata_,
    )


def _to_detail_response(row) -> KnowledgeBaseDetailResponse:
    """Build detail with optional embedding."""
    emb = getattr(row, "embedding", None)
    emb_list = list(emb) if emb is not None else None
    return KnowledgeBaseDetailResponse(
        id=row.id,
        asset_id=row.asset_id,
        source_type=row.source_type,
        title=row.title,
        content=row.content,
        url=row.url,
        published_at=row.published_at,
        metadata=row.metadata_,
        embedding=emb_list,
    )


@router.get("", response_model=PaginatedResponse[KnowledgeBaseResponse])
async def list_knowledge_base(
    pagination: PaginationParams = Depends(get_pagination),
    asset_id: uuid.UUID | None = Query(default=None),
    source_type: str | None = Query(default=None, max_length=20),
    session: AsyncSession = Depends(get_db_session),
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """List knowledge chunks (embeddings omitted)."""
    repository = KnowledgeBaseRepository(session)
    total = await repository.count(asset_id=asset_id, source_type=source_type)
    rows = await repository.list_page(
        offset=pagination.offset,
        limit=pagination.page_size,
        asset_id=asset_id,
        source_type=source_type,
    )
    return PaginatedResponse(
        items=[_to_list_response(r) for r in rows],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/{row_id}", response_model=KnowledgeBaseDetailResponse)
async def get_knowledge_base_row(
    row_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """Return one knowledge row including embedding when present."""
    repository = KnowledgeBaseRepository(session)
    row = await repository.get_by_id(row_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return _to_detail_response(row)


@router.post("", response_model=KnowledgeBaseDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_knowledge_base_row(
    body: CreateKnowledgeBaseRequest,
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Create a knowledge row (admin)."""
    repository = KnowledgeBaseRepository(session)
    try:
        row = await repository.create(
            content=body.content,
            published_at=body.published_at,
            asset_id=body.asset_id,
            source_type=body.source_type,
            title=body.title,
            url=body.url,
            embedding=body.embedding,
            metadata=body.extra_metadata,
        )
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not create row",
        ) from exc
    return _to_detail_response(row)


@router.patch("/{row_id}", response_model=KnowledgeBaseDetailResponse)
async def update_knowledge_base_row(
    row_id: uuid.UUID,
    body: UpdateKnowledgeBaseRequest,
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Patch a knowledge row (admin)."""
    repository = KnowledgeBaseRepository(session)
    data = body.model_dump(exclude_unset=True)
    if "extra_metadata" in data:
        data["metadata"] = data.pop("extra_metadata")
    try:
        row = await repository.update(row_id, data)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Update conflict",
        ) from exc
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return _to_detail_response(row)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_base_row(
    row_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Delete a knowledge row (admin)."""
    repository = KnowledgeBaseRepository(session)
    deleted = await repository.delete(row_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
