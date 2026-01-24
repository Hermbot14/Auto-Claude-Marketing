"""
Mailchimp Email Provider
=========================

Integration with Mailchimp API for email marketing operations.

Mailchimp API Documentation: https://mailchimp.com/developer/api/

Environment Variables:
    MAILCHIMP_API_KEY: Your Mailchimp API key
    MAILCHIMP_AUDIENCE_ID: Default audience ID (optional)

Usage:
    from integrations.email import MailchimpProvider

    provider = MailchimpProvider(
        api_key="your-api-key",
        audience_id="your-audience-id"  # optional
    )

    # Get lists/audiences
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


class MailchimpProvider(EmailProvider):
    """
    Mailchimp API integration for email marketing operations.

    Uses Mailchimp API 3.0 for:
    - Audience/List management
    - Campaign creation and sending
    - Subscriber management
    - Analytics tracking

    Authentication:
        API Key format: {datacenter}-{api_key}
        Example: us19-abc123def456

    Base URL format: https://{datacenter}.api.mailchimp.com/export/2.0/
    """

    def __init__(
        self,
        api_key: str,
        audience_id: str = "",
        timeout: int = 30,
    ):
        """
        Initialize Mailchimp provider.

        Args:
            api_key: Mailchimp API key (format: {datacenter}-{key})
            audience_id: Default audience ID (optional)
            timeout: Request timeout in seconds
        """
        # Extract datacenter from API key
        # Format: us19-abc123def456
        datacenter = "us1"  # default
        if "-" in api_key:
            datacenter = api_key.split("-")[1][:4]

        base_url = f"https://{datacenter}.api.mailchimp.com/3.0"

        super().__init__(
            api_key=api_key,
            timeout=timeout,
            base_url=base_url,
        )

        self.audience_id = audience_id

        # Update headers for Mailchimp
        self._client.headers.update(
            {
                "Authorization": f"Bearer {self.api_key}",
            }
        )

    def _get_default_headers(self) -> dict[str, str]:
        """Get default HTTP headers for Mailchimp requests."""
        return {
            "User-Agent": "Auto-Claude-Marketing/1.0",
        }

    async def _request(
        self,
        method: str,
        endpoint: str,
        data: dict | None = None,
        params: dict | None = None,
    ) -> dict:
        """
        Make an API request to Mailchimp.

        Args:
            method: HTTP method (GET, POST, PUT, DELETE, PATCH)
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
                    "Mailchimp authentication failed. Check your API key.",
                    provider="mailchimp",
                    details={"status_code": response.status_code},
                )
            elif response.status_code == 429:
                retry_after = response.headers.get("X-RateLimit-Reset")
                raise EmailProviderError(
                    "Mailchimp rate limit exceeded.",
                    provider="mailchimp",
                    details={"retry_after": retry_after},
                )
            elif response.status_code >= 400:
                error_detail = ""
                try:
                    error_json = response.json()
                    error_detail = error_json.get("detail", "")
                except Exception:
                    pass
                raise EmailProviderError(
                    f"Mailchimp API error: {error_detail or response.status_code}",
                    provider="mailchimp",
                    details={
                        "status_code": response.status_code,
                        "detail": error_detail,
                    },
                )

            return response.json() if response.content else {}

        except httpx.HTTPError as e:
            raise EmailProviderError(
                f"HTTP error during Mailchimp request: {e}",
                provider="mailchimp",
                details={"error": str(e)},
            )

    async def get_lists(self) -> list[EmailList]:
        """
        Get all Mailchimp audiences (lists).

        Returns:
            List of EmailList objects

        Raises:
            EmailProviderError: If request fails
        """
        try:
            # Get first page
            data = await self._request("GET", "/lists", params={"count": 100})

            lists_data = data.get("lists", [])
            lists = []

            for list_data in lists_data:
                email_list = EmailList(
                    id=list_data.get("id", ""),
                    name=list_data.get("name", ""),
                    subscriber_count=list_data.get("stats", {}).get(
                        "member_count", 0
                    ),
                    description=list_data.get("description", ""),
                    created_at=_parse_mailchimp_date(
                        list_data.get("date_created")
                    ),
                    provider="mailchimp",
                    raw_data=list_data,
                )
                lists.append(email_list)

            logger.info(f"Retrieved {len(lists)} Mailchimp audiences")
            return lists

        except EmailProviderError:
            raise
        except Exception as e:
            raise EmailProviderError(
                f"Failed to retrieve Mailchimp lists: {e}",
                provider="mailchimp",
            )

    async def get_list_details(self, list_id: str) -> EmailList:
        """
        Get detailed information about a Mailchimp audience.

        Args:
            list_id: Audience ID

        Returns:
            EmailList with full details

        Raises:
            EmailProviderError: If request fails
        """
        try:
            data = await self._request("GET", f"/lists/{list_id}")

            return EmailList(
                id=data.get("id", ""),
                name=data.get("name", ""),
                subscriber_count=data.get("stats", {}).get("member_count", 0),
                description=data.get("description", ""),
                created_at=_parse_mailchimp_date(data.get("date_created")),
                provider="mailchimp",
                raw_data=data,
            )

        except EmailProviderError:
            raise
        except Exception as e:
            raise EmailProviderError(
                f"Failed to retrieve list details: {e}",
                provider="mailchimp",
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
        Create a Mailchimp campaign.

        Args:
            list_id: Target audience ID
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
            # Use provided list_id or default
            target_list_id = list_id or self.audience_id
            if not target_list_id:
                raise ValueError(
                    "list_id must be provided either as parameter "
                    "or as default audience_id"
                )

            # Create campaign
            campaign_data = {
                "type": "regular",
                "recipients": {"list_id": target_list_id},
                "settings": {
                    "subject_line": subject,
                    "from_name": from_name,
                    "reply_to": reply_to or from_email,
                    "title": campaign_name or subject,
                },
            }

            # Remove empty values
            campaign_data["settings"] = {
                k: v for k, v in campaign_data["settings"].items() if v
            }

            response = await self._request(
                "POST", "/campaigns", data=campaign_data
            )

            campaign_id = response.get("id", "")

            # Set campaign content
            content_data = {}
            if html_content:
                content_data["html"] = html_content
            if plain_text:
                content_data["plain"] = plain_text

            if content_data:
                await self._request(
                    "PUT", f"/campaigns/{campaign_id}/content", data=content_data
                )

            # Fetch created campaign details
            campaign_response = await self._request("GET", f"/campaigns/{campaign_id}")

            return EmailCampaign(
                id=campaign_response.get("id", ""),
                name=campaign_response.get("settings", {}).get("title", ""),
                subject=campaign_response.get("settings", {}).get("subject_line", ""),
                list_id=campaign_response.get("recipients", {}).get("list_id", ""),
                status=campaign_response.get("status", "draft"),
                from_name=campaign_response.get("settings", {}).get("from_name", ""),
                from_email=campaign_response.get("settings", {}).get("reply_to", ""),
                html_content=html_content,
                plain_text=plain_text,
                subscriber_count=campaign_response.get(
                    "recipients", {}
                ).get("recipient_count", 0),
                created_at=_parse_mailchimp_date(campaign_response.get("create_time")),
                provider="mailchimp",
                raw_data=campaign_response,
            )

        except EmailProviderError:
            raise
        except Exception as e:
            raise EmailProviderError(
                f"Failed to create campaign: {e}",
                provider="mailchimp",
            )

    async def send_campaign(
        self,
        campaign_id: str,
        schedule_time: datetime | None = None,
    ) -> bool:
        """
        Send a Mailchimp campaign.

        Args:
            campaign_id: Campaign ID to send
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
                    "schedule_time": schedule_time.isoformat(),
                    "timewarp": False,
                }
                await self._request(
                    "POST", f"/campaigns/{campaign_id}/actions/schedule", data=schedule_data
                )
                logger.info(f"Campaign {campaign_id} scheduled for {schedule_time}")
            else:
                # Send immediately
                await self._request("POST", f"/campaigns/{campaign_id}/actions/send")
                logger.info(f"Campaign {campaign_id} sent immediately")

            return True

        except EmailProviderError:
            raise
        except Exception as e:
            raise EmailProviderError(
                f"Failed to send campaign: {e}",
                provider="mailchimp",
            )

    async def get_analytics(self, campaign_id: str) -> CampaignAnalytics:
        """
        Get Mailchimp campaign analytics.

        Args:
            campaign_id: Campaign ID

        Returns:
            CampaignAnalytics object

        Raises:
            EmailProviderError: If request fails
        """
        try:
            campaign_data = await self._request("GET", f"/campaigns/{campaign_id}")

            # Get detailed reports
            reports_data = {}
            try:
                reports_data = await self._request(
                    "GET", f"/reports/{campaign_id}"
                )
            except Exception:
                # Reports might not be available yet
                pass

            stats = reports_data.get("summary", {})

            return CampaignAnalytics(
                campaign_id=campaign_id,
                total_sent=stats.get("emails_sent", 0),
                total_opens=stats.get("opens_total", 0),
                unique_opens=stats.get("unique_opens", 0),
                total_clicks=stats.get("clicks_total", 0),
                unique_clicks=stats.get("unique_clicks", 0),
                bounces=stats.get("bounces_total", 0),
                hard_bounces=stats.get("hard_bounces", 0),
                soft_bounces=stats.get("soft_bounces", 0),
                unsubscribes=stats.get("unsubscribed", 0),
                complaints=stats.get("abuse_reports", 0),
                forwards=stats.get("forwards_total", 0),
                open_rate=stats.get("open_rate", 0.0) * 100,
                click_rate=stats.get("click_rate", 0.0) * 100,
                bounce_rate=stats.get("bounce_rate", 0.0) * 100,
                unsubscribe_rate=stats.get("unsubscribe_rate", 0.0) * 100,
            )

        except EmailProviderError:
            raise
        except Exception as e:
            raise EmailProviderError(
                f"Failed to retrieve analytics: {e}",
                provider="mailchimp",
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
        Add a subscriber to a Mailchimp audience.

        Args:
            list_id: Target audience ID
            email: Subscriber email
            first_name: First name
            last_name: Last name
            fields: Additional merge fields
            double_optin: Require double opt-in

        Returns:
            Created EmailSubscriber

        Raises:
            EmailProviderError: If request fails
        """
        try:
            target_list_id = list_id or self.audience_id
            if not target_list_id:
                raise ValueError(
                    "list_id must be provided either as parameter "
                    "or as default audience_id"
                )

            # Build merge fields
            merge_fields = {"FNAME": first_name, "LNAME": last_name}
            if fields:
                merge_fields.update(fields)

            # Remove empty values
            merge_fields = {k: v for k, v in merge_fields.items() if v}

            subscriber_data = {
                "email_address": email,
                "status": "pending" if double_optin else "subscribed",
                "merge_fields": merge_fields,
            }

            response = await self._request(
                "PUT",  # PUT for idempotent subscribe/update
                f"/lists/{target_list_id}/members/{_hash_email(email)}",
                data=subscriber_data,
            )

            return EmailSubscriber(
                email=response.get("email_address", ""),
                first_name=response.get("merge_fields", {}).get("FNAME", ""),
                last_name=response.get("merge_fields", {}).get("LNAME", ""),
                status=response.get("status", ""),
                list_id=target_list_id,
                provider="mailchimp",
                subscribed_at=_parse_mailchimp_date(response.get("timestamp_signup")),
                raw_data=response,
            )

        except EmailProviderError:
            raise
        except Exception as e:
            raise EmailProviderError(
                f"Failed to add subscriber: {e}",
                provider="mailchimp",
            )

    async def remove_subscriber(self, list_id: str, email: str) -> bool:
        """
        Unsubscribe a member from a Mailchimp audience.

        Args:
            list_id: Audience ID
            email: Subscriber email

        Returns:
            True if successful

        Raises:
            EmailProviderError: If request fails
        """
        try:
            target_list_id = list_id or self.audience_id
            if not target_list_id:
                raise ValueError(
                    "list_id must be provided either as parameter "
                    "or as default audience_id"
                )

            # Unsubscribe by updating status
            subscriber_data = {"status": "unsubscribed"}

            await self._request(
                "PATCH",
                f"/lists/{target_list_id}/members/{_hash_email(email)}",
                data=subscriber_data,
            )

            logger.info(f"Unsubscribed {email} from list {target_list_id}")
            return True

        except EmailProviderError:
            raise
        except Exception as e:
            raise EmailProviderError(
                f"Failed to remove subscriber: {e}",
                provider="mailchimp",
            )

    async def get_subscribers(
        self,
        list_id: str,
        status: str = "subscribed",
        limit: int = 100,
        offset: int = 0,
    ) -> list[EmailSubscriber]:
        """
        Get subscribers from a Mailchimp audience.

        Args:
            list_id: Audience ID
            status: Filter by status (subscribed, unsubscribed, cleaned, etc.)
            limit: Maximum results
            offset: Pagination offset

        Returns:
            List of EmailSubscriber objects

        Raises:
            EmailProviderError: If request fails
        """
        try:
            target_list_id = list_id or self.audience_id
            if not target_list_id:
                raise ValueError(
                    "list_id must be provided either as parameter "
                    "or as default audience_id"
                )

            params = {
                "count": limit,
                "offset": offset,
                "status": status,
            }

            data = await self._request(
                "GET",
                f"/lists/{target_list_id}/members",
                params=params,
            )

            members_data = data.get("members", [])
            subscribers = []

            for member in members_data:
                subscriber = EmailSubscriber(
                    email=member.get("email_address", ""),
                    first_name=member.get("merge_fields", {}).get("FNAME", ""),
                    last_name=member.get("merge_fields", {}).get("LNAME", ""),
                    status=member.get("status", ""),
                    list_id=target_list_id,
                    provider="mailchimp",
                    subscribed_at=_parse_mailchimp_date(member.get("timestamp_signup")),
                    raw_data=member,
                )
                subscribers.append(subscriber)

            logger.info(
                f"Retrieved {len(subscribers)} subscribers from {target_list_id}"
            )
            return subscribers

        except EmailProviderError:
            raise
        except Exception as e:
            raise EmailProviderError(
                f"Failed to retrieve subscribers: {e}",
                provider="mailchimp",
            )


def _parse_mailchimp_date(date_str: str | None) -> datetime | None:
    """Parse Mailchimp date string to datetime."""
    if not date_str:
        return None
    try:
        # Mailchimp dates are ISO 8601 format
        return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def _hash_email(email: str) -> str:
    """
    Hash email for Mailchimp member ID (MD5 lowercase).

    Mailchimp uses the MD5 hash of the lowercase email as the member ID.
    """
    import hashlib

    return hashlib.md5(email.lower().encode()).hexdigest()


# Import httpx at module level for request method
import httpx
