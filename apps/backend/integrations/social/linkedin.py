"""
LinkedIn Platform Integration
=============================

Implementation of LinkedIn API for posting and analytics.
"""

import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from .base import AuthenticationError, SocialPlatform, SocialPlatformError
from .models import MediaAttachment, MediaAttachment as Media, SocialMetrics, SocialPostResult

logger = logging.getLogger(__name__)


class LinkedInPlatform(SocialPlatform):
    """
    LinkedIn platform implementation.

    Supports:
    - Personal profile posts
    - Organization page posts
    - Articles
    - Images and videos
    """

    API_BASE = "https://api.linkedin.com/v2"

    def __init__(self, config: dict[str, Any]) -> None:
        """
        Initialize LinkedIn platform.

        Required config keys:
        - access_token: OAuth 2.0 access token
        - person_urn: User's URN (optional, for personal posts)
        - organization_urn: Organization URN (optional, for company posts)
        """
        super().__init__(config)

        self.access_token = config.get("access_token")
        self.person_urn = config.get("person_urn")
        self.organization_urn = config.get("organization_urn")

        # HTTP client
        self.client = httpx.AsyncClient(
            headers={
                "Authorization": f"Bearer {self.access_token}",
                "X-Restli-Protocol-Version": "2.0.0",
            },
            timeout=30.0,
        )

    async def authenticate(self) -> bool:
        """
        Authenticate with LinkedIn API.

        Returns:
            True if authentication successful

        Raises:
            AuthenticationError: If credentials are invalid
        """
        try:
            # Verify credentials by fetching profile info
            response = await self.client.get(
                f"{self.API_BASE}/me",
                params={"projection": "(id,localizedFirstName,localizedLastName)"},
            )

            if response.status_code == 200:
                data = response.json()
                # Store person URN if not explicitly provided
                if not self.person_urn:
                    self.person_urn = f"urn:li:person:{data['id']}"
                self._authenticated = True
                logger.info("LinkedIn authentication successful")
                return True
            elif response.status_code == 401:
                raise AuthenticationError(
                    "Invalid LinkedIn credentials", "linkedin", error_code="invalid_token"
                )
            else:
                error_data = response.json()
                raise AuthenticationError(
                    f"LinkedIn auth failed: {error_data.get('message', 'Unknown error')}",
                    "linkedin",
                )

        except httpx.HTTPError as e:
            raise AuthenticationError(
                f"HTTP error during authentication: {e}", "linkedin"
            )

    async def post_content(
        self,
        content: str,
        media: list[Media] | None = None,
        owner: str | None = None,
        visibility: str = "PUBLIC",
        **kwargs: Any,
    ) -> SocialPostResult:
        """
        Post to LinkedIn (personal profile or organization).

        Args:
            content: Post text content
            media: Optional media attachments
            owner: Owner URN (defaults to person_urn or organization_urn)
            visibility: PUBLIC or CONNECTIONS (default: PUBLIC)
            **kwargs: Additional options

        Returns:
            SocialPostResult with post ID and URL
        """
        self.require_auth()

        # Determine owner
        if not owner:
            owner = self.organization_urn or self.person_urn
        if not owner:
            raise ValueError("No owner URN specified - set person_urn or organization_urn")

        # Validate content
        is_valid, errors = self.validate_content(content, len(media) if media else 0)
        if not is_valid:
            from .base import ContentValidationError

            raise ContentValidationError(
                f"Content validation failed: {', '.join(errors)}", "linkedin"
            )

        try:
            # Prepare post payload
            payload = {
                "author": owner,
                "lifecycleState": "PUBLISHED",
                "specificContent": {
                    "com.linkedin.ugc.ShareContent": {
                        "shareCommentary": {"text": content},
                        "shareMediaCategory": "NONE" if not media else "IMAGE",
                    }
                },
                "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": visibility},
            }

            # Add media if provided
            if media:
                media_attachments = []
                for item in media[:9]:  # LinkedIn max 9 images
                    # Upload media and get URN
                    media_urn = await self._upload_media(item, owner)
                    if media_urn:
                        media_attachments.append(
                            {
                                "status": "READY",
                                "description": {"text": item.alt_text or ""},
                                "media": media_urn,
                                "title": {"text": "Image"},
                            }
                        )

                if media_attachments:
                    payload["specificContent"]["com.linkedin.ugc.ShareContent"]["media"] = (
                        media_attachments
                    )
                    payload["specificContent"]["com.linkedin.ugc.ShareContent"][
                        "shareMediaCategory"
                    ] = "IMAGE"

            # Create post
            response = await self.client.post(
                f"{self.API_BASE}/ugcPosts",
                json=payload,
            )

            # Handle rate limiting
            if response.status_code == 429:
                raise self._parse_rate_limit_error(response)

            if response.status_code == 201:
                headers = response.headers
                post_id = headers.get("x-linkedin-id", "")

                # Construct post URL
                post_url = None
                if self.person_urn and owner == self.person_urn:
                    person_id = self.person_urn.split(":")[-1]
                    post_url = f"https://www.linkedin.com/feed/update/{post_id}/"
                elif self.organization_urn and owner == self.organization_urn:
                    org_id = self.organization_urn.split(":")[-1]
                    post_url = f"https://www.linkedin.com/company/{org_id}/posts/{post_id}/"

                return SocialPostResult(
                    success=True,
                    platform="linkedin",
                    post_id=post_id,
                    post_url=post_url,
                    raw_response={"id": post_id},
                )
            else:
                error_data = self._parse_error_response(response)
                return SocialPostResult(
                    success=False,
                    platform="linkedin",
                    error_message=error_data,
                    error_code=str(response.status_code),
                    raw_response={"error": response.text},
                )

        except Exception as e:
            logger.error(f"LinkedIn post error: {e}")
            return SocialPostResult(
                success=False,
                platform="linkedin",
                error_message=str(e),
                raw_response={},
            )

    async def get_analytics(self, post_id: str) -> SocialMetrics:
        """
        Retrieve post metrics/analytics.

        Args:
            post_id: LinkedIn post ID (UGC post ID)

        Returns:
            SocialMetrics with post engagement data
        """
        self.require_auth()

        try:
            # Get post statistics
            # Note: LinkedIn requires specific permissions for analytics
            response = await self.client.get(
                f"{self.API_BASE}/ugcPosts/{post_id}",
                params={
                    "projection": "(*,specificContent(*),sharedText(*),author(*),lifecycleState(*),visibility(*))",
                },
            )

            if response.status_code == 404:
                raise ValueError(f"Post {post_id} not found")

            response.raise_for_status()
            data = response.json()

            # LinkedIn's public API has limited metrics without additional permissions
            # This returns basic info - full metrics require Marketing Developer Program
            return SocialMetrics(
                post_id=post_id,
                platform="linkedin",
                impressions=0,  # Not available in basic API
                reach=0,  # Not available in basic API
                engagements=0,  # Not available in basic API
                likes=0,  # Not available in basic API
                comments=0,  # Not available in basic API
                shares=0,  # Not available in basic API
                clicks=0,
                video_views=0,
                saved_count=0,
                metrics_fetched_at=datetime.now(timezone.utc),
            )

        except httpx.HTTPStatusError as e:
            raise SocialPlatformError(
                f"Failed to fetch analytics: {e.response.text}", "linkedin"
            )

    async def get_post_url(self, post_id: str) -> str | None:
        """Get the public URL for a LinkedIn post."""
        # LinkedIn post URLs depend on whether it's personal or organizational
        # Return generic URL format
        return f"https://www.linkedin.com/feed/update/urn:li:activity:{post_id}/"

    async def _upload_media(self, media: Media, owner: str) -> str | None:
        """
        Upload media to LinkedIn and return media URN.

        Args:
            media: MediaAttachment object
            owner: Owner URN

        Returns:
            Media URN string or None if upload fails
        """
        try:
            # Download media
            async with httpx.AsyncClient() as client:
                media_response = await client.get(str(media.url))
                media_bytes = media_response.content

            # Register upload
            register_response = await self.client.post(
                f"{self.API_BASE}/assets?action=registerUpload",
                json={
                    "registerUploadRequest": {
                        "owner": owner,
                        "recipes": ["urn:li:digitalmediaAsset:generic"],
                        "serviceRelationships": [
                            {
                                "relationshipType": "OWNER",
                                "asset": "urn:li:digitalmediaAsset:image",
                            }
                        ],
                        "supportedUploadMechanism": ["SYNCHRONOUS_UPLOAD"],
                    }
                },
            )

            register_data = register_response.json()
            value = register_data.get("value", {})
            upload_url = value.get("uploadMechanism", {}).get(
                "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest", {}
            ).get("uploadUrl")

            if not upload_url:
                logger.error("Failed to get upload URL from LinkedIn")
                return None

            # Upload media binary
            upload_response = await self.client.post(
                upload_url,
                headers={"Authorization": f"Bearer {self.access_token}"},
                content=media_bytes,
            )

            if upload_response.status_code == 201:
                media_urn = value.get("asset")
                return media_urn
            else:
                logger.error(f"Media upload failed: {upload_response.status_code}")
                return None

        except Exception as e:
            logger.error(f"Failed to upload media: {e}")
            return None

    def _parse_error_response(self, response: httpx.Response) -> str:
        """Parse error response from LinkedIn API."""
        try:
            data = response.json()
            if "message" in data:
                return data["message"]
            if "error" in data:
                return data["error"].get("message", "Unknown error")
        except Exception:
            pass
        return f"HTTP {response.status_code}: {response.text}"

    def _parse_rate_limit_error(self, response: httpx.Response) -> Exception:
        """Parse rate limit error from LinkedIn API."""
        from .base import RateLimitError

        try:
            data = response.json()
            retry_after = int(response.headers.get("X-RestLi-Reset", 60))
            return RateLimitError(
                data.get("message", "LinkedIn rate limit exceeded"),
                "linkedin",
                retry_after=retry_after,
            )
        except Exception:
            return RateLimitError("LinkedIn rate limit exceeded", "linkedin")

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit - close HTTP client."""
        await self.client.aclose()
