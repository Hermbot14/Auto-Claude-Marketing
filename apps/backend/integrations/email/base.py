"""
Email Provider Base Class and Interface
========================================

Abstract base class defining the interface for all email service providers.
Ensures consistent API across different email platforms.

Providers must implement:
- get_lists(): Retrieve all email lists/audiences
- get_list_details(list_id): Get detailed information about a specific list
- create_campaign(): Create a new email campaign
- send_campaign(): Send a campaign to subscribers
- get_analytics(): Retrieve campaign analytics
- add_subscriber(): Add a subscriber to a list
- remove_subscriber(): Remove a subscriber from a list
- get_subscribers(): Get subscribers from a list
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

import httpx

logger = logging.getLogger(__name__)


@dataclass
class EmailList:
    """Email list/audience data model."""

    id: str
    name: str
    subscriber_count: int = 0
    description: str = ""
    created_at: datetime | None = None
    provider: str = ""
    raw_data: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "name": self.name,
            "subscriber_count": self.subscriber_count,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "provider": self.provider,
        }


@dataclass
class EmailCampaign:
    """Email campaign data model."""

    id: str
    name: str
    subject: str
    list_id: str
    status: str = "draft"  # draft, scheduled, sending, sent
    from_name: str = ""
    from_email: str = ""
    reply_to: str = ""
    html_content: str = ""
    plain_text: str = ""
    subscriber_count: int = 0
    opens: int = 0
    clicks: int = 0
    bounces: int = 0
    unsubscribes: int = 0
    sent_at: datetime | None = None
    created_at: datetime | None = None
    provider: str = ""
    raw_data: dict = field(default_factory=dict)

    @property
    def open_rate(self) -> float:
        """Calculate open rate as percentage."""
        if self.subscriber_count == 0:
            return 0.0
        return round((self.opens / self.subscriber_count) * 100, 2)

    @property
    def click_rate(self) -> float:
        """Calculate click rate as percentage."""
        if self.opens == 0:
            return 0.0
        return round((self.clicks / self.opens) * 100, 2)

    @property
    def bounce_rate(self) -> float:
        """Calculate bounce rate as percentage."""
        if self.subscriber_count == 0:
            return 0.0
        return round((self.bounces / self.subscriber_count) * 100, 2)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "name": self.name,
            "subject": self.subject,
            "list_id": self.list_id,
            "status": self.status,
            "from_name": self.from_name,
            "from_email": self.from_email,
            "reply_to": self.reply_to,
            "subscriber_count": self.subscriber_count,
            "opens": self.opens,
            "clicks": self.clicks,
            "bounces": self.bounces,
            "unsubscribes": self.unsubscribes,
            "open_rate": self.open_rate,
            "click_rate": self.click_rate,
            "bounce_rate": self.bounce_rate,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "provider": self.provider,
        }


@dataclass
class EmailSubscriber:
    """Email subscriber data model."""

    email: str
    first_name: str = ""
    last_name: str = ""
    status: str = "subscribed"  # subscribed, unsubscribed, bounced, pending
    list_id: str = ""
    provider: str = ""
    subscribed_at: datetime | None = None
    raw_data: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "email": self.email,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "status": self.status,
            "list_id": self.list_id,
            "provider": self.provider,
            "subscribed_at": (
                self.subscribed_at.isoformat() if self.subscribed_at else None
            ),
        }


@dataclass
class CampaignAnalytics:
    """Campaign analytics data model."""

    campaign_id: str
    total_sent: int = 0
    total_opens: int = 0
    unique_opens: int = 0
    total_clicks: int = 0
    unique_clicks: int = 0
    bounces: int = 0
    hard_bounces: int = 0
    soft_bounces: int = 0
    unsubscribes: int = 0
    complaints: int = 0
    forwards: int = 0

    # Rates
    open_rate: float = 0.0
    click_rate: float = 0.0
    bounce_rate: float = 0.0
    unsubscribe_rate: float = 0.0

    # Engagement timing
    avg_time_to_open: float = 0.0  # in hours
    avg_time_to_click: float = 0.0  # in hours

    # Device/browser stats (if available)
    device_stats: dict = field(default_factory=dict)

    # Link tracking (if available)
    link_stats: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "campaign_id": self.campaign_id,
            "total_sent": self.total_sent,
            "total_opens": self.total_opens,
            "unique_opens": self.unique_opens,
            "total_clicks": self.total_clicks,
            "unique_clicks": self.unique_clicks,
            "bounces": self.bounces,
            "hard_bounces": self.hard_bounces,
            "soft_bounces": self.soft_bounces,
            "unsubscribes": self.unsubscribes,
            "complaints": self.complaints,
            "forwards": self.forwards,
            "open_rate": self.open_rate,
            "click_rate": self.click_rate,
            "bounce_rate": self.bounce_rate,
            "unsubscribe_rate": self.unsubscribe_rate,
            "avg_time_to_open": self.avg_time_to_open,
            "avg_time_to_click": self.avg_time_to_click,
            "device_stats": self.device_stats,
            "link_stats": self.link_stats,
        }


class EmailProviderError(Exception):
    """Base exception for email provider errors."""

    def __init__(self, message: str, provider: str = "", details: dict | None = None):
        self.message = message
        self.provider = provider
        self.details = details or {}
        super().__init__(self.message)


class EmailProviderAuthError(EmailProviderError):
    """Raised when authentication fails."""

    pass


class EmailProviderRateLimitError(EmailProviderError):
    """Raised when rate limit is exceeded."""

    def __init__(
        self,
        message: str,
        provider: str = "",
        retry_after: int | None = None,
        details: dict | None = None,
    ):
        super().__init__(message, provider, details)
        self.retry_after = retry_after


class EmailProvider(ABC):
    """
    Abstract base class for email service providers.

    All email providers must implement this interface to ensure
    consistent behavior across different platforms.

    Attributes:
        api_key: API key for authentication
        timeout: Request timeout in seconds
        base_url: Base URL for API endpoints
    """

    def __init__(
        self,
        api_key: str,
        timeout: int = 30,
        base_url: str = "",
    ):
        """
        Initialize email provider.

        Args:
            api_key: API key for authentication
            timeout: Request timeout in seconds (default: 30)
            base_url: Base URL for API endpoints
        """
        self.api_key = api_key
        self.timeout = timeout
        self.base_url = base_url

        # HTTP client with connection pooling
        self._client = httpx.AsyncClient(
            timeout=timeout,
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
            headers=self._get_default_headers(),
        )

    def _get_default_headers(self) -> dict[str, str]:
        """Get default HTTP headers for requests."""
        return {
            "User-Agent": "Auto-Claude-Marketing/1.0",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit - close HTTP client."""
        await self._client.aclose()

    async def close(self):
        """Close the HTTP client."""
        await self._client.aclose()

    @abstractmethod
    async def get_lists(self) -> list[EmailList]:
        """
        Get all email lists/audiences.

        Returns:
            List of EmailList objects

        Raises:
            EmailProviderError: If request fails
        """
        pass

    @abstractmethod
    async def get_list_details(self, list_id: str) -> EmailList:
        """
        Get detailed information about a specific list.

        Args:
            list_id: List ID to retrieve

        Returns:
            EmailList object with full details

        Raises:
            EmailProviderError: If request fails
            EmailProviderAuthError: If authentication fails
        """
        pass

    @abstractmethod
    async def create_campaign(
        self,
        list_id: str,
        subject: str,
        html_content: str,
        plain_text: str = "",
        from_name: str = "",
        from_email: str = "",
        reply_to: str = "",
        campaign_name: str = "",
    ) -> EmailCampaign:
        """
        Create a new email campaign.

        Args:
            list_id: Target list/audience ID
            subject: Email subject line
            html_content: HTML email content
            plain_text: Plain text fallback (optional)
            from_name: Sender name (optional)
            from_email: Sender email (optional)
            reply_to: Reply-to email (optional)
            campaign_name: Internal campaign name (optional)

        Returns:
            Created EmailCampaign object

        Raises:
            EmailProviderError: If request fails
        """
        pass

    @abstractmethod
    async def send_campaign(
        self,
        campaign_id: str,
        schedule_time: datetime | None = None,
    ) -> bool:
        """
        Send a campaign to subscribers.

        Args:
            campaign_id: Campaign ID to send
            schedule_time: Optional schedule time (None = send immediately)

        Returns:
            True if successful

        Raises:
            EmailProviderError: If request fails
        """
        pass

    @abstractmethod
    async def get_analytics(self, campaign_id: str) -> CampaignAnalytics:
        """
        Get campaign analytics and statistics.

        Args:
            campaign_id: Campaign ID to analyze

        Returns:
            CampaignAnalytics object with stats

        Raises:
            EmailProviderError: If request fails
        """
        pass

    @abstractmethod
    async def add_subscriber(
        self,
        list_id: str,
        email: str,
        first_name: str = "",
        last_name: str = "",
        fields: dict | None = None,
        double_optin: bool = True,
    ) -> EmailSubscriber:
        """
        Add a subscriber to a list.

        Args:
            list_id: Target list ID
            email: Subscriber email address
            first_name: First name (optional)
            last_name: Last name (optional)
            fields: Additional custom fields (optional)
            double_optin: Require double opt-in confirmation (default: True)

        Returns:
            Created EmailSubscriber object

        Raises:
            EmailProviderError: If request fails
        """
        pass

    @abstractmethod
    async def remove_subscriber(self, list_id: str, email: str) -> bool:
        """
        Remove/unsubscribe a subscriber from a list.

        Args:
            list_id: List ID
            email: Subscriber email address

        Returns:
            True if successful

        Raises:
            EmailProviderError: If request fails
        """
        pass

    @abstractmethod
    async def get_subscribers(
        self,
        list_id: str,
        status: str = "subscribed",
        limit: int = 100,
        offset: int = 0,
    ) -> list[EmailSubscriber]:
        """
        Get subscribers from a list.

        Args:
            list_id: List ID
            status: Filter by status (subscribed, unsubscribed, bounced, etc.)
            limit: Maximum number of results
            offset: Pagination offset

        Returns:
            List of EmailSubscriber objects

        Raises:
            EmailProviderError: If request fails
        """
        pass

    async def test_connection(self) -> bool:
        """
        Test the API connection.

        Returns:
            True if connection is successful

        Raises:
            EmailProviderError: If connection fails
        """
        try:
            lists = await self.get_lists()
            return isinstance(lists, list)
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return False


def get_email_provider(
    provider_name: str,
    api_key: str,
    **kwargs,
) -> EmailProvider:
    """
    Factory function to create email provider instances.

    Args:
        provider_name: Name of provider (mailchimp, sendgrid, convertkit)
        api_key: API key for authentication
        **kwargs: Provider-specific configuration

    Returns:
        EmailProvider instance

    Raises:
        ValueError: If provider name is unknown

    Examples:
        # Mailchimp
        provider = get_email_provider(
            "mailchimp",
            api_key="...",
            audience_id="..."
        )

        # SendGrid
        provider = get_email_provider(
            "sendgrid",
            api_key="..."
        )

        # ConvertKit
        provider = get_email_provider(
            "convertkit",
            api_key="...",
            api_secret="..."
        )
    """
    from . import PROVIDER_REGISTRY

    provider_class = PROVIDER_REGISTRY.get(provider_name.lower())
    if not provider_class:
        raise ValueError(
            f"Unknown email provider: {provider_name}. "
            f"Available: {', '.join(PROVIDER_REGISTRY.keys())}"
        )

    return provider_class(api_key=api_key, **kwargs)
