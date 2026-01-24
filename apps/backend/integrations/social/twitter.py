"""
Twitter/X Platform Integration
==============================

Implementation of Twitter/X API v2 for posting, threads, and analytics.
"""

import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from .base import AuthenticationError, RateLimitError, SocialPlatform, SocialPlatformError
from .models import MediaAttachment, MediaAttachment as Media, SocialMetrics, SocialPostResult

logger = logging.getLogger(__name__)


class TwitterPlatform(SocialPlatform):
    """
    Twitter/X platform implementation using API v2.

    Supports:
    - Posting tweets (text, images, videos)
    - Thread posting
    - Analytics/metrics retrieval
    - Media upload
    """

    API_BASE = "https://api.twitter.com/2"
    UPLOAD_BASE = "https://upload.twitter.com/1.1"

    def __init__(self, config: dict[str, Any]) -> None:
        """
        Initialize Twitter platform.

        Required config keys:
        - bearer_token: OAuth 2.0 Bearer Token (for app context)
        - api_key: Consumer Key (OAuth 1.0a)
        - api_secret: Consumer Secret (OAuth 1.0a)
        - access_token: Access Token (OAuth 1.0a)
        - access_secret: Access Token Secret (OAuth 1.0a)
        """
        super().__init__(config)

        self.bearer_token = config.get("bearer_token")
        self.api_key = config.get("api_key")
        self.api_secret = config.get("api_secret")
        self.access_token = config.get("access_token")
        self.access_secret = config.get("access_secret")

        # HTTP client
        self.client = httpx.AsyncClient(
            headers={
                "Authorization": f"Bearer {self.bearer_token}",
            },
            timeout=30.0,
        )

    async def authenticate(self) -> bool:
        """
        Authenticate with Twitter API v2.

        Returns:
            True if authentication successful

        Raises:
            AuthenticationError: If credentials are invalid
        """
        try:
            # Verify credentials by making a test request
            response = await self.client.get(f"{self.API_BASE}/users/me")

            if response.status_code == 200:
                self._authenticated = True
                logger.info("Twitter authentication successful")
                return True
            elif response.status_code == 401:
                raise AuthenticationError(
                    "Invalid Twitter credentials", "twitter", error_code="invalid_credentials"
                )
            else:
                error_data = response.json()
                raise AuthenticationError(
                    f"Twitter auth failed: {error_data.get('detail', 'Unknown error')}",
                    "twitter",
                )

        except httpx.HTTPError as e:
            raise AuthenticationError(
                f"HTTP error during authentication: {e}", "twitter"
            )

    async def post_content(
        self,
        content: str,
        media: list[Media] | None = None,
        reply_to_id: str | None = None,
        **kwargs: Any,
    ) -> SocialPostResult:
        """
        Post a tweet.

        Args:
            content: Tweet text (max 280 chars for free tier, 25k for paid)
            media: Optional media attachments
            reply_to_id: Optional tweet ID to reply to
            **kwargs: Additional options (quote_tweet_id, etc.)

        Returns:
            SocialPostResult with tweet ID and URL
        """
        self.require_auth()

        # Validate content
        is_valid, errors = self.validate_content(content, len(media) if media else 0)
        if not is_valid:
            from .base import ContentValidationError

            raise ContentValidationError(
                f"Content validation failed: {', '.join(errors)}", "twitter"
            )

        try:
            # Upload media first if provided
            media_ids = []
            if media:
                media_ids = await self._upload_media(media)

            # Prepare tweet payload
            payload: dict[str, Any] = {"text": content}

            if media_ids:
                payload["media"] = {"media_ids": media_ids}

            if reply_to_id:
                payload["reply"] = {"in_reply_to_tweet_id": reply_to_id}

            # Quote tweet if specified
            if quote_tweet_id := kwargs.get("quote_tweet_id"):
                payload["quote_tweet_id"] = quote_tweet_id

            # Post tweet
            response = await self.client.post(
                f"{self.API_BASE}/tweets",
                json=payload,
            )

            # Handle rate limiting
            if response.status_code == 429:
                retry_after = int(response.headers.get("x-rate-limit-reset", 60))
                raise RateLimitError(
                    "Twitter rate limit exceeded", "twitter", retry_after=retry_after
                )

            response.raise_for_status()
            data = response.json()

            tweet_id = data.get("data", {}).get("id")
            tweet_url = f"https://twitter.com/i/status/{tweet_id}" if tweet_id else None

            return SocialPostResult(
                success=True,
                platform="twitter",
                post_id=tweet_id,
                post_url=tweet_url,
                raw_response=data,
            )

        except RateLimitError:
            raise
        except httpx.HTTPStatusError as e:
            error_detail = self._parse_error_response(e.response)
            return SocialPostResult(
                success=False,
                platform="twitter",
                error_message=error_detail,
                error_code=str(e.response.status_code),
                raw_response={"error": str(e)},
            )
        except Exception as e:
            return SocialPostResult(
                success=False,
                platform="twitter",
                error_message=str(e),
                raw_response={},
            )

    async def post_thread(
        self, tweets: list[str], **kwargs: Any
    ) -> list[SocialPostResult]:
        """
        Post a thread of connected tweets.

        Args:
            tweets: List of tweet texts (max 280 chars each)
            **kwargs: Additional options

        Returns:
            List of SocialPostResult for each tweet
        """
        self.require_auth()

        results = []
        previous_tweet_id = None

        for i, tweet_text in enumerate(tweets):
            try:
                if i == 0:
                    # First tweet in thread
                    result = await self.post_content(tweet_text, **kwargs)
                else:
                    # Subsequent tweets reply to previous
                    result = await self.post_content(
                        tweet_text, reply_to_id=previous_tweet_id, **kwargs
                    )

                results.append(result)

                if result.success and result.post_id:
                    previous_tweet_id = result.post_id
                else:
                    # Stop if a tweet fails
                    logger.error(f"Failed to post tweet {i+1} in thread")
                    break

            except Exception as e:
                logger.error(f"Error posting tweet {i+1} in thread: {e}")
                results.append(
                    SocialPostResult(
                        success=False,
                        platform="twitter",
                        error_message=str(e),
                    )
                )
                break

        return results

    async def get_analytics(self, post_id: str) -> SocialMetrics:
        """
        Retrieve tweet metrics/analytics.

        Args:
            post_id: Tweet ID

        Returns:
            SocialMetrics with tweet engagement data
        """
        self.require_auth()

        try:
            # Get tweet metrics using the fields endpoint
            response = await self.client.get(
                f"{self.API_BASE}/tweets/{post_id}",
                params={
                    "tweet.fields": "public_metrics,created_at",
                },
            )

            if response.status_code == 404:
                raise ValueError(f"Tweet {post_id} not found")

            response.raise_for_status()
            data = response.json()
            tweet_data = data.get("data", {})
            metrics_data = tweet_data.get("public_metrics", {})

            return SocialMetrics(
                post_id=post_id,
                platform="twitter",
                impressions=metrics_data.get("impression_count", 0),
                reach=metrics_data.get("impression_count", 0),  # Twitter doesn't provide reach
                engagements=metrics_data.get("engagement_count", 0),
                likes=metrics_data.get("like_count", 0),
                comments=metrics_data.get("reply_count", 0),
                shares=metrics_data.get("retweet_count", 0) + metrics_data.get("quote_count", 0),
                clicks=0,  # Not available in public metrics
                video_views=0,  # Requires expanded metrics
                metrics_fetched_at=datetime.now(timezone.utc),
                post_created_at=datetime.fromisoformat(
                    tweet_data.get("created_at").replace("Z", "+00:00")
                )
                if tweet_data.get("created_at")
                else None,
            )

        except httpx.HTTPStatusError as e:
            raise SocialPlatformError(
                f"Failed to fetch analytics: {e.response.text}", "twitter"
            )

    async def delete_post(self, post_id: str) -> bool:
        """
        Delete a tweet.

        Args:
            post_id: Tweet ID to delete

        Returns:
            True if successful
        """
        self.require_auth()

        try:
            response = await self.client.delete(f"{self.API_BASE}/tweets/{post_id}")
            response.raise_for_status()
            return True
        except httpx.HTTPStatusError as e:
            logger.error(f"Failed to delete tweet {post_id}: {e}")
            return False

    async def get_post_url(self, post_id: str) -> str | None:
        """Get the public URL for a tweet."""
        return f"https://twitter.com/i/status/{post_id}"

    async def _upload_media(self, media_list: list[Media]) -> list[str]:
        """
        Upload media to Twitter and return media IDs.

        Args:
            media_list: List of MediaAttachment objects

        Returns:
            List of media_id strings
        """
        media_ids = []

        for media in media_list[:4]:  # Twitter max 4 images
            try:
                # Download media
                async with httpx.AsyncClient() as client:
                    media_response = await client.get(str(media.url))
                    media_bytes = media_response.content

                # Initialize upload
                init_response = await self.client.post(
                    f"{self.UPLOAD_BASE}/media/upload.json",
                    data={
                        "command": "INIT",
                        "media_type": f"image/{media.media_type.value}",
                        "total_bytes": len(media_bytes),
                    },
                )

                init_data = init_response.json()
                media_id = init_data.get("media_id")

                if not media_id:
                    logger.error(f"Failed to initialize upload for {media.url}")
                    continue

                # Append media data (chunked for large files)
                await self.client.post(
                    f"{self.UPLOAD_BASE}/media/upload.json",
                    data={"command": "APPEND", "media_id": media_id, "media_data": media_bytes},
                )

                # Finalize upload
                await self.client.post(
                    f"{self.UPLOAD_BASE}/media/upload.json",
                    data={"command": "FINALIZE", "media_id": media_id},
                )

                media_ids.append(media_id)

            except Exception as e:
                logger.error(f"Failed to upload media {media.url}: {e}")

        return media_ids

    def _parse_error_response(self, response: httpx.Response) -> str:
        """Parse error response from Twitter API."""
        try:
            data = response.json()
            if "detail" in data:
                return data["detail"]
            if "errors" in data:
                return ", ".join(e.get("message", "Unknown error") for e in data["errors"])
        except Exception:
            pass
        return f"HTTP {response.status_code}: {response.text}"

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit - close HTTP client."""
        await self.client.aclose()
