"""
API Router v1 for Analytics Service

Defines all API endpoints for analytics and reporting.
"""

from typing import List
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.schemas.analytics import (
    EventCreate,
    EventResponse,
    MetricResponse,
    MetricQuery,
    ReportCreate,
    ReportResponse,
    DashboardResponse,
    TrendAnalysisResponse,
    ExportRequest,
    ExportResponse,
)
from app.services.event_service import EventService
from app.services.metric_service import MetricService
from app.services.report_service import ReportService
from app.services.export_service import ExportService

router = APIRouter()

# Event tracking endpoints
@router.post("/events", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def track_event(
    event_data: EventCreate,
    db: AsyncSession = Depends(get_db),
) -> EventResponse:
    """
    Track an analytics event.

    This endpoint accepts events from various sources and stores them
    in TimescaleDB for time-series analysis.

    Args:
        event_data: Event data to track
        db: Database session

    Returns:
        Created event details
    """
    service = EventService(db)
    event = await service.track_event(event_data)
    return EventResponse.model_validate(event)


@router.post("/events/batch", status_code=status.HTTP_201_ACCEPTED)
async def track_events_batch(
    events: List[EventCreate],
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Track multiple events in batch.

    Args:
        events: List of events to track
        db: Database session

    Returns:
        Number of events processed
    """
    service = EventService(db)
    processed = await service.track_events_batch(events)
    return {"processed": processed, "status": "accepted"}


# Metrics endpoints
@router.get("/metrics", response_model=List[MetricResponse])
async def get_metrics(
    query: MetricQuery = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> List[MetricResponse]:
    """
    Get aggregated metrics.

    Args:
        query: Metric query parameters
        db: Database session
        current_user: Authenticated user

    Returns:
        List of metrics
    """
    service = MetricService(db)
    metrics = await service.get_metrics(query, current_user["user_id"])
    return [MetricResponse.model_validate(m) for m in metrics]


@router.get("/metrics/trends", response_model=TrendAnalysisResponse)
async def get_trends(
    metric_name: str = Query(..., description="Name of the metric to analyze"),
    period: str = Query("7d", description="Time period (1h, 1d, 7d, 30d)"),
    granularity: str = Query("1h", description="Data granularity (1m, 5m, 1h, 1d)"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> TrendAnalysisResponse:
    """
    Get trend analysis for a specific metric.

    Args:
        metric_name: Name of metric to analyze
        period: Time period for analysis
        granularity: Data granularity
        db: Database session
        current_user: Authenticated user

    Returns:
        Trend analysis data
    """
    service = MetricService(db)
    trends = await service.get_trends(
        metric_name=metric_name,
        period=period,
        granularity=granularity,
        user_id=current_user["user_id"],
    )
    return TrendAnalysisResponse.model_validate(trends)


# Report endpoints
@router.post("/reports", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    report_data: ReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> ReportResponse:
    """
    Generate a new report.

    Args:
        report_data: Report configuration
        db: Database session
        current_user: Authenticated user

    Returns:
        Generated report details
    """
    service = ReportService(db)
    report = await service.create_report(report_data, current_user["user_id"])
    return ReportResponse.model_validate(report)


@router.get("/reports", response_model=List[ReportResponse])
async def list_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> List[ReportResponse]:
    """
    List all reports for the user.

    Args:
        skip: Number of records to skip
        limit: Maximum number of records to return
        db: Database session
        current_user: Authenticated user

    Returns:
        List of reports
    """
    service = ReportService(db)
    reports = await service.list_reports(current_user["user_id"], skip, limit)
    return [ReportResponse.model_validate(r) for r in reports]


@router.get("/reports/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> ReportResponse:
    """
    Get a specific report by ID.

    Args:
        report_id: Report UUID
        db: Database session
        current_user: Authenticated user

    Returns:
        Report details

    Raises:
        HTTPException: If report not found
    """
    service = ReportService(db)
    report = await service.get_report(report_id, current_user["user_id"])
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )
    return ReportResponse.model_validate(report)


@router.post("/reports/{report_id}/refresh", response_model=ReportResponse)
async def refresh_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> ReportResponse:
    """
    Refresh a report with latest data.

    Args:
        report_id: Report UUID
        db: Database session
        current_user: Authenticated user

    Returns:
        Updated report details
    """
    service = ReportService(db)
    report = await service.refresh_report(report_id, current_user["user_id"])
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )
    return ReportResponse.model_validate(report)


# Dashboard endpoints
@router.get("/dashboards", response_model=DashboardResponse)
async def get_dashboard_data(
    dashboard_id: str = Query(..., description="Dashboard identifier"),
    time_range: str = Query("7d", description="Time range (1d, 7d, 30d, 90d)"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> DashboardResponse:
    """
    Get data for a dashboard.

    Args:
        dashboard_id: Dashboard identifier
        time_range: Time range for data
        db: Database session
        current_user: Authenticated user

    Returns:
        Dashboard data
    """
    service = MetricService(db)
    data = await service.get_dashboard_data(
        dashboard_id=dashboard_id,
        time_range=time_range,
        user_id=current_user["user_id"],
    )
    return DashboardResponse.model_validate(data)


# Export endpoints
@router.post("/export", response_model=ExportResponse)
async def export_data(
    export_request: ExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> ExportResponse:
    """
    Export data in various formats.

    Supported formats: CSV, Excel, JSON

    Args:
        export_request: Export configuration
        db: Database session
        current_user: Authenticated user

    Returns:
        Export file details
    """
    service = ExportService(db)
    result = await service.export_data(export_request, current_user["user_id"])
    return ExportResponse.model_validate(result)


@router.get("/export/{export_id}/download")
async def download_export(
    export_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Download an exported file.

    Args:
        export_id: Export UUID
        db: Database session
        current_user: Authenticated user

    Returns:
        File download response
    """
    from fastapi.responses import FileResponse

    service = ExportService(db)
    file_path = await service.get_export_file(export_id, current_user["user_id"])
    if not file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Export not found",
        )
    return FileResponse(
        path=file_path.path,
        filename=file_path.filename,
        media_type=file_path.media_type,
    )
