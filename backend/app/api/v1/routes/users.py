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


def _to_user_public_response(user) -> UserPublicResponse:
    """Project ORM user into API response, including full_name from preferences."""
    full_name = None
    if isinstance(user.preferences, dict):
        value = user.preferences.get("full_name")
        if isinstance(value, str):
            trimmed = value.strip()
            full_name = trimmed or None
    return UserPublicResponse(
        id=user.id,
        username=user.username,
        full_name=full_name,
        email=user.email,
        preferences=user.preferences,
        created_at=user.created_at,
    )


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
    return _to_user_public_response(user)


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
        return _to_user_public_response(user)
    full_name = data.pop("full_name", None)
    if full_name is not None:
        base_preferences = data.get("preferences")
        if not isinstance(base_preferences, dict):
            existing = await repository.get_by_id(user_id)
            if existing is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
            base_preferences = (
                dict(existing.preferences) if isinstance(existing.preferences, dict) else {}
            )
        normalized_full_name = full_name.strip()
        base_preferences["full_name"] = normalized_full_name
        data["preferences"] = base_preferences
    if "email" in data and data["email"] is not None:
        data["email"] = str(data["email"]).lower()
    if "username" in data and data["username"] is not None:
        data["username"] = str(data["username"]).strip()
    try:
        user = await repository.update_profile(user_id, **data)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already in use",
        ) from exc
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _to_user_public_response(user)


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
