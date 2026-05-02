"""Authentication routes: register and login."""

from fastapi import APIRouter, Depends, HTTPException, Request, status, BackgroundTasks
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    create_password_reset_token,
    decode_password_reset_token,
    hash_password,
    rate_limit_client_ip,
    verify_password,
    get_current_user_id,
)
from app.db.repositories.user_repository import UserRepository
from app.db.session import get_db_session
from app.models.request.auth_request import (
    LoginRequest,
    RegisterRequest,
    RefreshRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from app.models.response.auth_response import RegisterResponse, TokenResponse, MessageResponse
from app.services.email_service import send_password_reset_email

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
    refresh = create_refresh_token(user.id)
    return RegisterResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        username=user.username,
        email=user.email,
        refresh_token=refresh,
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
    refresh = create_refresh_token(user.id)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        refresh_token=refresh,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: Request,
    body: RefreshRequest,
    session: AsyncSession = Depends(get_db_session),
):
    """Obtain a new access token using a valid refresh token."""
    rate_limit_client_ip(request)
    user_id = decode_refresh_token(body.refresh_token)
    
    # Optionally verify user still exists in DB
    repository = UserRepository(session)
    user = await repository.get_by_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists",
        )
        
    new_access_token = create_access_token(user.id)
    new_refresh_token = create_refresh_token(user.id)
    
    return TokenResponse(
        access_token=new_access_token,
        token_type="bearer",
        user_id=user.id,
        refresh_token=new_refresh_token,
    )





@router.post("/forgot-password", response_model=MessageResponse, status_code=status.HTTP_202_ACCEPTED)
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_db_session),
):
    """Generate a password reset token and 'send' it via email."""
    rate_limit_client_ip(request)
    repository = UserRepository(session)
    user = await repository.get_by_email(str(body.email).lower())
    
    if user:
        reset_token = create_password_reset_token(user.email)
        # Use background tasks to avoid blocking the API response while sending email
        background_tasks.add_task(send_password_reset_email, user.email, reset_token)
        
    # Always return success to prevent email enumeration attacks
    return MessageResponse(message="If your email is registered, a password reset link has been sent.")


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    session: AsyncSession = Depends(get_db_session),
):
    """Reset the password using a valid reset token."""
    rate_limit_client_ip(request)
    email = decode_password_reset_token(body.token)
    
    repository = UserRepository(session)
    user = await repository.get_by_email(email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found",
        )
        
    if verify_password(body.new_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password cannot be the same as your current password.",
        )
        
    new_password_hash = hash_password(body.new_password)
    await repository.update_password_hash(user.id, new_password_hash)
    
    return MessageResponse(message="Password has been reset successfully")
