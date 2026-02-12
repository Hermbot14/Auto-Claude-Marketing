"""
Integration Service - Main Application Entry Point

This service handles third-party integrations including:
- OAuth flow management
- API client management
- Webhook handling
- Rate limiting
- Error handling and retry logic
Part of the Auto Claude Marketing Hub microservices architecture.
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import make_asgi_app

from app.core.config import settings
from app.core.logging import setup_logging
from app.api.v1.router import api_router
from app.api.v1.auth_router import auth_router
from app.api.v1.webhook_router import webhook_router
from app.db.session import engine, init_db
from app.services.oauth_service import OAuthService
from app.services.webhook_service import WebhookService
from app.services.sync_service import SyncService

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

# Global services
oauth_service: OAuthService | None = None
webhook_service: WebhookService | None = None
sync_service: SyncService | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Lifespan context manager for startup and shutdown events.
    """
    global oauth_service, webhook_service, sync_service

    # Startup
    logger.info("Starting Integration Service...")

    # Initialize database
    await init_db()
    logger.info("Database initialized")

    # Initialize services
    oauth_service = OAuthService()
    await oauth_service.initialize()
    logger.info("OAuth service initialized")

    webhook_service = WebhookService()
    await webhook_service.start()
    logger.info("Webhook service started")

    sync_service = SyncService()
    await sync_service.start()
    logger.info("Sync service started")

    yield

    # Shutdown
    logger.info("Shutting down Integration Service...")
    if webhook_service:
        await webhook_service.stop()
    if sync_service:
        await sync_service.stop()
    await engine.dispose()
    logger.info("Integration Service stopped")


# Create FastAPI application
app = FastAPI(
    title="Integration Service",
    description="Third-Party Integration Service for Auto Claude Marketing Hub",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/auth")  # No auth required for auth endpoints
app.include_router(webhook_router, prefix="/webhooks")  # No auth for webhooks
app.include_router(api_router, prefix="/api/v1")

# Prometheus metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)


# Health check endpoints
@app.get("/health", tags=["Health"])
async def health_check():
    """Basic health check endpoint."""
    return {"status": "healthy", "service": "integration-service"}


@app.get("/health/ready", tags=["Health"])
async def readiness_check():
    """Readiness check - verifies service can handle requests."""
    try:
        from sqlalchemy import text
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ready", "service": "integration-service"}
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        return {"status": "not ready", "service": "integration-service", "error": str(e)}


@app.get("/health/live", tags=["Health"])
async def liveness_check():
    """Liveness check - verifies service is running."""
    return {"status": "alive", "service": "integration-service"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8005,
        reload=settings.DEBUG,
        log_level="info",
    )
