"""
Social Platform Configuration
==============================

Configuration management for social media platform integrations.
Loads credentials and settings from environment variables.
"""

import json
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .models import PlatformCapabilities

logger = logging.getLogger(__name__)


@dataclass
class SocialConfig:
    """Configuration for social media platform integrations."""

    # Twitter/X Configuration
    twitter_enabled: bool = False
    twitter_api_key: str | None = None
    twitter_api_secret: str | None = None
    twitter_access_token: str | None = None
    twitter_access_secret: str | None = None
    twitter_bearer_token: str | None = None

    # LinkedIn Configuration
    linkedin_enabled: bool = False
    linkedin_client_id: str | None = None
    linkedin_client_secret: str | None = None
    linkedin_access_token: str | None = None
    linkedin_person_urn: str | None = None  # User's URN for posting
    linkedin_organization_urn: str | None = None  # Company page URN

    # Instagram Configuration
    instagram_enabled: bool = False
    instagram_access_token: str | None = None
    instagram_business_account_id: str | None = None
    instagram_facebook_page_id: str | None = None  # Required for Instagram API

    # Facebook Configuration
    facebook_enabled: bool = False
    facebook_app_id: str | None = None
    facebook_app_secret: str | None = None
    facebook_access_token: str | None = None
    facebook_page_id: str | None = None
    facebook_page_access_token: str | None = None

    # General Settings
    default_timezone: str = "UTC"
    auto_retry_failed_posts: bool = True
    max_retries: int = 3
    retry_delay_seconds: int = 60

    # Analytics settings
    enable_analytics: bool = True
    analytics_cache_ttl_hours: int = 24

    # Media settings
    compress_images: bool = True
    image_quality: int = 85
    max_concurrent_uploads: int = 5

    def is_valid(self) -> bool:
        """Check if any social platform is configured."""
        return (
            self.twitter_enabled
            or self.linkedin_enabled
            or self.instagram_enabled
            or self.facebook_enabled
        )

    def is_platform_enabled(self, platform: str) -> bool:
        """Check if a specific platform is enabled."""
        return getattr(self, f"{platform}_enabled", False)

    def get_platform_credentials(self, platform: str) -> dict[str, Any]:
        """Get credentials for a specific platform."""
        credentials = {}
        prefix = platform

        # Get all attributes that match the platform prefix
        for key, value in self.__dict__.items():
            if key.startswith(f"{prefix}_") and value is not None:
                # Remove prefix and _ from key
                cred_key = key.replace(f"{prefix}_", "")
                credentials[cred_key] = value

        return credentials

    @classmethod
    def from_env(cls) -> "SocialConfig":
        """Create configuration from environment variables."""
        return cls(
            # Twitter
            twitter_enabled=os.getenv("TWITTER_ENABLED", "").lower() == "true",
            twitter_api_key=os.getenv("TWITTER_API_KEY"),
            twitter_api_secret=os.getenv("TWITTER_API_SECRET"),
            twitter_access_token=os.getenv("TWITTER_ACCESS_TOKEN"),
            twitter_access_secret=os.getenv("TWITTER_ACCESS_SECRET"),
            twitter_bearer_token=os.getenv("TWITTER_BEARER_TOKEN"),
            # LinkedIn
            linkedin_enabled=os.getenv("LINKEDIN_ENABLED", "").lower() == "true",
            linkedin_client_id=os.getenv("LINKEDIN_CLIENT_ID"),
            linkedin_client_secret=os.getenv("LINKEDIN_CLIENT_SECRET"),
            linkedin_access_token=os.getenv("LINKEDIN_ACCESS_TOKEN"),
            linkedin_person_urn=os.getenv("LINKEDIN_PERSON_URN"),
            linkedin_organization_urn=os.getenv("LINKEDIN_ORGANIZATION_URN"),
            # Instagram
            instagram_enabled=os.getenv("INSTAGRAM_ENABLED", "").lower() == "true",
            instagram_access_token=os.getenv("INSTAGRAM_ACCESS_TOKEN"),
            instagram_business_account_id=os.getenv("INSTAGRAM_BUSINESS_ACCOUNT_ID"),
            instagram_facebook_page_id=os.getenv("INSTAGRAM_FACEBOOK_PAGE_ID"),
            # Facebook
            facebook_enabled=os.getenv("FACEBOOK_ENABLED", "").lower() == "true",
            facebook_app_id=os.getenv("FACEBOOK_APP_ID"),
            facebook_app_secret=os.getenv("FACEBOOK_APP_SECRET"),
            facebook_access_token=os.getenv("FACEBOOK_ACCESS_TOKEN"),
            facebook_page_id=os.getenv("FACEBOOK_PAGE_ID"),
            facebook_page_access_token=os.getenv("FACEBOOK_PAGE_ACCESS_TOKEN"),
            # General
            default_timezone=os.getenv("SOCIAL_DEFAULT_TIMEZONE", "UTC"),
            auto_retry_failed_posts=os.getenv("SOCIAL_AUTO_RETRY", "true").lower() == "true",
            max_retries=int(os.getenv("SOCIAL_MAX_RETRIES", "3")),
            retry_delay_seconds=int(os.getenv("SOCIAL_RETRY_DELAY", "60")),
            enable_analytics=os.getenv("SOCIAL_ENABLE_ANALYTICS", "true").lower() == "true",
            analytics_cache_ttl_hours=int(os.getenv("SOCIAL_ANALYTICS_CACHE_TTL", "24")),
            compress_images=os.getenv("SOCIAL_COMPRESS_IMAGES", "true").lower() == "true",
            image_quality=int(os.getenv("SOCIAL_IMAGE_QUALITY", "85")),
            max_concurrent_uploads=int(os.getenv("SOCIAL_MAX_UPLOADS", "5")),
        )

    @classmethod
    def from_file(cls, config_path: Path) -> "SocialConfig":
        """Load configuration from JSON file."""
        if not config_path.exists():
            logger.warning(f"Social config file not found: {config_path}")
            return cls.from_env()

        try:
            with open(config_path, encoding="utf-8") as f:
                data = json.load(f)
            return cls(**data)
        except (json.JSONDecodeError, OSError, TypeError) as e:
            logger.error(f"Failed to load social config: {e}")
            return cls.from_env()

    def save(self, config_path: Path) -> None:
        """Save configuration to JSON file."""
        config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(self.__dict__, f, indent=2)


def get_social_config(config_path: Path | None = None) -> SocialConfig:
    """
    Get social media configuration from file or environment.

    Args:
        config_path: Optional path to config file

    Returns:
        SocialConfig instance
    """
    if config_path and config_path.exists():
        return SocialConfig.from_file(config_path)
    return SocialConfig.from_env()


def get_platform_capabilities(platform: str) -> PlatformCapabilities:
    """
    Get capabilities and limits for a specific platform.

    Args:
        platform: Platform name (twitter, linkedin, instagram, facebook)

    Returns:
        PlatformCapabilities instance

    Raises:
        ValueError: If platform is not supported
    """
    capabilities = {
        "twitter": PlatformCapabilities(
            name="Twitter/X",
            character_limit=280,
            supports_threads=True,
            supports_images=True,
            supports_videos=True,
            supports_scheduling=False,  # Twitter API doesn't support native scheduling
            hashtag_limit=None,  # No strict limit but 2-3 recommended
            image_formats=["jpg", "png", "gif", "webp"],
            video_formats=["mp4", "mov"],
            max_image_size_mb=5.0,
            max_video_size_mb=512.0,
            max_video_duration_seconds=140,
            rate_limit_posts_per_day=2400,
            rate_limit_posts_per_hour=100,
        ),
        "linkedin": PlatformCapabilities(
            name="LinkedIn",
            character_limit=3000,
            supports_threads=False,
            supports_images=True,
            supports_videos=True,
            supports_articles=True,
            supports_scheduling=False,
            hashtag_limit=None,  # 3-5 recommended
            image_formats=["jpg", "png", "gif"],
            video_formats=["mp4", "mov", "avi"],
            max_image_size_mb=5.0,
            max_video_size_mb=500.0,
            max_video_duration_seconds=600,
            rate_limit_posts_per_day=100,
            rate_limit_posts_per_hour=10,
        ),
        "instagram": PlatformCapabilities(
            name="Instagram",
            character_limit=2200,
            supports_threads=False,
            supports_images=True,
            supports_videos=True,
            supports_stories=True,
            supports_scheduling=False,  # Requires Facebook Business Suite
            hashtag_limit=30,
            image_formats=["jpg", "png"],
            video_formats=["mp4", "mov"],
            max_image_size_mb=8.0,
            max_video_size_mb=100.0,
            max_video_duration_seconds=60,  # Feed posts; 90 for IGTV
            rate_limit_posts_per_day=25,
            rate_limit_posts_per_hour=5,
        ),
        "facebook": PlatformCapabilities(
            name="Facebook",
            character_limit=63206,
            supports_threads=False,
            supports_images=True,
            supports_videos=True,
            supports_stories=True,
            supports_scheduling=True,
            hashtag_limit=None,  # 3-5 recommended
            image_formats=["jpg", "png", "gif", "webp"],
            video_formats=["mp4", "mov", "avi"],
            max_image_size_mb=4.0,
            max_video_size_mb=1024.0,
            max_video_duration_seconds=240,
            rate_limit_posts_per_day=200,
            rate_limit_posts_per_hour=20,
        ),
    }

    if platform not in capabilities:
        raise ValueError(f"Unsupported platform: {platform}")

    return capabilities[platform]


def validate_content_for_platform(
    content: str, platform: str, media_count: int = 0
) -> tuple[bool, list[str]]:
    """
    Validate content against platform constraints.

    Args:
        content: Post content text
        platform: Target platform
        media_count: Number of media attachments

    Returns:
        Tuple of (is_valid, list_of_errors)
    """
    errors = []
    capabilities = get_platform_capabilities(platform)

    # Check character limit
    if len(content) > capabilities.character_limit:
        errors.append(
            f"Content exceeds character limit: {len(content)} > {capabilities.character_limit}"
        )

    # Platform-specific validations
    if platform == "twitter":
        # Twitter requires at least one image if media_count > 0
        if media_count > 4:
            errors.append("Twitter allows maximum 4 images per tweet")

    elif platform == "instagram":
        # Instagram requires at least one image for feed posts
        if media_count == 0:
            errors.append("Instagram feed posts require at least one image")

        if media_count > 10:
            errors.append("Instagram allows maximum 10 images per carousel")

    elif platform == "linkedin":
        if media_count > 9:
            errors.append("LinkedIn allows maximum 9 images per post")

    elif platform == "facebook":
        if media_count > 10:
            errors.append("Facebook allows maximum 10 photos per post")

    return len(errors) == 0, errors
