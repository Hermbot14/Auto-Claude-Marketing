"""
Example usage of Advertising Platform Integrations.

This script demonstrates how to use the ads platform integrations
for managing campaigns across Google Ads, Meta Ads, and LinkedIn Ads.
"""

from datetime import datetime, timedelta
from integrations.ads import (
    get_ads_platform,
    Campaign,
    AdGroup,
    Ad,
    BidStrategy,
    CampaignStatus,
    Targeting,
)
from integrations.ads.config import AdsIntegrationsConfig


def example_google_ads():
    """Example: Google Ads campaign management."""
    print("\n=== Google Ads Example ===\n")

    # Configure Google Ads
    config = {
        'developer_token': 'your_developer_token',
        'client_id': 'your_client_id',
        'client_secret': 'your_client_secret',
        'refresh_token': 'your_refresh_token',
        'customer_id': '123-456-7890',
    }

    # Initialize platform
    google = get_ads_platform('google', config)

    # Authenticate
    google.authenticate()

    # Create a campaign
    campaign = Campaign(
        name="Summer Sale 2025",
        status=CampaignStatus.ENABLED,
        budget=150.0,
        bid_strategy=BidStrategy.MAXIMIZE_CONVERSIONS,
        start_date=datetime.now(),
        end_date=datetime.now() + timedelta(days=30),
        targeting=Targeting(
            locations=['US', 'CA'],
            languages=['en'],
            age_range={'min': 18, 'max': 65},
            keywords=['summer sale', 'discount', 'special offer'],
        ),
    )

    created_campaign = google.create_campaign(campaign)
    print(f"Created campaign: {created_campaign.name} (ID: {created_campaign.id})")

    # Create ad group
    ad_group = AdGroup(
        campaign_id=created_campaign.id,
        name="Brand Terms",
        status=CampaignStatus.ENABLED,
        default_bid=2.5,
        keywords=['our brand', 'company name'],
    )

    created_ad_group = google.create_ad_group(created_campaign.id, ad_group)
    print(f"Created ad group: {created_ad_group.name} (ID: {created_ad_group.id})")

    # Create ad
    ad = Ad(
        ad_group_id=created_ad_group.id,
        name="Main Text Ad",
        type="text",
        headline="50% Off Summer Sale",
        description="Shop now and save big on all products",
        final_url="https://example.com/summer-sale",
    )

    created_ad = google.create_ad(created_ad_group.id, ad)
    print(f"Created ad: {created_ad.name} (ID: {created_ad.id})")

    # Get performance
    performance = google.get_performance(created_campaign.id, date_range="last_30_days")
    print(f"\nPerformance (last 30 days):")
    print(f"  Impressions: {performance.impressions:,}")
    print(f"  Clicks: {performance.clicks:,}")
    print(f"  Cost: ${performance.cost:.2f}")
    print(f"  Conversions: {performance.conversions}")
    print(f"  CTR: {performance.ctr:.2f}%")
    print(f"  CPC: ${performance.cpc:.2f}")
    print(f"  ROAS: {performance.roas:.2f}x")

    # Get optimization suggestions
    suggestions = google.get_optimization_suggestions(created_campaign.id)
    print(f"\nOptimization Suggestions: {len(suggestions)} found")
    for i, suggestion in enumerate(suggestions, 1):
        print(f"  {i}. [{suggestion.priority.upper()}] {suggestion.title}")
        print(f"     {suggestion.description}")


def example_meta_ads():
    """Example: Meta Ads (Facebook/Instagram) campaign management."""
    print("\n=== Meta Ads Example ===\n")

    # Configure Meta Ads
    config = {
        'access_token': 'your_access_token',
        'account_id': 'act_123456789',
    }

    # Initialize platform
    meta = get_ads_platform('meta', config)

    # Authenticate
    meta.authenticate()

    # Create campaign
    campaign = Campaign(
        name="Instagram Stories - Brand Awareness",
        status=CampaignStatus.ENABLED,
        budget=50.0,
        bid_strategy=BidStrategy.MAXIMIZE_CLICKS,
        start_date=datetime.now(),
        end_date=datetime.now() + timedelta(days=14),
        platform_specific={
            'objective': 'BRAND_AWARENESS',
        },
    )

    created_campaign = meta.create_campaign(campaign)
    print(f"Created campaign: {created_campaign.name} (ID: {created_campaign.id})")

    # Create ad set
    ad_group = AdGroup(
        campaign_id=created_campaign.id,
        name="US - 18-34",
        status=CampaignStatus.ENABLED,
        default_bid=1.5,
        platform_specific={
            'optimization_goal': 'IMPRESSIONS',
            'billing_event': 'IMPRESSIONS',
            'targeting': Targeting(
                locations=['US'],
                age_range={'min': 18, 'max': 34},
            ),
        },
    )

    created_ad_group = meta.create_ad_group(created_campaign.id, ad_group)
    print(f"Created ad set: {created_ad_group.name} (ID: {created_ad_group.id})")

    # Create ad
    ad = Ad(
        ad_group_id=created_ad_group.id,
        name="Instagram Story Ad",
        type="image",
        headline="Discover More",
        description="Swipe up to learn more",
        final_url="https://example.com",
        call_to_action="LEARN_MORE",
        platform_specific={
            'page_id': '123456789',
        },
    )

    created_ad = meta.create_ad(created_ad_group.id, ad)
    print(f"Created ad: {created_ad.name} (ID: {created_ad.id})")

    # Get performance
    performance = meta.get_performance(created_campaign.id)
    print(f"\nPerformance (last 30 days):")
    print(f"  Impressions: {performance.impressions:,}")
    print(f"  Clicks: {performance.clicks:,}")
    print(f"  Cost: ${performance.cost:.2f}")
    print(f"  CTR: {performance.ctr:.2f}%")

    # Get suggestions
    suggestions = meta.get_optimization_suggestions(created_campaign.id)
    print(f"\nOptimization Suggestions: {len(suggestions)} found")


def example_linkedin_ads():
    """Example: LinkedIn Ads campaign management."""
    print("\n=== LinkedIn Ads Example ===\n")

    # Configure LinkedIn Ads
    config = {
        'access_token': 'your_access_token',
        'account_id': 'urn:li:sponsoredAccount:123456',
    }

    # Initialize platform
    linkedin = get_ads_platform('linkedin', config)

    # Authenticate
    linkedin.authenticate()

    # Create campaign
    campaign = Campaign(
        name="Sponsored Content - Decision Makers",
        status=CampaignStatus.ENABLED,
        budget=200.0,
        bid_strategy=BidStrategy.MANUAL_CPC,
        start_date=datetime.now(),
        end_date=datetime.now() + timedelta(days=30),
        platform_specific={
            'campaign_type': 'SPONSORED_CONTENT',
        },
    )

    created_campaign = linkedin.create_campaign(campaign)
    print(f"Created campaign: {created_campaign.name} (ID: {created_campaign.id})")

    # Create ad group
    ad_group = AdGroup(
        campaign_id=created_campaign.id,
        name="CTO Audience",
        status=CampaignStatus.ENABLED,
        default_bid=6.5,
        platform_specific={
            'targeting': Targeting(
                locations=['US'],
            ),
        },
    )

    created_ad_group = linkedin.create_ad_group(created_campaign.id, ad_group)
    print(f"Created ad group: {created_ad_group.name} (ID: {created_ad_group.id})")

    # Create ad
    ad = Ad(
        ad_group_id=created_ad_group.id,
        name="Single Image Ad",
        type="image",
        headline="Transform Your Business",
        description="See how industry leaders are using our platform",
        final_url="https://example.com/demo",
        call_to_action="contact_us",
    )

    created_ad = linkedin.create_ad(created_ad_group.id, ad)
    print(f"Created ad: {created_ad.name} (ID: {created_ad.id})")

    # Get performance
    performance = linkedin.get_performance(created_campaign.id)
    print(f"\nPerformance (last 30 days):")
    print(f"  Impressions: {performance.impressions:,}")
    print(f"  Clicks: {performance.clicks:,}")
    print(f"  Cost: ${performance.cost:.2f}")
    print(f"  Conversions: {performance.conversions}")
    print(f"  CPC: ${performance.cpc:.2f}")


def example_list_all_campaigns():
    """Example: List campaigns across all platforms."""
    print("\n=== Listing All Campaigns ===\n")

    # Load configuration from environment
    config = AdsIntegrationsConfig.from_env()

    # Google Ads
    if config.google_ads and config.google_ads.enabled:
        google = get_ads_platform('google', config.get_platform_config('google'))
        google.authenticate()
        campaigns = google.list_campaigns()
        print(f"Google Ads: {len(campaigns)} campaigns")
        for campaign in campaigns:
            print(f"  - {campaign.name}: {campaign.status.value} (${campaign.budget}/day)")

    # Meta Ads
    if config.meta_ads and config.meta_ads.enabled:
        meta = get_ads_platform('meta', config.get_platform_config('meta'))
        meta.authenticate()
        campaigns = meta.list_campaigns()
        print(f"\nMeta Ads: {len(campaigns)} campaigns")
        for campaign in campaigns:
            print(f"  - {campaign.name}: {campaign.status.value} (${campaign.budget}/day)")

    # LinkedIn Ads
    if config.linkedin_ads and config.linkedin_ads.enabled:
        linkedin = get_ads_platform('linkedin', config.get_platform_config('linkedin'))
        linkedin.authenticate()
        campaigns = linkedin.list_campaigns()
        print(f"\nLinkedIn Ads: {len(campaigns)} campaigns")
        for campaign in campaigns:
            print(f"  - {campaign.name}: {campaign.status.value} (${campaign.budget}/day)")


def example_optimize_campaign():
    """Example: Optimize campaign bids."""
    print("\n=== Campaign Optimization Example ===\n")

    config = {
        'access_token': 'your_access_token',
        'account_id': 'act_123456789',
    }

    meta = get_ads_platform('meta', config)
    meta.authenticate()

    # Assume we have a campaign ID
    campaign_id = "mc_123"

    # Get current suggestions
    suggestions = meta.get_optimization_suggestions(campaign_id)
    print(f"Current optimization suggestions: {len(suggestions)}")

    # Optimize bids
    result = meta.optimize_bids(campaign_id, BidStrategy.MAXIMIZE_CONVERSIONS)
    print(f"\nBid optimization result: {result['status']}")
    print(f"Message: {result['message']}")


def main():
    """Run all examples."""
    print("Advertising Platform Integrations - Example Usage")
    print("=" * 50)

    # Run examples (commented out - requires actual credentials)
    # example_google_ads()
    # example_meta_ads()
    # example_linkedin_ads()
    # example_list_all_campaigns()
    # example_optimize_campaign()

    print("\nNOTE: Examples require actual API credentials.")
    print("Edit this file and uncomment the examples you want to run.")
    print("\nTo get started:")
    print("1. Copy apps/backend/integrations/ads/.env.example to .env")
    print("2. Fill in your API credentials")
    print("3. Run: AdsIntegrationsConfig.from_env() to load config")


if __name__ == '__main__':
    main()
