"""Health check routes.

Additional health endpoints beyond the default ``/health`` on the application root.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/health")


@router.get("/details")
async def health_details():
    """
    Detailed health check with additional service information.
    
    Use this for debugging or detailed monitoring.
    """
    from app.config import settings
    
    return {
        "service": settings.SERVICE_NAME,
        "service_id": settings.SERVICE_ID,
        "debug_mode": settings.DEBUG,
        "log_level": settings.LOG_LEVEL,
    }
