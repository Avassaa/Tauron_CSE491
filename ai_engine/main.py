"""Application entrypoint wiring routers and CORS for the AI engine service."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routes import router

app = FastAPI(
    title="Tauron AI Engine",
    description="AI Engine service for Tauron project",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")


@app.get("/")
async def root():
    """Lightweight metadata for human operators."""
    return {"message": "Tauron AI Engine", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    """Container orchestration hook mirroring other services."""
    return {"status": "healthy", "service": "ai-engine"}

