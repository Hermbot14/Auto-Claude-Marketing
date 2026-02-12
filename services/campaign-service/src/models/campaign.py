"""
Campaign database models for Campaign Service.

Uses SQLAlchemy async ORM with PostgreSQL.
"""

from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import String, DateTime, Text, ForeignKey, Enum as SQLEnum, JSON, Numeric, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.base_class import Base


class CampaignStatus(str):
    """Campaign status enumeration."""
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Campaign(Base):
    """
    Campaign model.

    Represents a marketing campaign with scheduling,
    targeting, and performance tracking.
    """

    __tablename__ = "campaigns"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        SQLEnum(CampaignStatus),
        default=CampaignStatus.DRAFT,
        nullable=False,
        index=True,
    )

    # Scheduling
    start_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Targeting
    audience_segment_id: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("audience_segments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Content
    content_id: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("content_items.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Budget and goals
    budget: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    target_impressions: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    target_clicks: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    target_conversions: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Configuration
    config: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

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
    audience_segment: Mapped["AudienceSegment"] = relationship(
        "AudienceSegment",
        lazy="joined",
        back_populates="campaigns",
    )
    ab_tests: Mapped[list["ABTest"]] = relationship(
        "ABTest",
        lazy="selectin",
        back_populates="campaign",
        cascade="all, delete-orphan",
    )
    metrics: Mapped[list["CampaignMetric"]] = relationship(
        "CampaignMetric",
        lazy="selectin",
        back_populates="campaign",
        cascade="all, delete-orphan",
    )


class AudienceSegment(Base):
    """
    Audience segment model.

    Defines a target audience for campaigns based on
    demographics, behavior, or custom criteria.
    """

    __tablename__ = "audience_segments"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Segment criteria
    criteria: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    # Example: {"age_min": 25, "age_max": 45, "interests": ["tech", "marketing"]}

    # Estimated size
    estimated_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

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
    campaigns: Mapped[list["Campaign"]] = relationship(
        "Campaign",
        lazy="selectin",
        back_populates="audience_segment",
    )


class ABTest(Base):
    """
    A/B Test model.

    Manages split testing for campaigns to compare
    different variations and determine effectiveness.
    """

    __tablename__ = "ab_tests"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Campaign association
    campaign_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Test configuration
    variants: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    # Example: {"A": {"subject": "Hello", "body": "..."}, "B": {"subject": "Hi", "body": "..."}}

    traffic_split: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    # Example: {"A": 0.5, "B": 0.5}

    status: Mapped[str] = mapped_column(
        String(50),
        default="draft",
        nullable=False,
        index=True,
    )

    # Test duration
    start_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Winner
    winner_variant: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

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
    campaign: Mapped["Campaign"] = relationship(
        "Campaign",
        lazy="joined",
        back_populates="ab_tests",
    )
    metrics: Mapped[list["ABTestMetric"]] = relationship(
        "ABTestMetric",
        lazy="selectin",
        back_populates="ab_test",
        cascade="all, delete-orphan",
    )


class CampaignMetric(Base):
    """
    Campaign metric model.

    Stores performance metrics for campaigns,
    aggregated at regular intervals.
    """

    __tablename__ = "campaign_metrics"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        index=True,
    )

    # Campaign association
    campaign_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Metric data
    impressions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    clicks: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    conversions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    spend: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)

    # Calculated metrics
    ctr: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 4), nullable=True)  # Click-through rate
    cpc: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)  # Cost per click
    cpa: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)  # Cost per acquisition

    # Timestamp
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
        index=True,
    )

    # Relationships
    campaign: Mapped["Campaign"] = relationship(
        "Campaign",
        lazy="joined",
        back_populates="metrics",
    )


class ABTestMetric(Base):
    """
    A/B Test metric model.

    Stores performance metrics for each variant in an A/B test.
    """

    __tablename__ = "ab_test_metrics"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        index=True,
    )

    # A/B Test association
    ab_test_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ab_tests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Variant identifier
    variant: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    # Metric data
    impressions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    clicks: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    conversions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Calculated metrics
    ctr: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 4), nullable=True)
    conversion_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 4), nullable=True)

    # Statistical significance
    is_significant: Mapped[bool] = mapped_column(default=False, nullable=False)
    confidence_level: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)

    # Timestamp
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    # Relationships
    ab_test: Mapped["ABTest"] = relationship(
        "ABTest",
        lazy="joined",
        back_populates="metrics",
    )
