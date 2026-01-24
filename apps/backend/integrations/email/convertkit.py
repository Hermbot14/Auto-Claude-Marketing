"""
ConvertKit Email Provider
==========================

Integration with ConvertKit API for email marketing operations.

ConvertKit API Documentation: https://developers.convertkit.com/

Environment Variables:
    CONVERTKIT_API_KEY: Your ConvertKit API key
    CONVERTKIT_API_SECRET: Your ConvertKit API secret (optional, for some endpoints)

Usage:
    from integrations.email import ConvertKitProvider

    provider = ConvertKitProvider(
        api_key="your-api-key",
        api_secret="your-api-secret"  # optional
    )

    # Get forms (which act as lists)
    forms = await provider.get_lists()

    # Create broadcast (campaign)
    campaign = await provider.create_campaign(
        list_id="...",  # form ID or sequence ID
        subject="Welcome!",
        html_content="<html>...</html>"
    )

    # Send broadcast
    await provider.send_campaign(campaign.id)

    # Get analytics
    analytics = await provider.get_analytics(campaign.id)
"""

import logging
from datetime import datetime
from typing import Any

import httpx

from .base import (
    CampaignAnalytics,
    EmailCampaign,
    EmailList,
    EmailProvider,
    EmailProviderAuthError,
    EmailProviderError,
    EmailSubscriber,
)

logger = logging.getLogger(__name__)


class ConvertKitProvider(EmailProvider):
    """
    ConvertKit API integration for email marketing operations.

    Uses ConvertKit REST API v3 for:
    - Form and sequence management (acting as lists)
    - Broadcast creation (campaigns)
    - Subscriber management
    - Analytics tracking

    Authentication:
        API key as public parameter
        API secret for protected endpoints

    Note: ConvertKit uses slightly different terminology:
    - Lists = Forms or Sequences
    - Campaigns = Broadcasts
    - Subscribers = Subscribers
    """

    BASE_URL = "https://api.convertkit.com/v3"

    def __init__(
        self,
        api_key: str,
        api_secret: str = "",
        timeout: int = 30,
    ):
        """
        Initialize ConvertKit provider.

        Args:
            api_key: ConvertKit API key (public)
            api_secret: ConvertKit API secret (for protected endpoints)
            timeout: Request timeout in seconds
        """
        super().__init__(
            api_key=api_key,
            timeout=timeout,
            base_url=self.BASE_URL,
        )

        self.api_secret = api_secret

    def _get_default_headers(self) -> dict[str, str]:
        """Get default HTTP headers for ConvertKit requests."""
        return {
            "User-Agent": "Auto-Claude-Marketing/1.0",
            "Accept": "application/json",
        }

    def _add_auth_params(self, params: dict | None = None) -> dict:
        """
        Add authentication parameters to request.

        ConvertKit uses API key/secret as URL parameters, not headers.
        """
        params = params or {}
        params["api_secret"] = self.api_secret or self.api_key
        return params

    async def _request(
        self,
        method: str,
        endpoint: str,
        data: dict | None = None,
        params: dict | None = None,
        use_secret: bool = True,
    ) -> dict:
        """
        Make an API request to ConvertKit.

        Args:
            method: HTTP method
            endpoint: API endpoint path
            data: Request body data
            params: Query parameters
            use_secret: Whether to use API secret (default: True)

        Returns:
            Parsed JSON response

        Raises:
            EmailProviderError: If request fails
        """
        url = f"{self.base_url}{endpoint}"

        # Add auth params
        auth_params = {}
        if use_secret:
            auth_params["api_secret"] = self.api_secret or self.api_key
        else:
            auth_params["api_key"] = self.api_key

        if params:
            params.update(auth_params)
        else:
            params = auth_params

        try:
            if method.upper() == "GET":
                response = await self._client.get(url, params=params)
            elif method.upper() == "POST":
                response = await self._client.post(url, json=data, params=params)
            elif method.upper() == "PUT":
                response = await self._client.put(url, json=data, params=params)
            elif method.upper() == "DELETE":
                response = await self._client.delete(url, params=params)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")

            # Handle errors
            if response.status_code == 401:
                raise EmailProviderAuthError(
                    "ConvertKit authentication failed. Check your API key/secret.",
                    provider="convertkit",
                    details={"status_code": response.status_code},
                )
            elif response.status_code == 429:
                raise EmailProviderError(
                    "ConvertKit rate limit exceeded.",
                    provider="convertkit",
                    details={"status_code": response.status_code},
                )
            elif response.status_code >= 400:
                error_detail = ""
                try:
                    error_json = response.json()
                    error_detail = error_json.get("error", "")
                    error_message = error_json.get("message", "")
                    if error_message:
                        error_detail = f"{error_detail}: {error_message}"
                except Exception:
                    pass
                raise EmailProviderError(
                    f"ConvertKit API error: {error_detail or response.status_code}",
                    provider="convertkit",
                    details={
                        "status_code": response.status_code,
                        "detail": error_detail,
                    },
                )

            return response.json() if response.content else {}

        except httpx.HTTPError as e:
            raise EmailProviderError(
                f"HTTP error during ConvertKit request: {e}",
                provider="convertkit",
                details={"error": str(e)},
            )

    async def get_lists(self) -> list[EmailList]:
        """
        Get all ConvertKit forms (acting as lists).

        Returns:
            List of EmailList objects

        Raises:
            EmailProviderError: If request fails
        """
        try:
            data = await self._request("GET", "/forms", use_secret=False)

            forms_data = data.get("forms", [])
            lists = []

            for form in forms_data:
                email_list = EmailList(
                    id=str(form.get("id", "")),
                    name=form.get("name", ""),
                    description=form.get("description", ""),
                    subscriber_count=form.get("subscriber_count", 0),
                    created_at=_parse_convertkit_date(form.get("created_at")),
                    provider="convertkit",
                    raw_data=form,
                )
                lists.append(email_list)

            logger.info(f"Retrieved {len(lists)} ConvertKit forms")
            return lists

        except EmailProviderError:
            raise
        except Exception as e:
            raise EmailProviderError(
                f"Failed to retrieve ConvertKit forms: {e}",
                provider="convertkit",
            )

    async def get_list_details(self, list_id: str) -> EmailList:
        """
        Get detailed information about a ConvertKit form.

        Args:
            list_id: Form ID

        Returns:
            EmailList with full details

        Raises:
            EmailProviderError: If request fails
        """
        try:
            data = await self._request("GET", f"/forms/{list_id}", use_secret=False)

            return EmailList(
                id=str(data.get("id", "")),
                name=data.get("name", ""),
                description=data.get("description", ""),
                subscriber_count=data.get("subscriber_count", 0),
                created_at=_parse_convertkit_date(data.get("created_at")),
                provider="convertkit",
                raw_data=data,
            )

        except EmailProviderError:
            raise
        except Exception as e:
            raise EmailProviderError(
                f"Failed to retrieve form details: {e}",
                provider="convertkit",
            )

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
        Create a ConvertKit broadcast (campaign).

        Args:
            list_id: Target form ID or sequence ID (tag_id also supported)
            subject: Email subject line
            html_content: HTML email content
            plain_text: Plain text fallback
            from_name: Sender name (uses default if not provided)
            from_email: Sender email (uses default if not provided)
            reply_to: Reply-to email (not supported by ConvertKit)
            campaign_name: Internal broadcast name (not used)

        Returns:
            Created EmailCampaign object

        Raises:
            EmailProviderError: If request fails
        """
        try:
            # ConvertKit broadcasts use content_id for templates
            # or direct HTML content
            broadcast_data = {
                "subject": subject,
                "content": html_content,
            }

            # Determine target type (form, sequence, or tag)
            # List ID can be a form_id, sequence_id, or tag_id
            if list_id:
                # Try to determine if it's a sequence or form
                # For now, assume it's a sequence or form and add accordingly
                broadcast_data["sequence_ids"] = [list_id]
                broadcast_data["tag_ids"] = []

            # Create broadcast as draft
            response = await self._request(
                "POST", "/broadcasts", data=broadcast_data
            )

            broadcast_id = response.get("id", "")
            broadcast_data_full = response

            return EmailCampaign(
                id=str(broadcast_id),
                name=response.get("name", subject),
                subject=response.get("subject", subject),
                list_id=list_id,
                status="draft",
                html_content=html_content,
                plain_text=plain_text,
                from_name=from_name,
                from_email=from_email,
                created_at=_parse_convertkit_date(response.get("created_at")),
                provider="convertkit",
                raw_data=broadcast_data_full,
            )

        except EmailProviderError:
            raise
        except Exception as e:
            raise EmailProviderError(
                f"Failed to create broadcast: {e}",
                provider="convertkit",
            )

    async def send_campaign(
        self,
        campaign_id: str,
        schedule_time: datetime | None = None,
    ) -> bool:
        """
        Send a ConvertKit broadcast.

        Args:
            campaign_id: Broadcast ID
            schedule_time: Optional schedule time (None = send immediately)

        Returns:
            True if successful

        Raises:
            EmailProviderError: If request fails
        """
        try:
            if schedule_time:
                # Schedule broadcast
                schedule_data = {
                    "scheduled_at": schedule_time.isoformat(),
                }
                await self._request(
                    "PUT",
                    f"/broadcasts/{campaign_id}/schedule",
                    data=schedule_data,
                )
                logger.info(f"Broadcast {campaign_id} scheduled for {schedule_time}")
            else:
                # Publish immediately
                await self._request("POST", f"/broadcasts/{campaign_id}/publish")
                logger.info(f"Broadcast {campaign_id} sent immediately")

            return True

        except EmailProviderError:
            raise
        except Exception as e:
            raise EmailProviderError(
                f"Failed to send broadcast: {e}",
                provider="convertkit",
            )

    async def get_analytics(self, campaign_id: str) -> CampaignAnalytics:
        """
        Get ConvertKit broadcast analytics.

        Args:
            campaign_id: Broadcast ID

        Returns:
            CampaignAnalytics object

        Raises:
            EmailProviderError: If request fails
        """
        try:
            data = await self._request("GET", f"/broadcasts/{campaign_id}")

            stats = data.get("stats", {})

            return CampaignAnalytics(
                campaign_id=campaign_id,
                total_sent=stats.get("recipients", 0),
                total_opens=stats.get("open_count", 0),
                unique_opens=stats.get("open_total", 0),
                total_clicks=stats.get("click_count", 0),
                unique_clicks=stats.get("click_total", 0),
                unsubscribes=stats.get("unsubscribes", 0),
                open_rate=_calculate_rate(
                    stats.get("open_total", 0), stats.get("recipients", 0)
                ),
                click_rate=_calculate_rate(
                    stats.get("click_total", 0), stats.get("open_total", 0)
                ),
                unsubscribe_rate=_calculate_rate(
                    stats.get("unsubscribes", 0), stats.get("recipients", 0)
                ),
            )

        except EmailProviderError:
            raise
        except Exception as e:
            raise EmailProviderError(
                f"Failed to retrieve analytics: {e}",
                provider="convertkit",
            )

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
        Add a subscriber to a ConvertKit form.

        Args:
            list_id: Target form ID
            email: Subscriber email
            first_name: First name
            last_name: Last name
            fields: Additional custom fields (ConvertKit uses "fields" parameter)
            double_optin: This field is ignored by ConvertKit

        Returns:
            Created EmailSubscriber

        Raises:
            EmailProviderError: If request fails
        """
        try:
            # Build subscriber data
            subscriber_data = {
                "email": email,
                "first_name": first_name,
            }

            # Add fields (ConvertKit custom fields)
            if fields:
                subscriber_data["fields"] = fields

            # Add to form (create or update)
            response = await self._request(
                "POST",
                f"/forms/{list_id}/subscribe",
                data=subscriber_data,
                use_secret=True,
            )

            subscription_data = response.get("subscription", {})

            return EmailSubscriber(
                email=email,
                first_name=first_name,
                last_name=last_name,
                status="subscribed",
                list_id=list_id,
                provider="convertkit",
                subscribed_at=datetime.now(),
                raw_data=response,
            )

        except EmailProviderError:
            raise
        except Exception as e:
            raise EmailProviderError(
                f"Failed to add subscriber: {e}",
                provider="convertkit",
            )

    async def remove_subscriber(self, list_id: str, email: str) -> bool:
        """
        Unsubscribe a subscriber from ConvertKit.

        Note: ConvertKit doesn't have a direct "remove from form" endpoint.
        Instead, we unsubscribe the email globally.

        Args:
            list_id: Form ID (unused, but kept for interface consistency)
            email: Subscriber email

        Returns:
            True if successful

        Raises:
            EmailProviderError: If request fails
        """
        try:
            # Unsubscribe email globally
            await self._request(
                "POST",
                "/unsubscribe",
                data={"email": email},
                use_secret=True,
            )

            logger.info(f"Unsubscribed {email} from ConvertKit")
            return True

        except EmailProviderError:
            raise
        except Exception as e:
            raise EmailProviderError(
                f"Failed to unsubscribe: {e}",
                provider="convertkit",
            )

    async def get_subscribers(
        self,
        list_id: str,
        status: str = "subscribed",
        limit: int = 100,
        offset: int = 0,
    ) -> list[EmailSubscriber]:
        """
        Get subscribers from a ConvertKit form.

        Args:
            list_id: Form ID
            status: Filter by status (not fully supported by ConvertKit)
            limit: Maximum results (ConvertKit uses per_page)
            offset: Pagination offset

        Returns:
            List of EmailSubscriber objects

        Raises:
            EmailProviderError: If request fails
        """
        try:
            params = {
                "per_page": limit,
                "page": (offset // limit) + 1,
            }

            data = await self._request(
                "GET",
                f"/forms/{list_id}/subscriptions",
                params=params,
                use_secret=True,
            )

            subscriptions_data = data.get("subscribers", [])
            subscribers = []

            for sub in subscriptions_data:
                subscriber = EmailSubscriber(
                    email=sub.get("email_address", ""),
                    first_name=sub.get("first_name", ""),
                    last_name=sub.get("fields", {}).get("last_name", ""),
                    status=sub.get("state", "active"),
                    list_id=list_id,
                    provider="convertkit",
                    subscribed_at=_parse_convertkit_date(sub.get("created_at")),
                    raw_data=sub,
                )
                subscribers.append(subscriber)

            logger.info(
                f"Retrieved {len(subscribers)} subscribers from form {list_id}"
            )
            return subscribers

        except EmailProviderError:
            raise
        except Exception as e:
            raise EmailProviderError(
                f"Failed to retrieve subscribers: {e}",
                provider="convertkit",
            )


def _parse_convertkit_date(date_str: str | None) -> datetime | None:
    """Parse ConvertKit date string to datetime."""
    if not date_str:
        return None
    try:
        # ConvertKit dates are ISO 8601 format
        return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def _calculate_rate(numerator: int, denominator: int) -> float:
    """Calculate percentage rate."""
    if denominator == 0:
        return 0.0
    return round((numerator / denominator) * 100, 2)
