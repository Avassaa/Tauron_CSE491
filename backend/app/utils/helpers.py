"""Utility helper functions.

Common utility functions used across the service.
Add your service-specific helpers here.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)


def generate_id(prefix: str = "") -> str:
    """
    Generate a unique ID with optional prefix.
    
    Args:
        prefix: Optional prefix (e.g., "user_", "order_")
        
    Returns:
        Unique ID string
        
    Example:
        >>> generate_id("user_")
        'user_abc123def456'
    """
    unique_part = uuid4()
    return f"{prefix}{unique_part}" if prefix else unique_part


def utc_now() -> datetime:
    """
    Get current UTC datetime.
    
    Returns:
        Current datetime in UTC with timezone info
    """
    return datetime.now(timezone.utc)


def parse_datetime(value: Any) -> Optional[datetime]:
    """
    Parse a datetime value from various formats.
    
    Args:
        value: String, datetime, or None
        
    Returns:
        datetime object or None
    """
    if value is None:
        return None
    
    if isinstance(value, datetime):
        return value
    
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            pass
        
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(value, fmt).replace(tzinfo=timezone.utc)
            except ValueError:
                continue
    
    logger.warning(f"Could not parse datetime: {value}")
    return None


def safe_json_loads(value: Optional[str], default: Any = None) -> Any:
    """
    Safely parse JSON string.
    
    Args:
        value: JSON string or None
        default: Default value if parsing fails
        
    Returns:
        Parsed JSON or default value
    """
    if value is None:
        return default
    
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        logger.warning(f"Failed to parse JSON: {value[:100] if value else 'None'}")
        return default


def truncate_string(value: str, max_length: int = 100, suffix: str = "...") -> str:
    """
    Truncate a string to a maximum length.
    
    Args:
        value: String to truncate
        max_length: Maximum length
        suffix: Suffix to add if truncated
        
    Returns:
        Truncated string
    """
    if len(value) <= max_length:
        return value
    return value[:max_length - len(suffix)] + suffix


def mask_sensitive(value: str, visible_chars: int = 4) -> str:
    """
    Mask sensitive data, showing only first few characters.
    
    Args:
        value: Sensitive string to mask
        visible_chars: Number of characters to show
        
    Returns:
        Masked string
        
    Example:
        >>> mask_sensitive("secret-api-key-12345")
        'secr************'
    """
    if len(value) <= visible_chars:
        return "*" * len(value)
    return value[:visible_chars] + "*" * (len(value) - visible_chars)
