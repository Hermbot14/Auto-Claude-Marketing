"""
Campaign Service - Main Application Entry Point

This service manages campaign lifecycle, scheduling, targeting, and A/B testing.
Part of the Auto Claude Marketing Hub microservices architecture.
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import make_asgi_app
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import settings
from app.core.logging import setup_logging
from app.api.v1.router import api_router
from app.db.session import engine, init_db
from app.services.scheduler_service import CampaignSchedulerService

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

# Global scheduler
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Lifespan context manager for startup and shutdown events.
    """
    # Startup
    logger.info("Starting Campaign Service...")

    # Initialize database
    await init_db()
    logger.info("Database initialized")

    # Start scheduler
    scheduler_service = CampaignSchedulerService(scheduler)
    scheduler.start()
    logger.info("Campaign scheduler started")

    yield

    # Shutdown
    logger.info("Shutting down Campaign Service...")
    scheduler.shutdown()
    await engine.dispose()
    logger.info("Campaign Service stopped")


# Create FastAPI application
app = FastAPI(
    title="Campaign Service",
    description="Campaign Management Service for Auto Claude Marketing Hub",
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
    return {"status": "healthy", "service": "campaign-service"}


@app.get("/health/ready", tags=["Health"])
async def readiness_check():
    """Readiness check - verifies service can handle requests."""
    # Check database connection
    try:
        from sqlalchemy import text
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ready", "service": "campaign-service"}
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        return {"status": "not ready", "service": "campaign-service", "error": str(e)}


@app.get("/health/live", tags=["Health"])
async def liveness_check():
    """Liveness check - verifies service is running."""
    return {"status": "alive", "service": "campaign-service"}


# OpenTelemetry setup (conditional)
if settings.OTEL_ENABLED:
    logger.info("Setting up OpenTelemetry tracing...")
    trace.set_tracer_provider(TracerProvider())
    tracer_provider = trace.get_tracer_provider()
    span_processor = BatchSpanProcessor(
        OTLPSpanExporter(endpoint=settings.OTEL_EXPORTER_OTLP_ENDPOINT)
    )
    tracer_provider.add_span_processor(span_processor)
    FastAPIInstrumentor.instrument_app(app, tracer_provider=tracer_provider)
    logger.info("OpenTelemetry tracing enabled")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=settings.DEBUG,
        log_level="info",
    )
