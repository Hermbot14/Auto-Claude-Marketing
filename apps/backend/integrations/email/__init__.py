"""
Email Platform Integrations
============================

Integration with major email service providers for campaign management,
subscriber management, and analytics tracking.

Supported Providers:
- Mailchimp
- SendGrid
- ConvertKit

Usage:
    from integrations.email import get_email_provider, EmailProvider

    # Get provider instance
    provider = get_email_provider("mailchimp", api_key="...", audience_id="...")

    # List management
    lists = await provider.get_lists()

    # Campaign creation
    campaign = await provider.create_campaign(
        list_id="...",
        subject="Welcome!",
        content="<html>...</html>"
    )

    # Send campaign
    await provider.send_campaign(campaign_id)

    # Analytics
    analytics = await provider.get_analytics(campaign_id)

    # Subscriber management
    await provider.add_subscriber(
        list_id="...",
        email="user@example.com",
        fields={"first_name": "John"}
    )
"""

# Import base classes and data models
from .base import (
    CampaignAnalytics,
    EmailCampaign,
    EmailList,
    EmailProvider,
    EmailProviderAuthError,
    EmailProviderError,
    EmailSubscriber,
    get_email_provider,
)

# Import provider implementations
from .convertkit import ConvertKitProvider
from .mailchimp import MailchimpProvider
from .sendgrid import SendGridProvider

__all__ = [
    # Base classes and data models
    "EmailProvider",
    "EmailProviderError",
    "EmailProviderAuthError",
    "EmailList",
    "EmailCampaign",
    "EmailSubscriber",
    "CampaignAnalytics",
    "get_email_provider",
    # Providers
    "MailchimpProvider",
    "SendGridProvider",
    "ConvertKitProvider",
]

# Provider registry for factory function
PROVIDER_REGISTRY = {
    "mailchimp": MailchimpProvider,
    "sendgrid": SendGridProvider,
    "convertkit": ConvertKitProvider,
}
