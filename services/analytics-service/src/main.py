"""
Analytics Service - Main Application Entry Point

This service handles event tracking, metric aggregation,
report generation, and dashboard data.
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
from app.db.session import engine, init_db
from app.services.event_processor import EventProcessorService
from app.services.metric_aggregator import MetricAggregatorService

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

# Global services
event_processor: EventProcessorService | None = None
metric_aggregator: MetricAggregatorService | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Lifespan context manager for startup and shutdown events.
    """
    global event_processor, metric_aggregator

    # Startup
    logger.info("Starting Analytics Service...")

    # Initialize database (TimescaleDB)
    await init_db()
    logger.info("TimescaleDB initialized")

    # Initialize services
    event_processor = EventProcessorService()
    await event_processor.start()
    logger.info("Event processor started")

    metric_aggregator = MetricAggregatorService()
    await metric_aggregator.start()
    logger.info("Metric aggregator started")

    yield

    # Shutdown
    logger.info("Shutting down Analytics Service...")
    if event_processor:
        await event_processor.stop()
    if metric_aggregator:
        await metric_aggregator.stop()
    await engine.dispose()
    logger.info("Analytics Service stopped")


# Create FastAPI application
app = FastAPI(
    title="Analytics Service",
    description="Analytics and Reporting Service for Auto Claude Marketing Hub",
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

# Include API router
app.include_router(api_router, prefix="/api/v1")

# Prometheus metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)


# Health check endpoints
@app.get("/health", tags=["Health"])
async def health_check():
    """Basic health check endpoint."""
    return {"status": "healthy", "service": "analytics-service"}


@app.get("/health/ready", tags=["Health"])
async def readiness_check():
    """Readiness check - verifies service can handle requests."""
    try:
        from sqlalchemy import text
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ready", "service": "analytics-service"}
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        return {"status": "not ready", "service": "analytics-service", "error": str(e)}


@app.get("/health/live", tags=["Health"])
async def liveness_check():
    """Liveness check - verifies service is running."""
    return {"status": "alive", "service": "analytics-service"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8003,
        reload=settings.DEBUG,
        log_level="info",
    )
