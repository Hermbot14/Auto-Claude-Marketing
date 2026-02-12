"""
Integration database models for Integration Service.

Uses SQLAlchemy async ORM with PostgreSQL.
"""

from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import String, DateTime, Text, ForeignKey, Enum as SQLEnum, JSON, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.base_class import Base


class IntegrationType(str):
    """Integration type enumeration."""
    GITHUB = "github"
    SLACK = "slack"
    DISCORD = "discord"
    HUBSPOT = "hubspot"
    MAILCHIMP = "mailchimp"
    ANALYTICS = "analytics"
    CUSTOM = "custom"


class IntegrationStatus(str):
    """Integration status enumeration."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"
    PENDING = "pending"


class Integration(Base):
    """
    Integration model.

    Represents a third-party service integration with OAuth tokens
    and configuration.
    """

    __tablename__ = "integrations"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        index=True,
    )

    # Integration details
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    integration_type: Mapped[str] = mapped_column(
        SQLEnum(IntegrationType),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        SQLEnum(IntegrationStatus),
        default=IntegrationStatus.PENDING,
        nullable=False,
        index=True,
    )

    # OAuth tokens (encrypted)
    access_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    refresh_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    token_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Integration-specific config
    config: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    # Example: {"repository": "owner/repo", "channel_id": "C12345"}

    # External IDs
    external_user_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    external_account_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Webhook config
    webhook_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    webhook_secret: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Sync settings
    auto_sync_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sync_interval: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # In minutes
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Rate limiting
    rate_limit_remaining: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    rate_limit_reset: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Error handling
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_error_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

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

    # Relationships
    webhooks: Mapped[list["Webhook"]] = relationship(
        "Webhook",
        lazy="selectin",
        back_populates="integration",
        cascade="all, delete-orphan",
    )
    sync_logs: Mapped[list["SyncLog"]] = relationship(
        "SyncLog",
        lazy="selectin",
        back_populates="integration",
        cascade="all, delete-orphan",
    )


class Webhook(Base):
    """
    Webhook model.

    Represents a webhook configuration for receiving events
    from third-party services.
    """

    __tablename__ = "webhooks"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        index=True,
    )

    # Webhook details
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Integration association
    integration_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("integrations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Webhook configuration
    event_types: Mapped[list[str]] = mapped_column(
        JSON,  # Array of event types
        default=list,
        nullable=False,
    )
    # Example: ["push", "pull_request", "issues"] for GitHub

    # Endpoint configuration
    endpoint_url: Mapped[str] = mapped_column(String(500), nullable=False)
    secret: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Webhook status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Statistics
    total_received: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_received_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

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

    # Relationships
    integration: Mapped["Integration"] = relationship(
        "Integration",
        lazy="joined",
        back_populates="webhooks",
    )


class SyncLog(Base):
    """
    Sync log model.

    Tracks synchronization operations with third-party services.
    """

    __tablename__ = "sync_logs"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        index=True,
    )

    # Integration association
    integration_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("integrations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Sync details
    sync_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # Example: "full", "incremental", "webhook"

    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    # Example: "running", "completed", "failed"

    # Results
    records_processed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_created: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_updated: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_failed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Error handling
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_details: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Duration
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Trigger
    triggered_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # Example: "user", "schedule", "webhook"

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    # Relationships
    integration: Mapped["Integration"] = relationship(
        "Integration",
        lazy="joined",
        back_populates="sync_logs",
    )


class ApiClient(Base):
    """
    API Client model.

    Represents a registered API client for external integrations.
    """

    __tablename__ = "api_clients"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        index=True,
    )

    # Client details
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    client_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    client_secret: Mapped[str] = mapped_column(String(255), nullable=False)

    # OAuth settings
    redirect_uris: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    scopes: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    # Integration type
    integration_type: Mapped[str] = mapped_column(
        SQLEnum(IntegrationType),
        nullable=False,
    )

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

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
