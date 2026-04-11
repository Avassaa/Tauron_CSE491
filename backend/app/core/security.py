"""JWT access tokens, password hashing, and simple rate limiting."""

import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

_rate_limit_settings: Dict[str, int | float] = {
    "max_attempts": 100,
    "window_seconds": 3600,
}

_rate_buckets: Dict[str, List[float]] = {}


def configure_default_rate_limiter(max_attempts: int, window_hours: int) -> None:
    """Configure sliding-window rate limits keyed by client identifier."""
    _rate_limit_settings["max_attempts"] = max_attempts
    _rate_limit_settings["window_seconds"] = float(max(window_hours, 1) * 3600)


def enforce_rate_limit(identifier: str) -> None:
    """Apply the configured rate limit for the given identifier (e.g. client IP)."""
    window_seconds = float(_rate_limit_settings["window_seconds"])
    max_attempts = int(_rate_limit_settings["max_attempts"])
    now = time.time()
    cutoff = now - window_seconds
    bucket = _rate_buckets.setdefault(identifier, [])
    while bucket and bucket[0] < cutoff:
        bucket.pop(0)
    if len(bucket) >= max_attempts:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded",
        )
    bucket.append(now)


def rate_limit_client_ip(request: Request) -> None:
    """Rate limit using the client IP when available."""
    if request.client and request.client.host:
        enforce_rate_limit(f"ip:{request.client.host}")
    else:
        enforce_rate_limit("ip:unknown")


def hash_password(plain_password: str) -> str:
    """Hash a plaintext password for storage."""
    digest = bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt())
    return digest.decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Return whether the plaintext matches the stored bcrypt hash."""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        password_hash.encode("utf-8"),
    )


def create_access_token(subject_user_id: uuid.UUID) -> str:
    """Issue a signed JWT with ``sub`` set to the user id string."""
    if not settings.JWT_SECRET.strip():
        raise RuntimeError("JWT_SECRET is not configured")
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
    )
    payload = {
        "sub": str(subject_user_id),
        "exp": expire,
    }
    return jwt.encode(
        payload,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> dict:
    """Decode and validate a JWT using application settings."""
    return jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM],
    )


_http_bearer = HTTPBearer(auto_error=True)


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(_http_bearer),
) -> uuid.UUID:
    """FastAPI dependency that returns the authenticated user's id from the JWT."""
    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc
    subject = payload.get("sub")
    if not subject or not isinstance(subject, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    try:
        return uuid.UUID(subject)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user id in token",
        ) from exc
