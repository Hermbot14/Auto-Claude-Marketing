"""
Social Platform Factory
========================

Factory for creating platform instances and unified multi-platform publishing.
"""

import logging
from datetime import datetime
from pathlib import Path
from typing import Any

from .base import SocialPlatform
from .config import SocialConfig, get_social_config
from .facebook import FacebookPlatform
from .instagram import InstagramPlatform
from .linkedin import LinkedInPlatform
from .models import MediaAttachment, SocialPostResult
from .twitter import TwitterPlatform

logger = logging.getLogger(__name__)

# Platform registry
PLATFORM_CLASSES = {
    "twitter": TwitterPlatform,
    "linkedin": LinkedInPlatform,
    "instagram": InstagramPlatform,
    "facebook": FacebookPlatform,
}


def create_platform(
    platform: str,
    config: SocialConfig | None = None,
    config_path: Path | None = None,
) -> SocialPlatform:
    """
    Create a social platform instance.

    Args:
        platform: Platform name (twitter, linkedin, instagram, facebook)
        config: Optional SocialConfig instance
        config_path: Optional path to config file (used if config not provided)

    Returns:
        Configured platform instance

    Raises:
        ValueError: If platform is not supported
    """
    platform = platform.lower()

    if platform not in PLATFORM_CLASSES:
        raise ValueError(
            f"Unsupported platform: {platform}. "
            f"Supported platforms: {', '.join(PLATFORM_CLASSES.keys())}"
        )

    # Load config if not provided
    if config is None:
        config = get_social_config(config_path)

    # Get platform-specific credentials
    credentials = config.get_platform_credentials(platform)

    # Check if platform is enabled
    if not config.is_platform_enabled(platform):
        logger.warning(f"Platform {platform} is not enabled in configuration")

    # Create platform instance
    platform_class = PLATFORM_CLASSES[platform]
    return platform_class(credentials)


def get_supported_platforms() -> list[str]:
    """Get list of supported platform names."""
    return list(PLATFORM_CLASSES.keys())


async def create_all_platforms(
    config: SocialConfig | None = None,
    config_path: Path | None = None,
    only_enabled: bool = True,
) -> dict[str, SocialPlatform]:
    """
    Create instances for all supported platforms.

    Args:
        config: Optional SocialConfig instance
        config_path: Optional path to config file
        only_enabled: Only create platforms that are enabled in config

    Returns:
        Dictionary mapping platform name to platform instance
    """
    if config is None:
        config = get_social_config(config_path)

    platforms = {}

    for platform_name in PLATFORM_CLASSES.keys():
        if only_enabled and not config.is_platform_enabled(platform_name):
            continue

        try:
            platforms[platform_name] = create_platform(platform_name, config)
        except Exception as e:
            logger.error(f"Failed to create {platform_name} platform: {e}")

    return platforms


class MultiPlatformPublisher:
    """
    Publisher for posting to multiple platforms simultaneously.

    Handles content adaptation for each platform's requirements.
    """

    def __init__(
        self,
        config: SocialConfig | None = None,
        config_path: Path | None = None,
    ):
        """
        Initialize multi-platform publisher.

        Args:
            config: Optional SocialConfig instance
            config_path: Optional path to config file
        """
        self.config = config or get_social_config(config_path)
        self.platforms: dict[str, SocialPlatform] = {}

    async def initialize(self, platforms: list[str] | None = None) -> None:
        """
        Initialize and authenticate platforms.

        Args:
            platforms: List of platform names to initialize (None = all enabled)
        """
        if platforms is None:
            # Auto-detect enabled platforms
            platforms = []
            for p in get_supported_platforms():
                if self.config.is_platform_enabled(p):
                    platforms.append(p)

        for platform_name in platforms:
            try:
                platform = create_platform(platform_name, self.config)
                success = await platform.authenticate()

                if success:
                    self.platforms[platform_name] = platform
                    logger.info(f"Initialized {platform_name} platform")
                else:
                    logger.warning(f"Failed to authenticate {platform_name}")

            except Exception as e:
                logger.error(f"Failed to initialize {platform_name}: {e}")

    async def publish_to_all(
        self,
        content: str,
        media: list[MediaAttachment] | None = None,
        adapt_content: bool = True,
        **kwargs: Any,
    ) -> dict[str, SocialPostResult]:
        """
        Publish content to all initialized platforms.

        Args:
            content: Base content to publish
            media: Optional media attachments
            adapt_content: Whether to adapt content for each platform
            **kwargs: Platform-specific options

        Returns:
            Dictionary mapping platform name to post result
        """
        results = {}

        for platform_name, platform in self.platforms.items():
            try:
                # Adapt content for platform if requested
                platform_content = content
                if adapt_content:
                    platform_content = self._adapt_content_for_platform(
                        content, platform_name
                    )

                # Post to platform
                result = await platform.post_content(platform_content, media, **kwargs)
                results[platform_name] = result

                if result.success:
                    logger.info(f"Successfully published to {platform_name}")
                else:
                    logger.error(
                        f"Failed to publish to {platform_name}: {result.error_message}"
                    )

            except Exception as e:
                logger.error(f"Error publishing to {platform_name}: {e}")
                results[platform_name] = SocialPostResult(
                    success=False,
                    platform=platform_name,
                    error_message=str(e),
                )

        return results

    async def publish_to_platforms(
        self,
        target_platforms: list[str],
        content: str,
        media: list[MediaAttachment] | None = None,
        **kwargs: Any,
    ) -> dict[str, SocialPostResult]:
        """
        Publish to specific platforms only.

        Args:
            target_platforms: List of platform names to publish to
            content: Content to publish
            media: Optional media attachments
            **kwargs: Platform-specific options

        Returns:
            Dictionary mapping platform name to post result
        """
        results = {}

        for platform_name in target_platforms:
            if platform_name not in self.platforms:
                results[platform_name] = SocialPostResult(
                    success=False,
                    platform=platform_name,
                    error_message="Platform not initialized",
                )
                continue

            try:
                platform = self.platforms[platform_name]
                result = await platform.post_content(content, media, **kwargs)
                results[platform_name] = result

            except Exception as e:
                logger.error(f"Error publishing to {platform_name}: {e}")
                results[platform_name] = SocialPostResult(
                    success=False,
                    platform=platform_name,
                    error_message=str(e),
                )

        return results

    def _adapt_content_for_platform(self, content: str, platform: str) -> str:
        """
        Adapt content for a specific platform.

        Args:
            content: Original content
            platform: Target platform

        Returns:
            Adapted content
        """
        from .config import get_platform_capabilities

        capabilities = get_platform_capabilities(platform)

        # Truncate if exceeds character limit
        if len(content) > capabilities.character_limit:
            content = content[: capabilities.character_limit - 3] + "..."

        # Platform-specific adaptations
        if platform == "twitter":
            # Add hashtags inline (Twitter style)
            pass
        elif platform == "linkedin":
            # Ensure professional tone
            # LinkedIn handles line breaks well
            pass
        elif platform == "instagram":
            # Move hashtags to end (Instagram style)
            # Extract hashtags from content
            import re

            hashtags = re.findall(r"#\w+", content)
            if hashtags:
                # Remove hashtags from content
                content_without_tags = re.sub(r"#\w+", "", content).strip()
                # Add them back at the end
                content = f"{content_without_tags}\n\n{' '.join(hashtags)}"
        elif platform == "facebook":
            # Facebook handles formatting well
            pass

        return content

    async def schedule_on_all(
        self,
        content: str,
        scheduled_time: datetime,
        media: list[MediaAttachment] | None = None,
        **kwargs: Any,
    ) -> dict[str, SocialPostResult]:
        """
        Schedule content on all platforms that support scheduling.

        Args:
            content: Content to schedule
            scheduled_time: When to publish
            media: Optional media attachments
            **kwargs: Platform-specific options

        Returns:
            Dictionary mapping platform name to schedule result
        """
        results = {}

        for platform_name, platform in self.platforms.items():
            try:
                if not platform.capabilities.supports_scheduling:
                    logger.info(f"{platform_name} does not support scheduling, skipping")
                    continue

                result = await platform.schedule_post(content, scheduled_time, media, **kwargs)
                results[platform_name] = result

                if result.success:
                    logger.info(f"Successfully scheduled on {platform_name}")
                else:
                    logger.error(
                        f"Failed to schedule on {platform_name}: {result.error_message}"
                    )

            except Exception as e:
                logger.error(f"Error scheduling on {platform_name}: {e}")
                results[platform_name] = SocialPostResult(
                    success=False,
                    platform=platform_name,
                    error_message=str(e),
                )

        return results

    async def get_all_analytics(
        self, post_ids: dict[str, str]
    ) -> dict[str, Any]:
        """
        Get analytics for posts across platforms.

        Args:
            post_ids: Dictionary mapping platform name to post ID

        Returns:
            Dictionary with analytics for each platform
        """
        analytics = {}

        for platform_name, post_id in post_ids.items():
            if platform_name not in self.platforms:
                continue

            try:
                platform = self.platforms[platform_name]
                metrics = await platform.get_analytics(post_id)
                analytics[platform_name] = metrics

            except Exception as e:
                logger.error(f"Failed to get analytics for {platform_name}: {e}")
                analytics[platform_name] = None

        return analytics

    async def close(self) -> None:
        """Close all platform connections."""
        for platform in self.platforms.values():
            if hasattr(platform, "close"):
                await platform.close()
            elif hasattr(platform, "client"):
                await platform.client.aclose()

    async def __aenter__(self):
        """Async context manager entry."""
        await self.initialize()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()
