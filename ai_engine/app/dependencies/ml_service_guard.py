"""Shared FastAPI guards for exposing ML tooling only to trusted gateways."""

from __future__ import annotations

import hashlib
import hmac

from fastapi import Header, HTTPException, status

from app.core.config import settings


def enforce_configured_ml_service_secret(secret_header_value: str | None) -> None:
    """Honor ML_SERVICE_KEY by comparing SHA-256 digests constant-time-wise."""
    expectation = settings.ML_SERVICE_KEY.strip()
    if not expectation:
        return
    supplied_normalized = (secret_header_value or "").strip()
    digested_provided = hashlib.sha256(supplied_normalized.encode("utf-8")).digest()
    digested_expectation = hashlib.sha256(expectation.encode("utf-8")).digest()
    if not hmac.compare_digest(digested_provided, digested_expectation):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-ML-Service-Key mismatch",
        )


async def dependency_ml_service_secret_optional_header(
    x_ml_service_key: str | None = Header(default=None, alias="X-ML-Service-Key"),
) -> None:
    """FastAPI Depends hook validating ``X-ML-Service-Key`` when configured."""

    enforce_configured_ml_service_secret(x_ml_service_key)
