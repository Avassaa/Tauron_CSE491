"""Authentication routes: register and login."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    hash_password,
    rate_limit_client_ip,
    verify_password,
)
from app.db.repositories.user_repository import UserRepository
from app.db.session import get_db_session
from app.models.request.auth_request import LoginRequest, RegisterRequest
from app.models.response.auth_response import RegisterResponse, TokenResponse

router = APIRouter(prefix="/auth")


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: Request,
    body: RegisterRequest,
    session: AsyncSession = Depends(get_db_session),
):
    """Create a user account and return a JWT."""
    rate_limit_client_ip(request)
    repository = UserRepository(session)
    password_hash = hash_password(body.password)
    try:
        user = await repository.create(
            username=body.username.strip(),
            email=str(body.email).lower(),
            password_hash=password_hash,
        )
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already registered",
        ) from exc
    token = create_access_token(user.id)
    return RegisterResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        username=user.username,
        email=user.email,
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    body: LoginRequest,
    session: AsyncSession = Depends(get_db_session),
):
    """Authenticate with email and password and return a JWT."""
    rate_limit_client_ip(request)
    repository = UserRepository(session)
    user = await repository.get_by_email(str(body.email).lower())
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    token = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
    )
