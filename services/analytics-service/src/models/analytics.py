"""
Analytics database models for Analytics Service.

Uses SQLAlchemy async ORM with TimescaleDB (PostgreSQL extension).
"""

from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import String, DateTime, Text, ForeignKey, JSON, Numeric, Integer, Index
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, ARRAY

from app.db.base_class import Base


class Event(Base):
    """
    Event model for time-series analytics data.

    TimescaleDB hypertable for efficient time-series queries.
    """

    __tablename__ = "events"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # Event identification
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    event_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Event data
    properties: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    # Context
    user_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    session_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    campaign_id: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )
    content_id: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )

    # Metadata
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    referrer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Timestamp (TimescaleDB time column)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
        index=True,
    )

    __table_args__ = (
        Index('ix_events_user_timestamp', 'user_id', 'timestamp'),
        Index('ix_events_type_timestamp', 'event_type', 'timestamp'),
        Index('ix_events_campaign_timestamp', 'campaign_id', 'timestamp'),
    )


class Metric(Base):
    """
    Aggregated metric model.

    Stores pre-aggregated metrics for efficient querying.
    """

    __tablename__ = "metrics"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # Metric identification
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    labels: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    # Metric values
    value: Mapped[float] = mapped_column(Numeric(20, 6), nullable=False)
    count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Aggregation window
    window_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    window_end: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    __table_args__ = (
        Index('ix_metrics_name_window', 'name', 'window_start'),
    )


class Report(Base):
    """
    Report model.

    Stores generated reports with their configurations.
    """

    __tablename__ = "reports"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # Report details
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    report_type: Mapped[str] = mapped_column(String(50), nullable=False)

    # Report configuration
    config: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    # Report data
    data: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    # Status
    status: Mapped[str] = mapped_column(
        String(50),
        default="pending",
        nullable=False,
    )

    # Scheduling
    is_scheduled: Mapped[bool] = mapped_column(default=False, nullable=False)
    schedule: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Ownership
    user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
    last_run_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )


class DataExport(Base):
    """
    Data export model.

    Tracks export jobs and their status.
    """

    __tablename__ = "data_exports"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # Export configuration
    export_type: Mapped[str] = mapped_column(String(50), nullable=False)
    format: Mapped[str] = mapped_column(String(20), nullable=False)  # csv, xlsx, json

    # Query parameters
    query_params: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    # File details
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Status
    status: Mapped[str] = mapped_column(
        String(50),
        default="pending",
        nullable=False,
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Expiry
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    # Ownership
    user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
