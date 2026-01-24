"""
SendGrid Email Provider
========================

Integration with SendGrid API for email marketing operations.

SendGrid API Documentation: https://docs.sendgrid.com/api-reference

Environment Variables:
    SENDGRID_API_KEY: Your SendGrid API key

Usage:
    from integrations.email import SendGridProvider

    provider = SendGridProvider(api_key="your-api-key")

    # Get lists (marketing campaigns only)
    lists = await provider.get_lists()

    # Create campaign
    campaign = await provider.create_campaign(
        list_id="...",
        subject="Welcome!",
        html_content="<html>...</html>"
    )

    # Send campaign
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


class SendGridProvider(EmailProvider):
    """
    SendGrid API integration for email marketing operations.

    Uses SendGrid Web API v3 for:
    - Contact list management
    - Marketing campaigns (single sends or automated)
    - Subscriber management
    - Analytics tracking

    Authentication:
        Bearer token using SendGrid API key
    """

    BASE_URL = "https://api.sendgrid.com/v3"

    def __init__(
        self,
        api_key: str,
        timeout: int = 30,
        sender_id: int = 0,
    ):
        """
        Initialize SendGrid provider.

        Args:
            api_key: SendGrid API key
            timeout: Request timeout in seconds
            sender_id: Verified sender ID for campaigns (optional)
        """
        super().__init__(
            api_key=api_key,
            timeout=timeout,
            base_url=self.BASE_URL,
        )

        self.sender_id = sender_id

        # Update headers for SendGrid
        self._client.headers.update(
            {
                "Authorization": f"Bearer {self.api_key}",
            }
        )

    async def _request(
        self,
        method: str,
        endpoint: str,
        data: dict | None = None,
        params: dict | None = None,
    ) -> dict:
        """
        Make an API request to SendGrid.

        Args:
            method: HTTP method
            endpoint: API endpoint path
            data: Request body data
            params: Query parameters

        Returns:
            Parsed JSON response

        Raises:
            EmailProviderError: If request fails
        """
        url = f"{self.base_url}{endpoint}"

        try:
            if method.upper() == "GET":
                response = await self._client.get(url, params=params)
            elif method.upper() == "POST":
                response = await self._client.post(url, json=data)
            elif method.upper() == "PUT":
                response = await self._client.put(url, json=data)
            elif method.upper() == "PATCH":
                response = await self._client.patch(url, json=data)
            elif method.upper() == "DELETE":
                response = await self._client.delete(url)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")

            # Handle errors
            if response.status_code == 401:
                raise EmailProviderAuthError(
                    "SendGrid authentication failed. Check your API key.",
                    provider="sendgrid",
                    details={"status_code": response.status_code},
                )
            elif response.status_code == 429:
                raise EmailProviderError(
                    "SendGrid rate limit exceeded.",
                    provider="sendgrid",
                    details={"status_code": response.status_code},
                )
            elif response.status_code >= 400:
                error_detail = ""
                try:
                    error_json = response.json()
                    errors = error_json.get("errors", [])
                    if errors:
                        error_detail = "; ".join(
                            e.get("message", str(e)) for e in errors
                        )
                except Exception:
                    pass
                raise EmailProviderError(
                    f"SendGrid API error: {error_detail or response.status_code}",
                    provider="sendgrid",
                    details={
                        "status_code": response.status_code,
                        "detail": error_detail,
                    },
                )

            return response.json() if response.content else {}

        except httpx.HTTPError as e:
            raise EmailProviderError(
                f"HTTP error during SendGrid request: {e}",
                provider="sendgrid",
                details={"error": str(e)},
            )

    async def get_lists(self) -> list[EmailList]:
        """
        Get all SendGrid contact lists.

        Returns:
            List of EmailList objects

        Raises:
            EmailProviderError: If request fails
        """
        try:
            data = await self._request("GET", "/marketing/lists")

            lists_data = data.get("result", [])
            lists = []

            for list_data in lists_data:
                email_list = EmailList(
                    id=str(list_data.get("id", "")),
                    name=list_data.get("name", ""),
                    subscriber_count=list_data.get("metadata", {}).get(
                        "member_count", 0
                    ),
                    description=list_data.get("description", ""),
                    created_at=_parse_sendgrid_date(
                        list_data.get("created_at")
                    ),
                    provider="sendgrid",
                    raw_data=list_data,
                )
                lists.append(email_list)

            logger.info(f"Retrieved {len(lists)} SendGrid lists")
            return lists

        except EmailProviderError:
            raise
        except Exception as e:
            raise EmailProviderError(
                f"Failed to retrieve SendGrid lists: {e}",
                provider="sendgrid",
            )

    async def get_list_details(self, list_id: str) -> EmailList:
        """
        Get detailed information about a SendGrid list.

        Args:
            list_id: List ID

        Returns:
            EmailList with full details

        Raises:
            EmailProviderError: If request fails
        """
        try:
            data = await self._request("GET", f"/marketing/lists/{list_id}")

            return EmailList(
                id=str(data.get("id", "")),
                name=data.get("name", ""),
                subscriber_count=data.get("metadata", {}).get("member_count", 0),
                description=data.get("description", ""),
                created_at=_parse_sendgrid_date(data.get("created_at")),
                provider="sendgrid",
                raw_data=data,
            )

        except EmailProviderError:
            raise
        except Exception as e:
            raise EmailProviderError(
                f"Failed to retrieve list details: {e}",
                provider="sendgrid",
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
        Create a SendGrid marketing campaign (single send).

        Args:
            list_id: Target list ID
            subject: Email subject line
            html_content: HTML email content
            plain_text: Plain text fallback
            from_name: Sender name
            from_email: Sender email
            reply_to: Reply-to email
            campaign_name: Internal campaign name

        Returns:
            Created EmailCampaign object

        Raises:
            EmailProviderError: If request fails
        """
        try:
            # Create custom HTML content
            # In SendGrid, we need to create a custom HTML design first
            campaign_data = {
                "name": campaign_name or subject,
                "subject": subject,
                "sender_id": self.sender_id,
                "list_ids": [int(list_id)] if list_id else [],
                "html_content": html_content,
                "plain_content": plain_text,
                "status": "draft",
            }

            # Add sender info if provided
            if from_email:
                campaign_data["from_email"] = from_email
            if from_name:
                campaign_data["from_name"] = from_name
            if reply_to:
                campaign_data["reply_to"] = reply_to

            # Remove empty values
            campaign_data = {
                k: v for k, v in campaign_data.items() if v not in (None, "", [], 0)
            }

            # Create single send (campaign)
            response = await self._request(
                "POST", "/marketing/singlesends", data=campaign_data
            )

            campaign_id = response.get("id", "")

            return EmailCampaign(
                id=str(campaign_id),
                name=response.get("name", ""),
                subject=response.get("subject", ""),
                list_id=list_id,
                status=response.get("status", "draft"),
                from_name=from_name,
                from_email=from_email,
                reply_to=reply_to,
                html_content=html_content,
                plain_text=plain_text,
                created_at=_parse_sendgrid_date(response.get("created_at")),
                provider="sendgrid",
                raw_data=response,
            )

        except EmailProviderError:
            raise
        except Exception as e:
            raise EmailProviderError(
                f"Failed to create campaign: {e}",
                provider="sendgrid",
            )

    async def send_campaign(
        self,
        campaign_id: str,
        schedule_time: datetime | None = None,
    ) -> bool:
        """
        Send a SendGrid campaign.

        Args:
            campaign_id: Campaign ID (single send ID)
            schedule_time: Optional schedule time (None = send immediately)

        Returns:
            True if successful

        Raises:
            EmailProviderError: If request fails
        """
        try:
            if schedule_time:
                # Schedule campaign
                schedule_data = {
                    "send_at": schedule_time.isoformat(),
                }
                await self._request(
                    "PUT",
                    f"/marketing/singlesends/{campaign_id}/schedule",
                    data=schedule_data,
                )
                logger.info(f"Campaign {campaign_id} scheduled for {schedule_time}")
            else:
                # Send immediately
                await self._request(
                    "POST", f"/marketing/singlesends/{campaign_id}/schedule"
                )
                logger.info(f"Campaign {campaign_id} sent immediately")

            return True

        except EmailProviderError:
            raise
        except Exception as e:
            raise EmailProviderError(
                f"Failed to send campaign: {e}",
                provider="sendgrid",
            )

    async def get_analytics(self, campaign_id: str) -> CampaignAnalytics:
        """
        Get SendGrid campaign analytics.

        Args:
            campaign_id: Campaign ID

        Returns:
            CampaignAnalytics object

        Raises:
            EmailProviderError: If request fails
        """
        try:
            # Get single send stats
            data = await self._request(
                "GET", f"/marketing/singlesends/{campaign_id}/stats"
            )

            stats = data.get("stats", [{}])[0] if data.get("stats") else {}

            return CampaignAnalytics(
                campaign_id=campaign_id,
                total_sent=stats.get("sent", 0),
                total_opens=stats.get("opens", 0),
                unique_opens=stats.get("unique_opens", 0),
                total_clicks=stats.get("clicks", 0),
                unique_clicks=stats.get("unique_clicks", 0),
                bounces=stats.get("bounces", 0),
                unsubscribes=stats.get("unsubscribes", 0),
                complaints=stats.get("spam_reports", 0),
                open_rate=_calculate_rate(stats.get("opens", 0), stats.get("sent", 0)),
                click_rate=_calculate_rate(stats.get("clicks", 0), stats.get("opens", 0)),
                bounce_rate=_calculate_rate(stats.get("bounces", 0), stats.get("sent", 0)),
                unsubscribe_rate=_calculate_rate(
                    stats.get("unsubscribes", 0), stats.get("sent", 0)
                ),
            )

        except EmailProviderError:
            raise
        except Exception as e:
            raise EmailProviderError(
                f"Failed to retrieve analytics: {e}",
                provider="sendgrid",
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
        Add a subscriber to a SendGrid list.

        Args:
            list_id: Target list ID
            email: Subscriber email
            first_name: First name
            last_name: Last name
            fields: Additional custom fields
            double_optin: This is ignored by SendGrid (no opt-in required)

        Returns:
            Created EmailSubscriber

        Raises:
            EmailProviderError: If request fails
        """
        try:
            # Build custom fields
            custom_fields = {
                "first_name": first_name,
                "last_name": last_name,
            }
            if fields:
                custom_fields.update(fields)

            # Remove empty values
            custom_fields = {k: v for k, v in custom_fields.items() if v}

            subscriber_data = [
                {
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "custom_fields": custom_fields,
                }
            ]

            # Add contacts to list (creates or updates)
            await self._request(
                "PUT",
                f"/marketing/lists/{list_id}/contacts",
                data=subscriber_data,
            )

            return EmailSubscriber(
                email=email,
                first_name=first_name,
                last_name=last_name,
                status="subscribed",
                list_id=list_id,
                provider="sendgrid",
                subscribed_at=datetime.now(),
            )

        except EmailProviderError:
            raise
        except Exception as e:
            raise EmailProviderError(
                f"Failed to add subscriber: {e}",
                provider="sendgrid",
            )

    async def remove_subscriber(self, list_id: str, email: str) -> bool:
        """
        Remove a subscriber from a SendGrid list.

        Args:
            list_id: List ID
            email: Subscriber email

        Returns:
            True if successful

        Raises:
            EmailProviderError: If request fails
        """
        try:
            # Delete contact from list
            await self._request(
                "DELETE",
                f"/marketing/lists/{list_id}/contacts/{email}",
            )

            logger.info(f"Removed {email} from list {list_id}")
            return True

        except EmailProviderError:
            raise
        except Exception as e:
            raise EmailProviderError(
                f"Failed to remove subscriber: {e}",
                provider="sendgrid",
            )

    async def get_subscribers(
        self,
        list_id: str,
        status: str = "subscribed",
        limit: int = 100,
        offset: int = 0,
    ) -> list[EmailSubscriber]:
        """
        Get subscribers from a SendGrid list.

        Args:
            list_id: List ID
            status: Filter by status (not fully supported by SendGrid)
            limit: Maximum results
            offset: Pagination offset

        Returns:
            List of EmailSubscriber objects

        Raises:
            EmailProviderError: If request fails
        """
        try:
            params = {
                "page_size": limit,
                "page_token": offset,  # SendGrid uses page_token for pagination
            }

            data = await self._request(
                "GET",
                f"/marketing/lists/{list_id}/contacts",
                params=params,
            )

            contacts_data = data.get("result", [])
            subscribers = []

            for contact in contacts_data:
                # Get custom fields
                custom_fields = contact.get("custom_fields", {})
                first_name = next(
                    (f.get("value") for f in custom_fields if f.get("name") == "first_name"),
                    "",
                )
                last_name = next(
                    (f.get("value") for f in custom_fields if f.get("name") == "last_name"),
                    "",
                )

                subscriber = EmailSubscriber(
                    email=contact.get("email", ""),
                    first_name=first_name,
                    last_name=last_name,
                    status="subscribed",  # SendGrid doesn't expose status clearly
                    list_id=list_id,
                    provider="sendgrid",
                    subscribed_at=_parse_sendgrid_date(contact.get("created_at")),
                    raw_data=contact,
                )
                subscribers.append(subscriber)

            logger.info(f"Retrieved {len(subscribers)} subscribers from {list_id}")
            return subscribers

        except EmailProviderError:
            raise
        except Exception as e:
            raise EmailProviderError(
                f"Failed to retrieve subscribers: {e}",
                provider="sendgrid",
            )


def _parse_sendgrid_date(date_str: str | None) -> datetime | None:
    """Parse SendGrid date string to datetime."""
    if not date_str:
        return None
    try:
        # SendGrid dates are ISO 8601 format
        return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def _calculate_rate(numerator: int, denominator: int) -> float:
    """Calculate percentage rate."""
    if denominator == 0:
        return 0.0
    return round((numerator / denominator) * 100, 2)
