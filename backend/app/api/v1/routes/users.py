"""Authenticated user profile routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id, hash_password, verify_password
from app.db.repositories.user_repository import UserRepository
from app.db.session import get_db_session
from app.models.request.table_requests import ChangePasswordRequest, PatchMeRequest
from app.models.response.table_responses import UserPublicResponse

router = APIRouter(prefix="/users")


@router.get("/me", response_model=UserPublicResponse)
async def get_me(
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    """Return the current user's profile."""
    repository = UserRepository(session)
    user = await repository.get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserPublicResponse.model_validate(user)


@router.patch("/me", response_model=UserPublicResponse)
async def patch_me(
    body: PatchMeRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    """Update profile fields for the current user."""
    repository = UserRepository(session)
    data = body.model_dump(exclude_unset=True)
    if not data:
        user = await repository.get_by_id(user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return UserPublicResponse.model_validate(user)
    if "email" in data and data["email"] is not None:
        data["email"] = str(data["email"]).lower()
    try:
        user = await repository.update_profile(user_id, **data)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already in use",
        ) from exc
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserPublicResponse.model_validate(user)


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: ChangePasswordRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    """Change password after verifying the current password."""
    repository = UserRepository(session)
    user = await repository.get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    new_hash = hash_password(body.new_password)
    await repository.update_password_hash(user_id, new_hash)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
):
    """Delete the current user account."""
    repository = UserRepository(session)
    deleted = await repository.delete_user(user_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
