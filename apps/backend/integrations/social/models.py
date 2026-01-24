"""
Social Platform Data Models
============================

Data classes for social media posts, media, and metrics.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, HttpUrl


class MediaType(str, Enum):
    """Supported media types for social posts."""

    IMAGE = "image"
    VIDEO = "video"
    GIF = "gif"
    DOCUMENT = "document"


class PostStatus(str, Enum):
    """Status of a social media post."""

    DRAFT = "draft"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    FAILED = "failed"
    CANCELLED = "cancelled"


class MediaAttachment(BaseModel):
    """Media attachment for social posts."""

    url: HttpUrl
    media_type: MediaType
    alt_text: str | None = None
    thumbnail_url: HttpUrl | None = None
    duration_seconds: int | None = None  # For videos
    width: int | None = None
    height: int | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    class Config:
        json_encoders = {
            HttpUrl: str,
        }


class SocialMetrics(BaseModel):
    """Engagement metrics for a social post."""

    post_id: str
    platform: str
    impressions: int = 0
    reach: int = 0
    engagements: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    clicks: int = 0
    video_views: int = 0  # For video content
    saved_count: int = 0  # Instagram/LinkedIn specific

    # Computed metrics
    engagement_rate: float | None = None  # engagements / impressions

    # Timestamps
    metrics_fetched_at: datetime
    post_created_at: datetime | None = None

    def calculate_engagement_rate(self) -> float:
        """Calculate engagement rate as percentage."""
        if self.impressions > 0:
            self.engagement_rate = round((self.engagements / self.impressions) * 100, 2)
        else:
            self.engagement_rate = 0.0
        return self.engagement_rate


class ScheduledPost(BaseModel):
    """A scheduled social media post."""

    post_id: str | None = None  # Assigned after scheduling
    platform: str
    content: str
    media: list[MediaAttachment] = []
    scheduled_for: datetime
    status: PostStatus = PostStatus.SCHEDULED

    # Optional targeting
    target_audience: dict[str, Any] | None = None
    location_ids: list[str] = []
    language: str | None = None

    # Metadata
    created_at: datetime
    updated_at: datetime
    metadata: dict[str, Any] = {}

    # Campaign tracking
    campaign_id: str | None = None
    tracking_params: dict[str, str] = {}


class SocialPostResult(BaseModel):
    """Result of a social media post operation."""

    success: bool
    platform: str
    post_id: str | None = None
    post_url: str | None = None
    error_message: str | None = None
    error_code: str | None = None
    scheduled_for: datetime | None = None
    metrics: SocialMetrics | None = None

    # Platform-specific response data
    raw_response: dict[str, Any] = {}

    def to_dict(self) -> dict[str, Any]:
        """Convert result to dictionary."""
        return {
            "success": self.success,
            "platform": self.platform,
            "post_id": self.post_id,
            "post_url": str(self.post_url) if self.post_url else None,
            "error_message": self.error_message,
            "error_code": self.error_code,
            "scheduled_for": self.scheduled_for.isoformat() if self.scheduled_for else None,
            "metrics": self.metrics.model_dump() if self.metrics else None,
        }


@dataclass
class PlatformCapabilities:
    """Capabilities and limits for a social platform."""

    name: str
    character_limit: int
    supports_threads: bool = False
    supports_images: bool = False
    supports_videos: bool = False
    supports_stories: bool = False
    supports_articles: bool = False
    supports_scheduling: bool = False
    hashtag_limit: int | None = None
    image_formats: list[str] = field(default_factory=lambda: ["jpg", "png", "gif"])
    video_formats: list[str] = field(default_factory=lambda: ["mp4", "mov"])
    max_image_size_mb: float = 5.0
    max_video_size_mb: float = 100.0
    max_video_duration_seconds: int = 600

    # API rate limits
    rate_limit_posts_per_day: int = 100
    rate_limit_posts_per_hour: int = 10
