"""
Instagram Platform Integration
==============================

Implementation of Instagram Graph API for posting stories, feed posts, and reels.
"""

import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from .base import AuthenticationError, SocialPlatform, SocialPlatformError
from .models import MediaAttachment, MediaAttachment as Media, SocialMetrics, SocialPostResult

logger = logging.getLogger(__name__)


class InstagramPlatform(SocialPlatform):
    """
    Instagram platform implementation using Facebook Graph API.

    Note: Instagram API requires a Facebook Page and Instagram Business Account.
    Posts must be created first then published.

    Supports:
    - Feed posts (images, videos, carousels)
    - Stories
    - Reels (requires video upload to Facebook first)
    """

    API_BASE = "https://graph.instagram.com"

    def __init__(self, config: dict[str, Any]) -> None:
        """
        Initialize Instagram platform.

        Required config keys:
        - access_token: Instagram Graph API access token
        - business_account_id: Instagram Business Account ID
        - facebook_page_id: Facebook Page ID (required for Instagram API)
        """
        super().__init__(config)

        self.access_token = config.get("access_token")
        self.business_account_id = config.get("business_account_id")
        self.facebook_page_id = config.get("facebook_page_id")

        # HTTP client
        self.client = httpx.AsyncClient(
            params={"access_token": self.access_token},
            timeout=30.0,
        )

    async def authenticate(self) -> bool:
        """
        Authenticate with Instagram Graph API.

        Returns:
            True if authentication successful

        Raises:
            AuthenticationError: If credentials are invalid
        """
        try:
            # Verify credentials by fetching user info
            response = await self.client.get(
                f"{self.API_BASE}/me",
                params={"fields": "id,username,account_type"},
            )

            if response.status_code == 200:
                self._authenticated = True
                logger.info("Instagram authentication successful")
                return True
            elif response.status_code == 401:
                raise AuthenticationError(
                    "Invalid Instagram credentials", "instagram", error_code="invalid_token"
                )
            else:
                error_data = response.json()
                raise AuthenticationError(
                    f"Instagram auth failed: {error_data.get('error', {}).get('message', 'Unknown error')}",
                    "instagram",
                )

        except httpx.HTTPError as e:
            raise AuthenticationError(
                f"HTTP error during authentication: {e}", "instagram"
            )

    async def post_content(
        self,
        content: str,
        media: list[Media] | None = None,
        post_type: str = "FEED",
        **kwargs: Any,
    ) -> SocialPostResult:
        """
        Post to Instagram.

        Args:
            content: Caption for the post
            media: Required media attachments (at least one for Instagram)
            post_type: Type of post - FEED, STORY, or REEL
            **kwargs: Additional options

        Returns:
            SocialPostResult with post ID and URL

        Note: Instagram requires a media container to be created first,
        then published. This method handles both steps.
        """
        self.require_auth()

        # Instagram requires at least one image
        if not media:
            from .base import ContentValidationError

            raise ContentValidationError(
                "Instagram posts require at least one image", "instagram"
            )

        # Validate content
        is_valid, errors = self.validate_content(content, len(media))
        if not is_valid:
            from .base import ContentValidationError

            raise ContentValidationError(
                f"Content validation failed: {', '.join(errors)}", "instagram"
            )

        try:
            if post_type == "STORY":
                return await self._post_story(content, media, **kwargs)
            elif post_type == "REEL":
                return await self._post_reel(content, media, **kwargs)
            else:  # FEED
                return await self._post_feed(content, media, **kwargs)

        except Exception as e:
            logger.error(f"Instagram post error: {e}")
            return SocialPostResult(
                success=False,
                platform="instagram",
                error_message=str(e),
                raw_response={},
            )

    async def _post_feed(
        self, caption: str, media: list[Media], **kwargs: Any
    ) -> SocialPostResult:
        """Post to Instagram feed."""
        if len(media) == 1:
            # Single image/video post
            container_id = await self._create_media_container(
                media[0], caption, media_type="IMAGE" if media[0].media_type.value != "video" else "VIDEO"
            )
        else:
            # Carousel post (max 10 items)
            container_id = await self._create_carousel_container(media, caption)

        if not container_id:
            return SocialPostResult(
                success=False,
                platform="instagram",
                error_message="Failed to create media container",
                raw_response={},
            )

        # Publish the container
        return await self._publish_container(container_id)

    async def _post_story(
        self, caption: str, media: list[Media], **kwargs: Any
    ) -> SocialPostResult:
        """Post to Instagram story."""
        if not media:
            return SocialPostResult(
                success=False,
                platform="instagram",
                error_message="Stories require media",
                raw_response={},
            )

        container_id = await self._create_media_container(
            media[0], caption, media_type="IMAGE", is_story=True
        )

        if not container_id:
            return SocialPostResult(
                success=False,
                platform="instagram",
                error_message="Failed to create story container",
                raw_response={},
            )

        return await self._publish_container(container_id)

    async def _post_reel(
        self, caption: str, media: list[Media], **kwargs: Any
    ) -> SocialPostResult:
        """Post an Instagram reel."""
        # Reels require video media
        if not media or media[0].media_type.value != "video":
            return SocialPostResult(
                success=False,
                platform="instagram",
                error_message="Reels require video media",
                raw_response={},
            )

        container_id = await self._create_media_container(
            media[0], caption, media_type="REELS"
        )

        if not container_id:
            return SocialPostResult(
                success=False,
                platform="instagram",
                error_message="Failed to create reel container",
                raw_response={},
            )

        return await self._publish_container(container_id)

    async def _create_media_container(
        self, media: Media, caption: str, media_type: str = "IMAGE", is_story: bool = False
    ) -> str | None:
        """Create a media container for Instagram."""
        try:
            # Download media
            async with httpx.AsyncClient() as client:
                media_response = await client.get(str(media.url))
                media_bytes = media_response.content

            # Upload media to get media URL
            # Note: This requires using Facebook's upload endpoint
            upload_url = await self._upload_media_to_facebook(media_bytes)

            if not upload_url:
                return None

            # Create container
            params = {
                "image_url": upload_url,
                "caption": caption,
            }

            if is_story:
                params["media_type"] = media_type

            response = await self.client.post(
                f"{self.API_BASE}/{self.business_account_id}/media",
                params=params,
            )

            if response.status_code == 200:
                data = response.json()
                return data.get("id")
            else:
                logger.error(f"Failed to create container: {response.text}")
                return None

        except Exception as e:
            logger.error(f"Error creating media container: {e}")
            return None

    async def _create_carousel_container(
        self, media: list[Media], caption: str
    ) -> str | None:
        """Create a carousel container with multiple media items."""
        try:
            # First, create individual media containers
            children_ids = []

            for item in media[:10]:  # Max 10 items in carousel
                async with httpx.AsyncClient() as client:
                    media_response = await client.get(str(item.url))
                    media_bytes = media_response.content

                upload_url = await self._upload_media_to_facebook(media_bytes)
                if not upload_url:
                    continue

                # Create child container
                response = await self.client.post(
                    f"{self.API_BASE}/{self.business_account_id}/media",
                    params={
                        "image_url": upload_url,
                        "is_carousel_item": True,
                    },
                )

                if response.status_code == 200:
                    data = response.json()
                    children_ids.append(data.get("id"))

            if not children_ids:
                return None

            # Create carousel container with children
            response = await self.client.post(
                f"{self.API_BASE}/{self.business_account_id}/media",
                params={
                    "media_type": "CAROUSEL",
                    "children": ",".join(children_ids),
                    "caption": caption,
                },
            )

            if response.status_code == 200:
                data = response.json()
                return data.get("id")
            else:
                logger.error(f"Failed to create carousel: {response.text}")
                return None

        except Exception as e:
            logger.error(f"Error creating carousel: {e}")
            return None

    async def _upload_media_to_facebook(self, media_bytes: bytes) -> str | None:
        """Upload media to Facebook and return the URL."""
        try:
            # Facebook Graph API for media upload
            fb_api = "https://graph.facebook.com/v18.0"

            # Upload to Facebook page first
            response = await self.client.post(
                f"{fb_api}/{self.facebook_page_id}/assets",
                params={
                    "access_token": self.access_token,
                    "upload_type": "resumable",
                },
            )

            if response.status_code != 200:
                logger.error(f"Failed to initialize upload: {response.text}")
                return None

            upload_data = response.json()
            upload_url = upload_data.get("upload_url")

            if not upload_url:
                return None

            # Upload media binary
            upload_response = await httpx.AsyncClient().post(
                upload_url,
                headers={"Content-Type": "application/octet-stream"},
                content=media_bytes,
            )

            if upload_response.status_code in (200, 201):
                # Get the media URL
                result_url = upload_response.headers.get("Location")
                if result_url:
                    # Fetch to get the actual URL
                    final_response = await httpx.AsyncClient().get(result_url)
                    if final_response.status_code == 200:
                        return final_response.json().get("url")

            return None

        except Exception as e:
            logger.error(f"Failed to upload media to Facebook: {e}")
            return None

    async def _publish_container(self, container_id: str) -> SocialPostResult:
        """Publish a media container to Instagram."""
        try:
            response = await self.client.post(
                f"{self.API_BASE}/{self.business_account_id}/media_publish",
                params={
                    "creation_id": container_id,
                },
            )

            if response.status_code == 200:
                data = response.json()
                post_id = data.get("id")

                # Instagram posts are at instagram.com/p/{shortcode}/
                # Need to fetch shortcode to construct URL
                post_url = await self._get_post_url(post_id) if post_id else None

                return SocialPostResult(
                    success=True,
                    platform="instagram",
                    post_id=post_id,
                    post_url=post_url,
                    raw_response=data,
                )
            else:
                error_data = response.json()
                return SocialPostResult(
                    success=False,
                    platform="instagram",
                    error_message=error_data.get("error", {}).get("message", "Unknown error"),
                    error_code=str(response.status_code),
                    raw_response=error_data,
                )

        except Exception as e:
            return SocialPostResult(
                success=False,
                platform="instagram",
                error_message=str(e),
                raw_response={},
            )

    async def get_analytics(self, post_id: str) -> SocialMetrics:
        """
        Retrieve post metrics/analytics.

        Args:
            post_id: Instagram post ID

        Returns:
            SocialMetrics with post engagement data
        """
        self.require_auth()

        try:
            # Get post insights
            response = await self.client.get(
                f"{self.API_BASE}/{post_id}/insights",
                params={
                    "metric": "engagement,impressions,reach,likes,comments,shares,saved",
                },
            )

            if response.status_code == 404:
                raise ValueError(f"Post {post_id} not found")

            response.raise_for_status()
            data = response.json()

            metrics_data = {item["name"]: item["values"][0]["value"] for item in data.get("data", [])}

            return SocialMetrics(
                post_id=post_id,
                platform="instagram",
                impressions=metrics_data.get("impressions", 0),
                reach=metrics_data.get("reach", 0),
                engagements=metrics_data.get("engagement", 0),
                likes=metrics_data.get("likes", 0),
                comments=metrics_data.get("comments", 0),
                shares=metrics_data.get("shares", 0),
                clicks=0,  # Not available in Instagram insights
                video_views=0,  # Requires additional metrics
                saved_count=metrics_data.get("saved", 0),
                metrics_fetched_at=datetime.now(timezone.utc),
            )

        except httpx.HTTPStatusError as e:
            raise SocialPlatformError(
                f"Failed to fetch analytics: {e.response.text}", "instagram"
            )

    async def _get_post_url(self, post_id: str) -> str | None:
        """Get the public URL for an Instagram post."""
        try:
            # Get media data to find permalink
            response = await self.client.get(
                f"{self.API_BASE}/{post_id}",
                params={"fields": "permalink,shortcode"},
            )

            if response.status_code == 200:
                data = response.json()
                return data.get("permalink") or f"https://www.instagram.com/p/{data.get('shortcode', '')}/"
        except Exception as e:
            logger.error(f"Failed to get post URL: {e}")

        return None

    async def get_post_url(self, post_id: str) -> str | None:
        """Get the public URL for a post."""
        return await self._get_post_url(post_id)

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit - close HTTP client."""
        await self.client.aclose()
