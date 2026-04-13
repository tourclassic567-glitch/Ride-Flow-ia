"""Health-check endpoints."""
from fastapi import APIRouter
from app.api.schemas import HealthResponse
from app.config import get_settings

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse, summary="Health check")
async def health_check():
    """Returns application health status."""
    settings = get_settings()
    return HealthResponse(
        status="ok",
        version=settings.app_version,
        environment=settings.environment,
    )
