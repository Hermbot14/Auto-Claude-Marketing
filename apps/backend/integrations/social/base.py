"""
Social Platform Base Interface
===============================

Abstract base class defining the unified interface for all social platforms.
"""

import logging
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any

from .config import get_platform_capabilities
from .models import (
    MediaAttachment,
    PlatformCapabilities,
    ScheduledPost,
    SocialMetrics,
    SocialPostResult,
)

logger = logging.getLogger(__name__)


class SocialPlatformError(Exception):
    """Base exception for social platform errors."""

    def __init__(
        self, message: str, platform: str, error_code: str | None = None
    ) -> None:
        self.platform = platform
        self.error_code = error_code
        super().__init__(f"[{platform.upper()}] {message}")


class AuthenticationError(SocialPlatformError):
    """Raised when authentication fails."""

    pass


class RateLimitError(SocialPlatformError):
    """Raised when rate limit is exceeded."""

    def __init__(self, message: str, platform: str, retry_after: int | None = None) -> None:
        self.retry_after = retry_after
        super().__init__(message, platform, "rate_limit_exceeded")


class ContentValidationError(SocialPlatformError):
    """Raised when content validation fails."""

    pass


class SocialPlatform(ABC):
    """
    Abstract base class for social media platform integrations.

    All platform implementations must inherit from this class and implement
    the defined methods for consistent behavior across platforms.
    """

    def __init__(self, config: dict[str, Any]) -> None:
        """
        Initialize the platform with configuration.

        Args:
            config: Platform-specific configuration dictionary
        """
        self.config = config
        self.platform_name = self.__class__.__name__.replace("Platform", "").lower()
        self.capabilities = get_platform_capabilities(self.platform_name)
        self._authenticated = False

    # ---------------------------------------------------------------------
    # Authentication
    # ---------------------------------------------------------------------

    @abstractmethod
    async def authenticate(self) -> bool:
        """
        Authenticate with the platform using configured credentials.

        Returns:
            True if authentication successful, False otherwise

        Raises:
            AuthenticationError: If authentication fails
        """
        pass

    def is_authenticated(self) -> bool:
        """Check if currently authenticated."""
        return self._authenticated

    def require_auth(self) -> None:
        """Raise exception if not authenticated."""
        if not self._authenticated:
            raise AuthenticationError(
                f"Not authenticated with {self.platform_name}. Call authenticate() first.",
                self.platform_name,
            )

    # ---------------------------------------------------------------------
    # Posting
    # ---------------------------------------------------------------------

    @abstractmethod
    async def post_content(
        self,
        content: str,
        media: list[MediaAttachment] | None = None,
        **kwargs: Any,
    ) -> SocialPostResult:
        """
        Post content to the platform.

        Args:
            content: Text content to post
            media: Optional list of media attachments
            **kwargs: Platform-specific options (e.g., targeting, scheduling)

        Returns:
            SocialPostResult with post_id and post_url if successful

        Raises:
            AuthenticationError: If not authenticated
            ContentValidationError: If content violates platform rules
            RateLimitError: If rate limit exceeded
        """
        pass

    async def post_thread(
        self, tweets: list[str], **kwargs: Any
    ) -> list[SocialPostResult]:
        """
        Post a thread of connected posts (platforms that support threads).

        Args:
            tweets: List of content for each tweet in thread
            **kwargs: Platform-specific options

        Returns:
            List of SocialPostResult for each post in thread

        Raises:
            NotImplementedError: If platform doesn't support threads
        """
        if not self.capabilities.supports_threads:
            raise NotImplementedError(
                f"{self.platform_name} does not support threads"
            )

        # Default implementation for platforms that support threads
        # (Override in platform-specific implementation if needed)
        results = []
        for i, content in enumerate(tweets):
            reply_to_id = results[-1].post_id if i > 0 else None
            result = await self.post_content(content, reply_to_id=reply_to_id, **kwargs)
            results.append(result)
        return results

    # ---------------------------------------------------------------------
    # Scheduling
    # ---------------------------------------------------------------------

    async def schedule_post(
        self,
        content: str,
        scheduled_time: datetime,
        media: list[MediaAttachment] | None = None,
        **kwargs: Any,
    ) -> SocialPostResult:
        """
        Schedule a post for future publication.

        Args:
            content: Text content to post
            scheduled_time: When to publish the post
            media: Optional list of media attachments
            **kwargs: Platform-specific options

        Returns:
            SocialPostResult with scheduled post information

        Raises:
            NotImplementedError: If platform doesn't support scheduling
        """
        if not self.capabilities.supports_scheduling:
            raise NotImplementedError(
                f"{self.platform_name} does not support native scheduling"
            )

        # Override in platform implementations
        raise NotImplementedError(
            f"Scheduling not implemented for {self.platform_name}"
        )

    # ---------------------------------------------------------------------
    # Analytics
    # ---------------------------------------------------------------------

    @abstractmethod
    async def get_analytics(self, post_id: str) -> SocialMetrics:
        """
        Retrieve analytics/metrics for a specific post.

        Args:
            post_id: Platform-specific post identifier

        Returns:
            SocialMetrics with engagement data

        Raises:
            AuthenticationError: If not authenticated
            ValueError: If post_id is invalid
        """
        pass

    async def get_multiple_analytics(
        self, post_ids: list[str]
    ) -> dict[str, SocialMetrics]:
        """
        Retrieve analytics for multiple posts in batch.

        Args:
            post_ids: List of platform-specific post identifiers

        Returns:
            Dictionary mapping post_id to SocialMetrics
        """
        results = {}
        for post_id in post_ids:
            try:
                results[post_id] = await self.get_analytics(post_id)
            except Exception as e:
                logger.error(f"Failed to get analytics for {post_id}: {e}")
                results[post_id] = None
        return results

    # ---------------------------------------------------------------------
    # Content Management
    # ---------------------------------------------------------------------

    async def delete_post(self, post_id: str) -> bool:
        """
        Delete a previously published post.

        Args:
            post_id: Platform-specific post identifier

        Returns:
            True if deletion successful

        Raises:
            NotImplementedError: If platform doesn't support deletion
        """
        # Default implementation - override if platform supports deletion
        raise NotImplementedError(
            f"Delete not implemented for {self.platform_name}"
        )

    async def get_post_url(self, post_id: str) -> str | None:
        """
        Get the public URL for a post.

        Args:
            post_id: Platform-specific post identifier

        Returns:
            Public URL string or None if not available
        """
        # Default implementation - override in platform-specific code
        return None

    # ---------------------------------------------------------------------
    # Utility Methods
    # ---------------------------------------------------------------------

    def validate_content(self, content: str, media_count: int = 0) -> tuple[bool, list[str]]:
        """
        Validate content against platform constraints.

        Args:
            content: Text content to validate
            media_count: Number of media attachments

        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        from .config import validate_content_for_platform

        return validate_content_for_platform(content, self.platform_name, media_count)

    def truncate_content(self, content: str, max_length: int | None = None) -> str:
        """
        Truncate content to fit within character limit.

        Args:
            content: Text content to truncate
            max_length: Maximum length (defaults to platform limit)

        Returns:
            Truncated content with ellipsis if needed
        """
        limit = max_length or self.capabilities.character_limit
        if len(content) <= limit:
            return content
        return content[: limit - 3] + "..."

    def get_rate_limit_status(self) -> dict[str, Any]:
        """
        Get current rate limit status.

        Returns:
            Dictionary with rate limit information
        """
        # Default implementation - override for platforms with API rate limit info
        return {
            "platform": self.platform_name,
            "limit_per_hour": self.capabilities.rate_limit_posts_per_hour,
            "limit_per_day": self.capabilities.rate_limit_posts_per_day,
            "remaining": None,  # Not tracked by default
            "reset_at": None,  # Not tracked by default
        }

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} authenticated={self._authenticated}>"
