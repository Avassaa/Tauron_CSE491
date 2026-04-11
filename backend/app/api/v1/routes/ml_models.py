"""Registered ML models (read: JWT; write: admin)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import PaginationParams, get_pagination
from app.core.security import get_current_user_id, require_admin_api_key
from app.db.repositories.ml_model_repository import MlModelRepository
from app.db.session import get_db_session
from app.models.request.table_requests import CreateMlModelRequest, UpdateMlModelRequest
from app.models.response.table_responses import MlModelResponse, PaginatedResponse

router = APIRouter(prefix="/ml-models")


@router.get("", response_model=PaginatedResponse[MlModelResponse])
async def list_ml_models(
    pagination: PaginationParams = Depends(get_pagination),
    asset_id: uuid.UUID | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """List ML model registrations."""
    repository = MlModelRepository(session)
    total = await repository.count(asset_id=asset_id, is_active=is_active)
    rows = await repository.list_page(
        offset=pagination.offset,
        limit=pagination.page_size,
        asset_id=asset_id,
        is_active=is_active,
    )
    return PaginatedResponse(
        items=[MlModelResponse.model_validate(r) for r in rows],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/{model_id}", response_model=MlModelResponse)
async def get_ml_model(
    model_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """Return one ML model by id."""
    repository = MlModelRepository(session)
    row = await repository.get_by_id(model_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    return MlModelResponse.model_validate(row)


@router.post("", response_model=MlModelResponse, status_code=status.HTTP_201_CREATED)
async def create_ml_model(
    body: CreateMlModelRequest,
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Register an ML model (admin)."""
    repository = MlModelRepository(session)
    try:
        row = await repository.create(
            version_tag=body.version_tag,
            asset_id=body.asset_id,
            model_type=body.model_type,
            hyperparameters=body.hyperparameters,
            training_metrics=body.training_metrics,
            file_path=body.file_path,
            is_active=body.is_active,
        )
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not create model",
        ) from exc
    return MlModelResponse.model_validate(row)


@router.patch("/{model_id}", response_model=MlModelResponse)
async def update_ml_model(
    model_id: uuid.UUID,
    body: UpdateMlModelRequest,
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Patch ML model metadata (admin)."""
    repository = MlModelRepository(session)
    data = body.model_dump(exclude_unset=True)
    try:
        row = await repository.update(model_id, data)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Update conflicts with existing data",
        ) from exc
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    return MlModelResponse.model_validate(row)


@router.delete("/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ml_model(
    model_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    _admin: None = Depends(require_admin_api_key),
):
    """Delete an ML model (admin)."""
    repository = MlModelRepository(session)
    try:
        deleted = await repository.delete(model_id)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Model is still referenced by predictions or backtests",
        ) from exc
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
