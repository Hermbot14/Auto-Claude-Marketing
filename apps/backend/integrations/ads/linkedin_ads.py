"""
LinkedIn Ads platform integration.

This module provides integration with the LinkedIn Marketing API for managing
LinkedIn ad campaigns, ad groups, ads, and performance data.

API Reference: https://learn.microsoft.com/en-us/linkedin/marketing/
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

from .base import (
    AdsPlatform,
    Campaign,
    AdGroup,
    Ad,
    PerformanceMetrics,
    BidStrategy,
    CampaignStatus,
    AdStatus,
    Targeting,
    OptimizationSuggestion,
    AdsPlatformError,
    AuthenticationError,
    ValidationError,
)


logger = logging.getLogger(__name__)


class LinkedInAdsPlatform(AdsPlatform):
    """
    LinkedIn Ads platform integration.

    Supports:
    - Sponsored Content (feed ads)
    - Sponsored Messaging (InMail ads)
    - Text Ads
    - Dynamic Ads
    - Spotlight Ads
    """

    # LinkedIn Marketing API endpoint
    API_VERSION = "v2"
    BASE_URL = "https://api.linkedin.com/rest"

    # Campaign types
    CAMPAIGN_TYPES = {
        "sponsored_content": "SPONSORED_CONTENT",
        "sponsored_messaging": "SPONSORED_MESSAGING",
        "text_ad": "TEXT_AD",
        "dynamic_ad": "DYNAMIC_AD",
    }

    # Bid strategy mappings
    BID_STRATEGIES = {
        BidStrategy.MANUAL_CPC: "MANUAL",
        BidStrategy.MAXIMIZE_CLICKS: "AUTO",
        BidStrategy.MAXIMIZE_CONVERSIONS: "AUTO",
        BidStrategy.TARGET_CPA: "TARGET_COST",
        BidStrategy.TARGET_ROAS: "MAXIMUM_DELIVERY",
    }

    def __init__(self, config: Dict[str, Any]):
        """
        Initialize LinkedIn Ads platform.

        Required config keys:
        - access_token: OAuth access token
        - account_id: LinkedIn account ID (URN format: urn:li:sponsoredAccount:123456)

        Optional config keys:
        - client_id: OAuth client ID
        - client_secret: OAuth client secret
        - refresh_token: OAuth refresh token
        """
        super().__init__(config)

        if not self.access_token:
            raise ValidationError("access_token is required")
        if not self.account_id:
            raise ValidationError("account_id is required")

        # Ensure account_id is in URN format
        if not self.account_id.startswith("urn:li:sponsoredAccount:"):
            self.account_id = f"urn:li:sponsoredAccount:{self.account_id}"

        self._authenticated = False

    def authenticate(self) -> bool:
        """
        Authenticate with LinkedIn Marketing API.

        Returns:
            True if authentication successful

        Raises:
            AuthenticationError: If authentication fails
        """
        try:
            # Verify access token
            # In production: response = requests.get(
            #     f"{self.BASE_URL}/adAccounts",
            #     headers={"Authorization": f"Bearer {self.access_token}"}
            # )

            if not self.access_token:
                raise AuthenticationError("access_token is required for authentication")

            self._authenticated = True
            logger.info(f"Successfully authenticated with LinkedIn Ads for account {self.account_id}")
            return True

        except Exception as e:
            logger.error(f"LinkedIn Ads authentication failed: {str(e)}")
            raise AuthenticationError(f"Authentication failed: {str(e)}")

    def _ensure_authenticated(self):
        """Ensure authenticated before making API calls."""
        if not self._authenticated:
            raise AuthenticationError("Not authenticated. Call authenticate() first.")

    def create_campaign(self, campaign: Campaign) -> Campaign:
        """
        Create a new LinkedIn Ads campaign.

        Args:
            campaign: Campaign object with campaign details

        Returns:
            Created campaign with LinkedIn campaign ID

        Raises:
            ValidationError: If campaign data is invalid
        """
        self._ensure_authenticated()
        self._validate_required_fields(campaign, ['name', 'budget'])

        try:
            # Determine campaign type from platform_specific or default to sponsored content
            campaign_type = campaign.platform_specific.get('campaign_type', 'SPONSORED_CONTENT')

            # Build campaign payload
            campaign_payload = {
                "account": self.account_id,
                "name": campaign.name,
                "status": self._map_campaign_status(campaign.status),
                "type": campaign_type,
                "costType": "CPC",  # LinkedIn supports CPC, CPM, CPV
                "dailyBudget": {
                    "amount": str(campaign.budget),
                    "currencyCode": "USD"
                },
                "biddingStrategy": {
                    "type": self.BID_STRATEGIES.get(campaign.bid_strategy, "MANUAL")
                },
            }

            # Set start/end dates
            if campaign.start_date:
                campaign_payload["start"] = int(campaign.start_date.timestamp() * 1000)
            if campaign.end_date:
                campaign_payload["end"] = int(campaign.end_date.timestamp() * 1000)

            # Set target CPA/ROAS if applicable
            if campaign.target_cpa:
                campaign_payload["biddingStrategy"]["targetCost"] = {
                    "amount": str(campaign.target_cpa)
                }

            # In production, make API call:
            # response = requests.post(
            #     f"{self.BASE_URL}/adCampaigns",
            #     headers={
            #         "Authorization": f"Bearer {self.access_token}",
            #         "Content-Type": "application/json",
            #         "X-LinkedIn-Id": self.account_id
            #     },
            #     json=campaign_payload
            # )

            # Simulate API response
            simulated_id = f"li_{datetime.now().timestamp()}"
            campaign.id = simulated_id
            campaign.created_at = datetime.now()
            campaign.updated_at = datetime.now()

            logger.info(f"Created LinkedIn Ads campaign: {campaign.name} (ID: {campaign.id})")
            return campaign

        except Exception as e:
            logger.error(f"Failed to create campaign: {str(e)}")
            raise AdsPlatformError(f"Failed to create campaign: {str(e)}")

    def get_campaign(self, campaign_id: str) -> Optional[Campaign]:
        """
        Get a campaign by ID.

        Args:
            campaign_id: LinkedIn campaign ID or URN

        Returns:
            Campaign object or None if not found
        """
        self._ensure_authenticated()

        try:
            # Convert ID to URN format if needed
            campaign_urn = campaign_id if campaign_id.startswith("urn:li:sponsoredCampaign:") else f"urn:li:sponsoredCampaign:{campaign_id}"

            # In production, make API call:
            # response = requests.get(
            #     f"{self.BASE_URL}/adCampaigns/{campaign_urn}",
            #     headers={"Authorization": f"Bearer {self.access_token}"}
            # )

            # Simulate campaign retrieval
            if campaign_id.startswith("li_") or "sponsoredCampaign" in campaign_id:
                return Campaign(
                    id=campaign_id,
                    name="Sample LinkedIn Campaign",
                    status=CampaignStatus.ENABLED,
                    budget=200.0,
                    bid_strategy=BidStrategy.MANUAL_CPC,
                    created_at=datetime.now() - timedelta(days=30),
                    updated_at=datetime.now(),
                    platform_specific={'campaign_type': 'SPONSORED_CONTENT'}
                )

            return None

        except Exception as e:
            logger.error(f"Failed to get campaign {campaign_id}: {str(e)}")
            return None

    def list_campaigns(self, status: Optional[CampaignStatus] = None) -> List[Campaign]:
        """
        List all campaigns.

        Args:
            status: Filter by status (optional)

        Returns:
            List of campaigns
        """
        self._ensure_authenticated()

        try:
            # In production, make API call:
            # response = requests.get(
            #     f"{self.BASE_URL}/adCampaigns",
            #     headers={"Authorization": f"Bearer {self.access_token}"},
            #     params={"search": f"account:(values:(id:{self.account_id}))"}
            # )

            # Simulate campaign list
            campaigns = [
                Campaign(
                    id="li_1",
                    name="Sponsored Content - Decision Makers",
                    status=CampaignStatus.ENABLED,
                    budget=150.0,
                    bid_strategy=BidStrategy.MANUAL_CPC,
                    created_at=datetime.now() - timedelta(days=60),
                    updated_at=datetime.now(),
                    platform_specific={'campaign_type': 'SPONSORED_CONTENT'}
                ),
                Campaign(
                    id="li_2",
                    name="Sponsored Messaging - Lead Gen",
                    status=CampaignStatus.ENABLED,
                    budget=100.0,
                    bid_strategy=BidStrategy.TARGET_CPA,
                    target_cpa=35.0,
                    created_at=datetime.now() - timedelta(days=45),
                    updated_at=datetime.now(),
                    platform_specific={'campaign_type': 'SPONSORED_MESSAGING'}
                ),
                Campaign(
                    id="li_3",
                    name="Text Ads - Brand Awareness",
                    status=CampaignStatus.PAUSED,
                    budget=75.0,
                    bid_strategy=BidStrategy.MAXIMIZE_CLICKS,
                    created_at=datetime.now() - timedelta(days=30),
                    updated_at=datetime.now(),
                    platform_specific={'campaign_type': 'TEXT_AD'}
                ),
            ]

            if status:
                campaigns = [c for c in campaigns if c.status == status]

            return campaigns

        except Exception as e:
            logger.error(f"Failed to list campaigns: {str(e)}")
            return []

    def update_campaign(self, campaign_id: str, updates: Dict[str, Any]) -> Campaign:
        """
        Update a campaign.

        Args:
            campaign_id: LinkedIn campaign ID
            updates: Dict of fields to update

        Returns:
            Updated campaign
        """
        self._ensure_authenticated()

        try:
            # Convert ID to URN format
            campaign_urn = campaign_id if campaign_id.startswith("urn:li:sponsoredCampaign:") else f"urn:li:sponsoredCampaign:{campaign_id}"

            # Build update payload
            update_payload = {"patch": {}}
            for key, value in updates.items():
                if key == 'budget':
                    update_payload["patch"]["dailyBudget"] = {
                        "amount": str(value),
                        "currencyCode": "USD"
                    }
                elif key == 'status':
                    update_payload["patch"]["status"] = self._map_campaign_status(value)
                elif key == 'name':
                    update_payload["patch"]["name"] = value

            # In production, make API call:
            # response = requests.post(
            #     f"{self.BASE_URL}/adCampaigns/{campaign_urn}",
            #     headers={
            #         "Authorization": f"Bearer {self.access_token}",
            #         "Content-Type": "application/json",
            #         "X-LinkedIn-Id": self.account_id
            #     },
            #     json=update_payload
            # )

            campaign = self.get_campaign(campaign_id)
            if campaign:
                for key, value in updates.items():
                    if hasattr(campaign, key):
                        setattr(campaign, key, value)
                campaign.updated_at = datetime.now()

            logger.info(f"Updated campaign {campaign_id}")
            return campaign or Campaign(id=campaign_id, **updates)

        except Exception as e:
            logger.error(f"Failed to update campaign {campaign_id}: {str(e)}")
            raise AdsPlatformError(f"Failed to update campaign: {str(e)}")

    def delete_campaign(self, campaign_id: str) -> bool:
        """
        Delete a campaign.

        Args:
            campaign_id: LinkedIn campaign ID

        Returns:
            True if successful
        """
        self._ensure_authenticated()

        try:
            # Convert ID to URN format
            campaign_urn = campaign_id if campaign_id.startswith("urn:li:sponsoredCampaign:") else f"urn:li:sponsoredCampaign:{campaign_id}"

            # In production, make API call:
            # response = requests.delete(
            #     f"{self.BASE_URL}/adCampaigns/{campaign_urn}",
            #     headers={
            #         "Authorization": f"Bearer {self.access_token}",
            #         "X-LinkedIn-Id": self.account_id
            #     }
            # )

            logger.info(f"Deleted campaign {campaign_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete campaign {campaign_id}: {str(e)}")
            return False

    def create_ad_group(self, campaign_id: str, ad_group: AdGroup) -> AdGroup:
        """
        Create a new ad group (LinkedIn calls them "Creatives" or "Campaign Groups").

        Args:
            campaign_id: Campaign ID
            ad_group: AdGroup object

        Returns:
            Created ad group with ID assigned
        """
        self._ensure_authenticated()
        self._validate_required_fields(ad_group, ['name'])

        try:
            # Convert campaign ID to URN
            campaign_urn = campaign_id if campaign_id.startswith("urn:li:sponsoredCampaign:") else f"urn:li:sponsoredCampaign:{campaign_id}"

            # Build creative (ad group) payload
            creative_payload = {
                "account": self.account_id,
                "campaign": campaign_urn,
                "status": self._map_campaign_status(ad_group.status),
                "type": "SPONSORED_CONTENT",  # Default to sponsored content
            }

            # Set up targeting if provided
            if ad_group.platform_specific.get('targeting'):
                creative_payload["targeting"] = self._build_targeting(ad_group.platform_specific.get('targeting'))

            # In production, make API call:
            # response = requests.post(
            #     f"{self.BASE_URL}/adCreatives",
            #     headers={
            #         "Authorization": f"Bearer {self.access_token}",
            #         "Content-Type": "application/json",
            #         "X-LinkedIn-Id": self.account_id
            #     },
            #     json=creative_payload
            # )

            ad_group.id = f"lic_{datetime.now().timestamp()}"
            ad_group.campaign_id = campaign_id
            ad_group.created_at = datetime.now()
            ad_group.updated_at = datetime.now()

            logger.info(f"Created ad group: {ad_group.name} (ID: {ad_group.id})")
            return ad_group

        except Exception as e:
            logger.error(f"Failed to create ad group: {str(e)}")
            raise AdsPlatformError(f"Failed to create ad group: {str(e)}")

    def get_ad_group(self, ad_group_id: str) -> Optional[AdGroup]:
        """
        Get an ad group by ID.

        Args:
            ad_group_id: LinkedIn creative ID or URN

        Returns:
            AdGroup object or None if not found
        """
        self._ensure_authenticated()

        try:
            # In production, make API call
            if ad_group_id.startswith("lic_") or "sponsoredCreative" in ad_group_id:
                return AdGroup(
                    id=ad_group_id,
                    campaign_id="li_1",
                    name="Sample Ad Group",
                    status=CampaignStatus.ENABLED,
                    default_bid=5.0,
                    created_at=datetime.now() - timedelta(days=30),
                    updated_at=datetime.now(),
                )
            return None

        except Exception as e:
            logger.error(f"Failed to get ad group {ad_group_id}: {str(e)}")
            return None

    def list_ad_groups(self, campaign_id: str) -> List[AdGroup]:
        """
        List ad groups in a campaign.

        Args:
            campaign_id: Campaign ID

        Returns:
            List of ad groups
        """
        self._ensure_authenticated()

        try:
            # In production, make API call
            return [
                AdGroup(
                    id="lic_1",
                    campaign_id=campaign_id,
                    name="CTO Audience",
                    status=CampaignStatus.ENABLED,
                    default_bid=6.5,
                    created_at=datetime.now() - timedelta(days=30),
                    updated_at=datetime.now(),
                ),
                AdGroup(
                    id="lic_2",
                    campaign_id=campaign_id,
                    name="VP Engineering",
                    status=CampaignStatus.ENABLED,
                    default_bid=7.0,
                    created_at=datetime.now() - timedelta(days=25),
                    updated_at=datetime.now(),
                ),
            ]

        except Exception as e:
            logger.error(f"Failed to list ad groups: {str(e)}")
            return []

    def create_ad(self, ad_group_id: str, ad: Ad) -> Ad:
        """
        Create a new ad (LinkedIn calls them "Creatives").

        Args:
            ad_group_id: Ad group (creative) ID
            ad: Ad object

        Returns:
            Created ad with ID assigned
        """
        self._ensure_authenticated()
        self._validate_required_fields(ad, ['headline', 'description'])

        try:
            # Build creative payload based on ad type
            creative_payload = {
                "account": self.account_id,
                "status": self._map_ad_status(ad.status),
                "type": "SPONSORED_CONTENT",
                "variables": {
                    "data": {
                        "com.linkedin.ads.SponsoredContentCreative": {
                            "headline": ad.headline,
                            "description": ad.description,
                            "landingUrl": ad.final_url,
                            "directSharingEnabled": False,
                        }
                    }
                }
            }

            # Add media if image or video ad
            if ad.type == "image" and ad.creative_asset_id:
                creative_payload["variables"]["data"]["com.linkedin.ads.SponsoredContentCreative"]["media"] = {
                    "media": ad.creative_asset_id
                }
            elif ad.type == "video" and ad.creative_asset_id:
                creative_payload["variables"]["data"]["com.linkedin.ads.SponsoredContentCreative"]["video"] = {
                    "video": ad.creative_asset_id
                }

            # Add call to action if specified
            if ad.call_to_action:
                cta_map = {
                    "learn_more": "VISIT_WEBSITE",
                    "sign_up": "SIGN_UP",
                    "contact_us": "CONTACT_US",
                    "get_quote": "GET_QUOTE",
                }
                cta = cta_map.get(ad.call_to_action.lower(), "VISIT_WEBSITE")
                creative_payload["variables"]["data"]["com.linkedin.ads.SponsoredContentCreative"]["callToAction"] = {
                    "type": cta
                }

            # In production, make API call:
            # response = requests.post(
            #     f"{self.BASE_URL}/adCreatives",
            #     headers={
            #         "Authorization": f"Bearer {self.access_token}",
            #         "Content-Type": "application/json",
            #         "X-LinkedIn-Id": self.account_id
            #     },
            #     json=creative_payload
            # )

            ad.id = f"lia_{datetime.now().timestamp()}"
            ad.ad_group_id = ad_group_id
            ad.created_at = datetime.now()
            ad.updated_at = datetime.now()

            logger.info(f"Created ad: {ad.name} (ID: {ad.id})")
            return ad

        except Exception as e:
            logger.error(f"Failed to create ad: {str(e)}")
            raise AdsPlatformError(f"Failed to create ad: {str(e)}")

    def get_ad(self, ad_id: str) -> Optional[Ad]:
        """
        Get an ad by ID.

        Args:
            ad_id: LinkedIn creative ID or URN

        Returns:
            Ad object or None if not found
        """
        self._ensure_authenticated()

        try:
            # In production, make API call
            if ad_id.startswith("lia_") or "sponsoredCreative" in ad_id:
                return Ad(
                    id=ad_id,
                    ad_group_id="lic_1",
                    name="Sample LinkedIn Ad",
                    status=AdStatus.ENABLED,
                    type="text",
                    headline="Transform Your Business",
                    description="Learn how our solution can help",
                    final_url="https://example.com",
                    created_at=datetime.now() - timedelta(days=30),
                    updated_at=datetime.now(),
                )
            return None

        except Exception as e:
            logger.error(f"Failed to get ad {ad_id}: {str(e)}")
            return None

    def list_ads(self, ad_group_id: str) -> List[Ad]:
        """
        List ads in an ad group.

        Args:
            ad_group_id: Ad group ID

        Returns:
            List of ads
        """
        self._ensure_authenticated()

        try:
            # In production, make API call
            return [
                Ad(
                    id="lia_1",
                    ad_group_id=ad_group_id,
                    name="Single Image Ad",
                    status=AdStatus.ENABLED,
                    type="image",
                    headline="Join Industry Leaders",
                    description="See why top companies choose us",
                    final_url="https://example.com/demo",
                    created_at=datetime.now() - timedelta(days=30),
                    updated_at=datetime.now(),
                ),
                Ad(
                    id="lia_2",
                    ad_group_id=ad_group_id,
                    name="Carousel Ad",
                    status=AdStatus.ENABLED,
                    type="carousel",
                    headline="5 Ways to Improve",
                    description="Discover our best practices",
                    final_url="https://example.com/guide",
                    created_at=datetime.now() - timedelta(days=20),
                    updated_at=datetime.now(),
                ),
            ]

        except Exception as e:
            logger.error(f"Failed to list ads: {str(e)}")
            return []

    def get_performance(
        self,
        campaign_id: Optional[str] = None,
        ad_group_id: Optional[str] = None,
        ad_id: Optional[str] = None,
        date_range: str = "last_30_days",
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> PerformanceMetrics:
        """
        Get performance metrics.

        Args:
            campaign_id: Campaign ID (optional)
            ad_group_id: Ad group ID (optional)
            ad_id: Ad ID (optional)
            date_range: Predefined date range
            start_date: Custom start date
            end_date: Custom end date

        Returns:
            PerformanceMetrics object
        """
        self._ensure_authenticated()

        try:
            # Parse date range
            if not start_date:
                days_map = {
                    "last_7_days": 7,
                    "last_30_days": 30,
                    "last_90_days": 90,
                }
                days = days_map.get(date_range, 30)
                start_date = datetime.now() - timedelta(days=days)
            if not end_date:
                end_date = datetime.now()

            # In production, make API call:
            # response = requests.get(
            #     f"{self.BASE_URL}/adAnalytics",
            #     headers={"Authorization": f"Bearer {self.access_token}"},
            #     params={
            #         "campaign": f"urn:li:sponsoredCampaign:{campaign_id}" if campaign_id else None,
            #         "creative": f"urn:li:sponsoredCreative:{ad_group_id}" if ad_group_id else None,
            #         "pivot": "CAMPAIGN",
            #         "dateRange": f"start:{int(start_date.timestamp() * 1000)},end:{int(end_date.timestamp() * 1000)}",
            #         "timeGranularity": "ALL",
            #         "fields": "impressions,clicks,costInUsd,conversions,conversionValueInUsd"
            #     }
            # )

            # Simulate metrics - LinkedIn typically has higher CPC but higher quality leads
            metrics = PerformanceMetrics(
                campaign_id=campaign_id or "",
                ad_group_id=ad_group_id,
                ad_id=ad_id,
                date_range=date_range,
                impressions=12_580,
                clicks=643,
                cost=2_572.00,
                conversions=47,
                conversion_value=9_400.0,
                start_date=start_date,
                end_date=end_date,
            )
            metrics.calculate_metrics()

            return metrics

        except Exception as e:
            logger.error(f"Failed to get performance: {str(e)}")
            return PerformanceMetrics(campaign_id=campaign_id or "")

    def optimize_bids(self, campaign_id: str, strategy: BidStrategy) -> Dict[str, Any]:
        """
        Optimize bids for a campaign.

        Args:
            campaign_id: Campaign ID
            strategy: Bid strategy to apply

        Returns:
            Dict with optimization results
        """
        self._ensure_authenticated()

        try:
            # Update campaign bid strategy
            bid_strategy = self.BID_STRATEGIES.get(strategy, "MANUAL")
            self.update_campaign(campaign_id, {
                "bidding_strategy": bid_strategy
            })

            return {
                "campaign_id": campaign_id,
                "new_strategy": strategy.value,
                "linkedin_strategy": bid_strategy,
                "status": "success",
                "message": f"Bid strategy updated to {strategy.value}",
            }

        except Exception as e:
            logger.error(f"Failed to optimize bids: {str(e)}")
            return {
                "campaign_id": campaign_id,
                "status": "error",
                "message": str(e),
            }

    def get_optimization_suggestions(self, campaign_id: str) -> List[OptimizationSuggestion]:
        """
        Get optimization suggestions for a campaign.

        Args:
            campaign_id: Campaign ID

        Returns:
            List of optimization suggestions
        """
        self._ensure_authenticated()

        # Get performance data
        performance = self.get_performance(campaign_id)

        suggestions = []

        # LinkedIn-specific: Analyze CTR (LinkedIn typically has lower CTR)
        if performance.ctr < 0.5:
            suggestions.append(OptimizationSuggestion(
                type="creative",
                priority="high",
                title="Low Click-Through Rate",
                description=f"Your CTR of {performance.ctr:.2f}% is below LinkedIn's 0.5% benchmark.",
                expected_impact="Improve CTR by 0.1-0.3%",
                action_items=[
                    "Use native document ads (PDFs perform well)",
                    "Add lead gen forms for lower friction",
                    "Test carousel ads with multiple value props",
                    "Include clear calls-to-action in first sentence",
                ],
                current_value=f"{performance.ctr:.2f}%",
                suggested_value="0.6-0.8%",
            ))

        # LinkedIn-specific: CPC is typically higher but leads are higher quality
        if performance.cpc > 8.0:
            suggestions.append(OptimizationSuggestion(
                type="targeting",
                priority="medium",
                title="High Cost Per Click",
                description=f"Your CPC of ${performance.cpc:.2f} is high for LinkedIn.",
                expected_impact="Reduce CPC by 15-25%",
                action_items=[
                    "Narrow audience targeting (seniority, function)",
                    "Exclude job functions that don't convert",
                    "Use matched audiences (website retargeting)",
                    "Test different ad formats (video vs. image)",
                ],
                current_value=f"${performance.cpc:.2f}",
                suggested_value="$6.00-$7.00",
            ))

        # Analyze conversion metrics
        if performance.conversions > 0:
            cost_per_conversion = performance.cost / performance.conversions
            if cost_per_conversion > 80.0:
                suggestions.append(OptimizationSuggestion(
                    type="creative",
                    priority="high",
                    title="High Cost Per Conversion",
                    description=f"Your cost per conversion of ${cost_per_conversion:.2f} is high.",
                    expected_impact="Reduce CPA by 20-40%",
                    action_items=[
                        "Use LinkedIn Lead Gen Forms (lower friction)",
                        "Offer valuable content (whitepapers, webinars)",
                        "Test document ads for downloads",
                        "Improve landing page for mobile",
                    ],
                    current_value=f"${cost_per_conversion:.2f}",
                    suggested_value="$48-$64",
                ))

        # LinkedIn-specific: Analyze conversion value
        if performance.conversion_value > 0 and performance.roas < 3.0:
            suggestions.append(OptimizationSuggestion(
                type="targeting",
                priority="medium",
                title="Improve Return on Ad Spend",
                description=f"ROAS of {performance.roas:.2f}x needs improvement for B2B.",
                expected_impact="Improve ROAS to 4-6x",
                action_items=[
                    "Target higher-value job titles (Director+)",
                    "Focus on enterprise companies (1000+ employees)",
                    "Use account-based marketing targeting",
                    "Retarget website visitors with high intent",
                ],
                current_value=f"{performance.roas:.2f}x",
                suggested_value="4-6x",
            ))

        # LinkedIn-specific: Frequency capping
        if performance.impressions > 50_000:
            suggestions.append(OptimizationSuggestion(
                type="creative",
                priority="low",
                title="Consider Frequency Capping",
                description="High impression count suggests potential audience fatigue.",
                expected_impact="Maintain engagement quality",
                action_items=[
                    "Set frequency cap to 2-3 impressions per week",
                    "Refresh creative with new messaging",
                    "Expand audience to new segments",
                ],
            ))

        return suggestions

    def _map_campaign_status(self, status: CampaignStatus) -> str:
        """Map campaign status to LinkedIn enum."""
        status_map = {
            CampaignStatus.ENABLED: "ACTIVE",
            CampaignStatus.PAUSED: "PAUSED",
            CampaignStatus.REMOVED: "REMOVED",
        }
        return status_map.get(status, "PAUSED")

    def _map_ad_status(self, status: AdStatus) -> str:
        """Map ad status to LinkedIn enum."""
        status_map = {
            AdStatus.ENABLED: "ACTIVE",
            AdStatus.PAUSED: "PAUSED",
            AdStatus.DISABLED: "ARCHIVED",
        }
        return status_map.get(status, "PAUSED")

    def _build_targeting(self, targeting: Optional[Targeting]) -> Dict:
        """Build LinkedIn targeting spec from Targeting object."""
        if not targeting:
            return {}

        targeting_spec = {}

        # LinkedIn targeting uses URNs for many entities
        if targeting.locations:
            targeting_spec['locations'] = [
                {"location": f"urn:li:country:{country}"}
                for country in targeting.locations
            ]

        if targeting.age_range:
            targeting_spec['ageRange'] = {
                "start": targeting.age_range.get('min', 18),
                "end": targeting.age_range.get('max', 65)
            }

        if targeting.genders:
            gender_map = {'male': 'MALE', 'female': 'FEMALE', 'other': 'OTHER'}
            targeting_spec['genders'] = [
                {"gender": gender_map.get(g, 'OTHER')}
                for g in targeting.genders
            ]

        if targeting.platform_specific and targeting.platform_specific.get('job_functions'):
            # LinkedIn-specific: Job functions
            targeting_spec['jobFunctions'] = [
                {"jobFunction": f"urn:li:jobFunction:{jf}"}
                for jf in targeting.platform_specific['job_functions']
            ]

        if targeting.platform_specific and targeting.platform_specific.get('seniorities'):
            # LinkedIn-specific: Seniority levels
            targeting_spec['seniorities'] = [
                {"seniority": f"urn:li:seniority:{s}"}
                for s in targeting.platform_specific['seniorities']
            ]

        if targeting.platform_specific and targeting.platform_specific.get('industries'):
            # LinkedIn-specific: Industries
            targeting_spec['industries'] = [
                {"industry": f"urn:li:industry:{ind}"}
                for ind in targeting.platform_specific['industries']
            ]

        return targeting_spec
