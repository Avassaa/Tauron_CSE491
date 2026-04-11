"""Backtest result summaries (JWT for own rows; admin for all writes optional)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import PaginationParams, get_pagination
from app.core.security import JwtOrAdminContext, get_jwt_or_admin_context
from app.db.models.backtest_results import BacktestResult
from app.db.repositories.backtest_repository import BacktestResultRepository
from app.db.session import get_db_session
from app.models.request.table_requests import CreateBacktestResultRequest, UpdateBacktestResultRequest
from app.models.response.table_responses import BacktestResultResponse, PaginatedResponse

router = APIRouter(prefix="/backtest-results")


def _opt_float(value):
    """Return ``None`` for missing values, otherwise ``float(value)`` for ORM numerics."""
    if value is None:
        return None
    return float(value)


def _to_backtest_response(row: BacktestResult) -> BacktestResultResponse:
    """Map ORM row with Numeric fields to response."""
    return BacktestResultResponse(
        id=row.id,
        user_id=row.user_id,
        model_id=row.model_id,
        strategy_name=row.strategy_name,
        total_return=_opt_float(row.total_return),
        sharpe_ratio=_opt_float(row.sharpe_ratio),
        max_drawdown=_opt_float(row.max_drawdown),
        trades_log=row.trades_log,
        created_at=row.created_at,
    )


@router.get("", response_model=PaginatedResponse[BacktestResultResponse])
async def list_backtest_results(
    pagination: PaginationParams = Depends(get_pagination),
    session: AsyncSession = Depends(get_db_session),
    ctx: JwtOrAdminContext = Depends(get_jwt_or_admin_context),
):
    """List backtests for the current user, or all rows when using admin key."""
    repository = BacktestResultRepository(session)
    if ctx.is_admin:
        total = await repository.count_all()
        rows = await repository.list_page_admin(
            offset=pagination.offset,
            limit=pagination.page_size,
        )
    else:
        uid = ctx.user_id
        assert uid is not None
        total = await repository.count_for_user(uid)
        rows = await repository.list_page_for_user(
            uid,
            offset=pagination.offset,
            limit=pagination.page_size,
        )
    return PaginatedResponse(
        items=[_to_backtest_response(r) for r in rows],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/{result_id}", response_model=BacktestResultResponse)
async def get_backtest_result(
    result_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    ctx: JwtOrAdminContext = Depends(get_jwt_or_admin_context),
):
    """Return one backtest row if owned by the user or caller is admin."""
    repository = BacktestResultRepository(session)
    row = await repository.get_by_id(result_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if not ctx.is_admin:
        uid = ctx.user_id
        assert uid is not None
        if row.user_id != uid:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return _to_backtest_response(row)


@router.post("", response_model=BacktestResultResponse, status_code=status.HTTP_201_CREATED)
async def create_backtest_result(
    body: CreateBacktestResultRequest,
    session: AsyncSession = Depends(get_db_session),
    ctx: JwtOrAdminContext = Depends(get_jwt_or_admin_context),
):
    """Create a backtest row (user uses own id; admin may set ``user_id``)."""
    repository = BacktestResultRepository(session)
    if ctx.is_admin:
        target_user_id = body.user_id
    else:
        target_user_id = ctx.user_id
    try:
        row = await repository.create(
            user_id=target_user_id,
            model_id=body.model_id,
            strategy_name=body.strategy_name,
            total_return=body.total_return,
            sharpe_ratio=body.sharpe_ratio,
            max_drawdown=body.max_drawdown,
            trades_log=body.trades_log,
        )
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not create backtest row",
        ) from exc
    return _to_backtest_response(row)


@router.patch("/{result_id}", response_model=BacktestResultResponse)
async def update_backtest_result(
    result_id: uuid.UUID,
    body: UpdateBacktestResultRequest,
    session: AsyncSession = Depends(get_db_session),
    ctx: JwtOrAdminContext = Depends(get_jwt_or_admin_context),
):
    """Patch a backtest row (owner or admin)."""
    repository = BacktestResultRepository(session)
    row = await repository.get_by_id(result_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if not ctx.is_admin:
        uid = ctx.user_id
        assert uid is not None
        if row.user_id != uid:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    data = body.model_dump(exclude_unset=True)
    try:
        updated = await repository.update(result_id, data)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Update conflict",
        ) from exc
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return _to_backtest_response(updated)


@router.delete("/{result_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_backtest_result(
    result_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    ctx: JwtOrAdminContext = Depends(get_jwt_or_admin_context),
):
    """Delete a backtest row (owner or admin)."""
    repository = BacktestResultRepository(session)
    row = await repository.get_by_id(result_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if not ctx.is_admin:
        uid = ctx.user_id
        assert uid is not None
        if row.user_id != uid:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    deleted = await repository.delete(result_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
