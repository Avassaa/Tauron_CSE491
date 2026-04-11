"""JWT access tokens, password hashing, and simple rate limiting."""

import secrets
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, List

import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException, Request, status
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
_http_bearer_optional = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class JwtOrAdminContext:
    """Whether the caller is an admin (API key) or a normal JWT user."""

    is_admin: bool
    user_id: uuid.UUID | None


def _token_to_user_id(token: str) -> uuid.UUID:
    """Decode JWT and return ``sub`` as UUID or raise HTTP 401."""
    try:
        payload = decode_access_token(token)
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


async def require_admin_api_key(
    x_admin_key: str | None = Header(default=None, alias="X-Admin-Key"),
) -> None:
    """Reject unless ``X-Admin-Key`` matches ``ADMIN_API_KEY`` (constant-time compare)."""
    configured = (settings.ADMIN_API_KEY or "").strip()
    if not configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin API key is not configured",
        )
    if x_admin_key is None or not secrets.compare_digest(
        x_admin_key.strip().encode("utf-8"),
        configured.encode("utf-8"),
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing admin API key",
        )


async def get_jwt_or_admin_context(
    credentials: HTTPAuthorizationCredentials | None = Depends(_http_bearer_optional),
    x_admin_key: str | None = Header(default=None, alias="X-Admin-Key"),
) -> JwtOrAdminContext:
    """Accept either valid ``X-Admin-Key`` or Bearer JWT; used for mixed user/admin endpoints."""
    configured = (settings.ADMIN_API_KEY or "").strip()
    if configured and x_admin_key is not None and secrets.compare_digest(
        x_admin_key.strip().encode("utf-8"),
        configured.encode("utf-8"),
    ):
        return JwtOrAdminContext(is_admin=True, user_id=None)
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return JwtOrAdminContext(is_admin=False, user_id=_token_to_user_id(credentials.credentials))


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(_http_bearer),
) -> uuid.UUID:
    """FastAPI dependency that returns the authenticated user's id from the JWT."""
    return _token_to_user_id(credentials.credentials)
