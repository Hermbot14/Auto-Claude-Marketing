"""
Facebook Platform Integration
==============================

Implementation of Facebook Graph API for posting, scheduling, and analytics.
"""

import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from .base import AuthenticationError, SocialPlatform, SocialPlatformError
from .models import MediaAttachment, MediaAttachment as Media, SocialMetrics, SocialPostResult

logger = logging.getLogger(__name__)


class FacebookPlatform(SocialPlatform):
    """
    Facebook platform implementation using Graph API.

    Supports:
    - Page posts (text, images, videos)
    - Stories
    - Post scheduling
    - Analytics/insights
    """

    API_BASE = "https://graph.facebook.com/v18.0"

    def __init__(self, config: dict[str, Any]) -> None:
        """
        Initialize Facebook platform.

        Required config keys:
        - access_token: Page access token
        - page_id: Facebook Page ID
        - app_id: Facebook App ID (optional)
        - app_secret: Facebook App Secret (optional)
        """
        super().__init__(config)

        self.access_token = config.get("page_access_token") or config.get("access_token")
        self.page_id = config.get("page_id")
        self.app_id = config.get("app_id")
        self.app_secret = config.get("app_secret")

        # HTTP client
        self.client = httpx.AsyncClient(
            params={"access_token": self.access_token},
            timeout=30.0,
        )

    async def authenticate(self) -> bool:
        """
        Authenticate with Facebook Graph API.

        Returns:
            True if authentication successful

        Raises:
            AuthenticationError: If credentials are invalid
        """
        try:
            # Verify credentials by fetching page info
            response = await self.client.get(
                f"{self.API_BASE}/{self.page_id}",
                params={"fields": "id,name,category"},
            )

            if response.status_code == 200:
                self._authenticated = True
                logger.info("Facebook authentication successful")
                return True
            elif response.status_code == 401:
                raise AuthenticationError(
                    "Invalid Facebook credentials", "facebook", error_code="invalid_token"
                )
            else:
                error_data = response.json()
                error = error_data.get("error", {})
                raise AuthenticationError(
                    f"Facebook auth failed: {error.get('message', 'Unknown error')}",
                    "facebook",
                    error_code=error.get("code"),
                )

        except httpx.HTTPError as e:
            raise AuthenticationError(
                f"HTTP error during authentication: {e}", "facebook"
            )

    async def post_content(
        self,
        content: str,
        media: list[Media] | None = None,
        post_type: str = "feed",
        **kwargs: Any,
    ) -> SocialPostResult:
        """
        Post to Facebook page.

        Args:
            content: Post text content
            media: Optional media attachments
            post_type: Type of post - feed, story, or photo
            **kwargs: Additional options (link, scheduled_publish_time, etc.)

        Returns:
            SocialPostResult with post ID and URL
        """
        self.require_auth()

        # Validate content
        is_valid, errors = self.validate_content(content, len(media) if media else 0)
        if not is_valid:
            from .base import ContentValidationError

            raise ContentValidationError(
                f"Content validation failed: {', '.join(errors)}", "facebook"
            )

        try:
            if post_type == "story":
                return await self._post_story(content, media, **kwargs)
            elif media:
                return await self._post_with_media(content, media, **kwargs)
            else:
                return await self._post_text_only(content, **kwargs)

        except Exception as e:
            logger.error(f"Facebook post error: {e}")
            return SocialPostResult(
                success=False,
                platform="facebook",
                error_message=str(e),
                raw_response={},
            )

    async def _post_text_only(self, content: str, **kwargs: Any) -> SocialPostResult:
        """Post text-only content to Facebook."""
        try:
            payload = {"message": content}

            # Add link if provided
            if link := kwargs.get("link"):
                payload["link"] = link

            response = await self.client.post(
                f"{self.API_BASE}/{self.page_id}/feed",
                data=payload,
            )

            return self._handle_post_response(response)

        except Exception as e:
            return SocialPostResult(
                success=False,
                platform="facebook",
                error_message=str(e),
                raw_response={},
            )

    async def _post_with_media(
        self, content: str, media: list[Media], **kwargs: Any
    ) -> SocialPostResult:
        """Post content with media to Facebook."""
        try:
            # Handle single media vs multiple
            if len(media) == 1:
                return await self._post_single_media(content, media[0], **kwargs)
            else:
                return await self._post_multiple_media(content, media, **kwargs)

        except Exception as e:
            return SocialPostResult(
                success=False,
                platform="facebook",
                error_message=str(e),
                raw_response={},
            )

    async def _post_single_media(
        self, content: str, media: Media, **kwargs: Any
    ) -> SocialPostResult:
        """Post a single photo or video."""
        try:
            # Download media
            async with httpx.AsyncClient() as client:
                media_response = await client.get(str(media.url))
                media_bytes = media_response.content

            # Determine endpoint
            if media.media_type.value == "video":
                endpoint = f"{self.API_BASE}/{self.page_id}/videos"
                data = {"description": content}
                files = {"source": ("video.mp4", media_bytes, "video/mp4")}
            else:
                endpoint = f"{self.API_BASE}/{self.page_id}/photos"
                data = {"caption": content}
                files = {"source": ("photo.jpg", media_bytes, "image/jpeg")}

            response = await self.client.post(
                endpoint,
                data=data,
                files=files,
            )

            return self._handle_post_response(response)

        except Exception as e:
            return SocialPostResult(
                success=False,
                platform="facebook",
                error_message=str(e),
                raw_response={},
            )

    async def _post_multiple_media(
        self, content: str, media: list[Media], **kwargs: Any
    ) -> SocialPostResult:
        """Post multiple photos as a gallery."""
        try:
            # First, upload all photos
            attached_media = []

            for item in media[:10]:  # Max 10 photos
                async with httpx.AsyncClient() as client:
                    media_response = await client.get(str(item.url))
                    media_bytes = media_response.content

                # Upload photo
                upload_response = await self.client.post(
                    f"{self.API_BASE}/{self.page_id}/photos",
                    data={"published": False, "temp": True},
                    files={"source": ("photo.jpg", media_bytes, "image/jpeg")},
                )

                if upload_response.status_code == 200:
                    upload_data = upload_response.json()
                    media_id = upload_data.get("id")
                    if media_id:
                        attached_media.append({"media_fbid": media_id})

            if not attached_media:
                return SocialPostResult(
                    success=False,
                    platform="facebook",
                    error_message="Failed to upload any media",
                    raw_response={},
                )

            # Create post with uploaded media
            response = await self.client.post(
                f"{self.API_BASE}/{self.page_id}/feed",
                data={
                    "message": content,
                    "attached_media": str(attached_media),
                    "formatting": "MARKDOWN",
                },
            )

            return self._handle_post_response(response)

        except Exception as e:
            return SocialPostResult(
                success=False,
                platform="facebook",
                error_message=str(e),
                raw_response={},
            )

    async def _post_story(
        self, content: str, media: list[Media] | None = None, **kwargs: Any
    ) -> SocialPostResult:
        """Post to Facebook story."""
        try:
            if not media:
                return SocialPostResult(
                    success=False,
                    platform="facebook",
                    error_message="Stories require media",
                    raw_response={},
                )

            # Download media
            async with httpx.AsyncClient() as client:
                media_response = await client.get(str(media[0].url))
                media_bytes = media_response.content

            # Post as story
            endpoint = f"{self.API_BASE}/{self.page_id}/stories"

            if media[0].media_type.value == "video":
                data = {}
                files = {"source": ("video.mp4", media_bytes, "video/mp4")}
            else:
                data = {}
                files = {"source": ("photo.jpg", media_bytes, "image/jpeg")}

            response = await self.client.post(
                endpoint,
                data=data,
                files=files,
            )

            return self._handle_post_response(response)

        except Exception as e:
            return SocialPostResult(
                success=False,
                platform="facebook",
                error_message=str(e),
                raw_response={},
            )

    async def schedule_post(
        self,
        content: str,
        scheduled_time: datetime,
        media: list[Media] | None = None,
        **kwargs: Any,
    ) -> SocialPostResult:
        """
        Schedule a post for future publication.

        Args:
            content: Text content
            scheduled_time: When to publish (Unix timestamp)
            media: Optional media
            **kwargs: Additional options

        Returns:
            SocialPostResult with scheduled post info
        """
        self.require_auth()

        # Convert datetime to Unix timestamp
        timestamp = int(scheduled_time.timestamp())

        try:
            if media:
                # For media posts, we need to create unpublished first
                result = await self.post_content(
                    content,
                    media,
                    published=False,
                    scheduled_publish_time=timestamp,
                    **kwargs,
                )
            else:
                # Text-only scheduled post
                response = await self.client.post(
                    f"{self.API_BASE}/{self.page_id}/feed",
                    data={
                        "message": content,
                        "published": False,
                        "scheduled_publish_time": timestamp,
                    },
                )

                result = self._handle_post_response(response)

            if result.success:
                result.scheduled_for = scheduled_time

            return result

        except Exception as e:
            return SocialPostResult(
                success=False,
                platform="facebook",
                error_message=str(e),
                raw_response={},
            )

    async def get_analytics(self, post_id: str) -> SocialMetrics:
        """
        Retrieve post metrics/analytics.

        Args:
            post_id: Facebook post ID

        Returns:
            SocialMetrics with post engagement data
        """
        self.require_auth()

        try:
            # Get post insights
            response = await self.client.get(
                f"{self.API_BASE}/{post_id}/insights",
                params={
                    "metric": "post_impressions,post_reach,post_engaged_users,post_reactions_like_total,post_comments,post_shares",
                },
            )

            if response.status_code == 404:
                raise ValueError(f"Post {post_id} not found")

            response.raise_for_status()
            data = response.json()

            metrics_data = {item["name"]: item["values"][0]["value"] for item in data.get("data", [])}

            # Get post created time
            post_response = await self.client.get(
                f"{self.API_BASE}/{post_id}",
                params={"fields": "created_time"},
            )
            post_data = post_response.json()
            created_at = None
            if post_data.get("created_time"):
                created_at = datetime.fromisoformat(
                    post_data["created_time"].replace("Z", "+00:00")
                )

            return SocialMetrics(
                post_id=post_id,
                platform="facebook",
                impressions=metrics_data.get("post_impressions", 0),
                reach=metrics_data.get("post_reach", 0),
                engagements=metrics_data.get("post_engaged_users", 0),
                likes=metrics_data.get("post_reactions_like_total", 0),
                comments=metrics_data.get("post_comments", 0),
                shares=metrics_data.get("post_shares", 0),
                clicks=0,  # Not available in basic insights
                video_views=0,  # Requires video-specific metrics
                saved_count=0,  # Not directly available
                metrics_fetched_at=datetime.now(timezone.utc),
                post_created_at=created_at,
            )

        except httpx.HTTPStatusError as e:
            raise SocialPlatformError(
                f"Failed to fetch analytics: {e.response.text}", "facebook"
            )

    async def delete_post(self, post_id: str) -> bool:
        """
        Delete a post.

        Args:
            post_id: Post ID to delete

        Returns:
            True if successful
        """
        self.require_auth()

        try:
            response = await self.client.delete(f"{self.API_BASE}/{post_id}")
            response.raise_for_status()
            return True
        except httpx.HTTPStatusError as e:
            logger.error(f"Failed to delete post {post_id}: {e}")
            return False

    async def get_post_url(self, post_id: str) -> str | None:
        """Get the public URL for a Facebook post."""
        return f"https://www.facebook.com/{self.page_id}/posts/{post_id}/"

    def _handle_post_response(self, response: httpx.Response) -> SocialPostResult:
        """Handle Facebook API response for posting."""
        if response.status_code == 200:
            data = response.json()
            post_id = data.get("id")

            # Construct post URL
            post_url = f"https://www.facebook.com/{self.page_id}/posts/{post_id.split('_')[-1]}/"

            return SocialPostResult(
                success=True,
                platform="facebook",
                post_id=post_id,
                post_url=post_url,
                raw_response=data,
            )
        else:
            error_data = response.json()
            error = error_data.get("error", {})
            return SocialPostResult(
                success=False,
                platform="facebook",
                error_message=error.get("message", "Unknown error"),
                error_code=str(error.get("code", response.status_code)),
                raw_response=error_data,
            )

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit - close HTTP client."""
        await self.client.aclose()
