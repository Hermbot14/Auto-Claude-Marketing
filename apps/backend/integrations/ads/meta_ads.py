"""
Meta Ads platform integration (Facebook & Instagram).

This module provides integration with the Meta Marketing API for managing
Facebook and Instagram ad campaigns, ad sets, ads, and performance data.

API Reference: https://developers.facebook.com/docs/marketing-apis/
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


class MetaAdsPlatform(AdsPlatform):
    """
    Meta Ads platform integration (Facebook & Instagram).

    Supports:
    - Facebook Feed ads
    - Instagram Feed ads
    - Instagram Stories ads
    - Facebook Stories ads
    - Facebook Reels ads
    - Instagram Reels ads
    - Messenger ads
    - Audience Network ads
    """

    # Meta Marketing API endpoint
    API_VERSION = "v19.0"
    BASE_URL = f"https://graph.facebook.com/{API_VERSION}"

    # Campaign objectives
    OBJECTIVES = {
        "awareness": "BRAND_AWARENESS",
        "traffic": "TRAFFIC",
        "engagement": "ENGAGEMENT",
        "leads": "LEADS",
        "app_promotion": "APP_INSTALLS",
        "sales": "CONVERSIONS",
        "store_visits": "STORE_VISITS",
    }

    # Bid strategy mappings
    BID_STRATEGIES = {
        BidStrategy.MANUAL_CPC: "LOWEST_COST_WITHOUT_CAP",
        BidStrategy.MAXIMIZE_CLICKS: "LOWEST_COST_WITH_BID_CAP",
        BidStrategy.MAXIMIZE_CONVERSIONS: "LOWEST_COST_WITHOUT_CAP",
        BidStrategy.TARGET_CPA: "TARGET_COST",
        BidStrategy.TARGET_ROAS: "LOWEST_COST_WITH_BID_CAP",
    }

    def __init__(self, config: Dict[str, Any]):
        """
        Initialize Meta Ads platform.

        Required config keys:
        - access_token: Page access token or System user access token
        - account_id: Ad account ID (format: act_123456789)

        Optional config keys:
        - app_id: Facebook App ID
        - app_secret: Facebook App Secret
        - business_id: Business ID for Business Manager accounts
        """
        super().__init__(config)

        if not self.access_token:
            raise ValidationError("access_token is required")
        if not self.account_id:
            raise ValidationError("account_id is required")

        # Ensure account_id has act_ prefix
        if not self.account_id.startswith("act_"):
            self.account_id = f"act_{self.account_id}"

        self._authenticated = False

    def authenticate(self) -> bool:
        """
        Authenticate with Meta Marketing API.

        Returns:
            True if authentication successful

        Raises:
            AuthenticationError: If authentication fails
        """
        try:
            # Verify access token by making a test request
            # In production: response = requests.get(f"{self.BASE_URL}/me", params={"access_token": self.access_token})

            if not self.access_token:
                raise AuthenticationError("access_token is required for authentication")

            self._authenticated = True
            logger.info(f"Successfully authenticated with Meta Ads for account {self.account_id}")
            return True

        except Exception as e:
            logger.error(f"Meta Ads authentication failed: {str(e)}")
            raise AuthenticationError(f"Authentication failed: {str(e)}")

    def _ensure_authenticated(self):
        """Ensure authenticated before making API calls."""
        if not self._authenticated:
            raise AuthenticationError("Not authenticated. Call authenticate() first.")

    def create_campaign(self, campaign: Campaign) -> Campaign:
        """
        Create a new Meta Ads campaign.

        Args:
            campaign: Campaign object with campaign details

        Returns:
            Created campaign with Meta campaign ID

        Raises:
            ValidationError: If campaign data is invalid
        """
        self._ensure_authenticated()
        self._validate_required_fields(campaign, ['name', 'budget'])

        try:
            # Determine objective from platform_specific or default to CONVERSIONS
            objective = campaign.platform_specific.get('objective', 'CONVERSIONS')

            # Build campaign payload
            campaign_payload = {
                "name": campaign.name,
                "objective": objective,
                "status": self._map_campaign_status(campaign.status),
                "special_ad_categories": [],
                "daily_budget": int(campaign.budget * 100),  # Meta uses cents (multiply by 100)
                "bid_strategy": self.BID_STRATEGIES.get(campaign.bid_strategy, "LOWEST_COST_WITHOUT_CAP"),
            }

            # Set start/end dates
            if campaign.start_date:
                campaign_payload["start_time"] = campaign.start_date.isoformat()
            if campaign.end_date:
                campaign_payload["end_time"] = campaign.end_date.isoformat()

            # Set spending limit (lifetime budget)
            if campaign.budget_type == "lifetime":
                campaign_payload["lifetime_budget"] = int(campaign.budget * 100)
                campaign_payload.pop("daily_budget", None)

            # Set bid cap if specified
            if campaign.platform_specific.get('bid_cap'):
                campaign_payload["bid_amount"] = int(campaign.platform_specific['bid_cap'] * 100)

            # In production, make API call:
            # response = requests.post(
            #     f"{self.BASE_URL}/{self.account_id}/campaigns",
            #     params={"access_token": self.access_token},
            #     data=campaign_payload
            # )

            # Simulate API response
            simulated_id = f"mc_{datetime.now().timestamp()}"
            campaign.id = simulated_id
            campaign.created_at = datetime.now()
            campaign.updated_at = datetime.now()

            logger.info(f"Created Meta Ads campaign: {campaign.name} (ID: {campaign.id})")
            return campaign

        except Exception as e:
            logger.error(f"Failed to create campaign: {str(e)}")
            raise AdsPlatformError(f"Failed to create campaign: {str(e)}")

    def get_campaign(self, campaign_id: str) -> Optional[Campaign]:
        """
        Get a campaign by ID.

        Args:
            campaign_id: Meta campaign ID

        Returns:
            Campaign object or None if not found
        """
        self._ensure_authenticated()

        try:
            # In production, make API call:
            # response = requests.get(
            #     f"{self.BASE_URL}/{campaign_id}",
            #     params={
            #         "access_token": self.access_token,
            #         "fields": "id,name,status,daily_budget,lifetime_budget,bid_strategy,objective,start_time,end_time"
            #     }
            # )

            # Simulate campaign retrieval
            if campaign_id.startswith("mc_"):
                return Campaign(
                    id=campaign_id,
                    name="Sample Meta Campaign",
                    status=CampaignStatus.ENABLED,
                    budget=50.0,
                    bid_strategy=BidStrategy.MAXIMIZE_CONVERSIONS,
                    created_at=datetime.now() - timedelta(days=30),
                    updated_at=datetime.now(),
                    platform_specific={'objective': 'CONVERSIONS'}
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
            #     f"{self.BASE_URL}/{self.account_id}/campaigns",
            #     params={
            #         "access_token": self.access_token,
            #         "fields": "id,name,status,daily_budget,bid_strategy,objective",
            #         "filtering": f"[{{'field':'status','operator':'EQUAL','value':'{self._map_campaign_status(status)}'}}]" if status else None
            #     }
            # )

            # Simulate campaign list
            campaigns = [
                Campaign(
                    id="mc_1",
                    name="Instagram Stories - Brand Awareness",
                    status=CampaignStatus.ENABLED,
                    budget=25.0,
                    bid_strategy=BidStrategy.MAXIMIZE_CLICKS,
                    created_at=datetime.now() - timedelta(days=45),
                    updated_at=datetime.now(),
                    platform_specific={'objective': 'BRAND_AWARENESS'}
                ),
                Campaign(
                    id="mc_2",
                    name="Facebook Feed - Conversions",
                    status=CampaignStatus.ENABLED,
                    budget=100.0,
                    bid_strategy=BidStrategy.TARGET_CPA,
                    target_cpa=15.0,
                    created_at=datetime.now() - timedelta(days=30),
                    updated_at=datetime.now(),
                    platform_specific={'objective': 'CONVERSIONS'}
                ),
                Campaign(
                    id="mc_3",
                    name="Instagram Reels - Engagement",
                    status=CampaignStatus.PAUSED,
                    budget=35.0,
                    bid_strategy=BidStrategy.MAXIMIZE_CONVERSIONS,
                    created_at=datetime.now() - timedelta(days=20),
                    updated_at=datetime.now(),
                    platform_specific={'objective': 'ENGAGEMENT'}
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
            campaign_id: Meta campaign ID
            updates: Dict of fields to update

        Returns:
            Updated campaign
        """
        self._ensure_authenticated()

        try:
            # Convert budget to cents
            if 'budget' in updates:
                updates['daily_budget'] = int(updates.pop('budget') * 100)

            # In production, make API call:
            # response = requests.post(
            #     f"{self.BASE_URL}/{campaign_id}",
            #     params={"access_token": self.access_token},
            #     data=updates
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

        Note: Meta doesn't allow deletion, only archiving.

        Args:
            campaign_id: Meta campaign ID

        Returns:
            True if successful
        """
        self._ensure_authenticated()

        try:
            # Archive instead of delete
            self.update_campaign(campaign_id, {"status": "ARCHIVED"})

            logger.info(f"Archived campaign {campaign_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to archive campaign {campaign_id}: {str(e)}")
            return False

    def create_ad_group(self, campaign_id: str, ad_group: AdGroup) -> AdGroup:
        """
        Create a new ad set (Meta equivalent of ad group).

        Args:
            campaign_id: Campaign ID
            ad_group: AdGroup object

        Returns:
            Created ad group with ID assigned
        """
        self._ensure_authenticated()
        self._validate_required_fields(ad_group, ['name'])

        try:
            ad_set_payload = {
                "name": ad_group.name,
                "campaign_id": campaign_id,
                "status": self._map_campaign_status(ad_group.status),
                "daily_budget": int(ad_group.default_bid * 100) if ad_group.default_bid else int(ad_group.default_bid * 100),
                "optimization_goal": ad_group.platform_specific.get('optimization_goal', 'IMPRESSIONS'),
                "billing_event": ad_group.platform_specific.get('billing_event', 'IMPRESSIONS'),
                "targeting": self._build_targeting(ad_group.platform_specific.get('targeting')),
            }

            # In production, make API call:
            # response = requests.post(
            #     f"{self.BASE_URL}/{self.account_id}/adsets",
            #     params={"access_token": self.access_token},
            #     data=ad_set_payload
            # )

            ad_group.id = f"mas_{datetime.now().timestamp()}"
            ad_group.campaign_id = campaign_id
            ad_group.created_at = datetime.now()
            ad_group.updated_at = datetime.now()

            logger.info(f"Created ad set: {ad_group.name} (ID: {ad_group.id})")
            return ad_group

        except Exception as e:
            logger.error(f"Failed to create ad set: {str(e)}")
            raise AdsPlatformError(f"Failed to create ad set: {str(e)}")

    def get_ad_group(self, ad_group_id: str) -> Optional[AdGroup]:
        """
        Get an ad set by ID.

        Args:
            ad_group_id: Meta ad set ID

        Returns:
            AdGroup object or None if not found
        """
        self._ensure_authenticated()

        try:
            # In production, make API call
            if ad_group_id.startswith("mas_"):
                return AdGroup(
                    id=ad_group_id,
                    campaign_id="mc_1",
                    name="Sample Ad Set",
                    status=CampaignStatus.ENABLED,
                    default_bid=10.0,
                    created_at=datetime.now() - timedelta(days=30),
                    updated_at=datetime.now(),
                    platform_specific={
                        'optimization_goal': 'CONVERSIONS',
                        'billing_event': 'IMPRESSIONS'
                    }
                )
            return None

        except Exception as e:
            logger.error(f"Failed to get ad set {ad_group_id}: {str(e)}")
            return None

    def list_ad_groups(self, campaign_id: str) -> List[AdGroup]:
        """
        List ad sets in a campaign.

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
                    id="mas_1",
                    campaign_id=campaign_id,
                    name="US - 18-34",
                    status=CampaignStatus.ENABLED,
                    default_bid=15.0,
                    created_at=datetime.now() - timedelta(days=30),
                    updated_at=datetime.now(),
                    platform_specific={
                        'optimization_goal': 'CONVERSIONS',
                        'billing_event': 'IMPRESSIONS'
                    }
                ),
                AdGroup(
                    id="mas_2",
                    campaign_id=campaign_id,
                    name="EU - 25-45",
                    status=CampaignStatus.ENABLED,
                    default_bid=12.0,
                    created_at=datetime.now() - timedelta(days=25),
                    updated_at=datetime.now(),
                    platform_specific={
                        'optimization_goal': 'IMPRESSIONS',
                        'billing_event': 'IMPRESSIONS'
                    }
                ),
            ]

        except Exception as e:
            logger.error(f"Failed to list ad sets: {str(e)}")
            return []

    def create_ad(self, ad_group_id: str, ad: Ad) -> Ad:
        """
        Create a new ad.

        Args:
            ad_group_id: Ad set ID
            ad: Ad object

        Returns:
            Created ad with ID assigned
        """
        self._ensure_authenticated()
        self._validate_required_fields(ad, ['name', 'final_url'])

        try:
            # Build creative spec based on ad type
            if ad.type == "image":
                creative_spec = {
                    "object_story_spec": {
                        "page_id": ad.platform_specific.get('page_id'),
                        "link_data": {
                            "image_hash": ad.creative_asset_id,
                            "link": ad.final_url,
                            "message": ad.description,
                            "call_to_action": {"type": ad.call_to_action or "LEARN_MORE"}
                        }
                    }
                }
            elif ad.type == "video":
                creative_spec = {
                    "object_story_spec": {
                        "page_id": ad.platform_specific.get('page_id'),
                        "video_data": {
                            "video_id": ad.creative_asset_id,
                            "link": ad.final_url,
                            "message": ad.description,
                            "call_to_action": {"type": ad.call_to_action or "LEARN_MORE"}
                        }
                    }
                }
            else:  # text or carousel
                creative_spec = {
                    "object_story_spec": {
                        "page_id": ad.platform_specific.get('page_id'),
                        "link_data": {
                            "link": ad.final_url,
                            "message": f"{ad.headline}\n\n{ad.description}",
                            "call_to_action": {"type": ad.call_to_action or "LEARN_MORE"}
                        }
                    }
                }

            ad_payload = {
                "name": ad.name,
                "adset_id": ad_group_id,
                "creative": creative_spec,
                "status": self._map_ad_status(ad.status),
            }

            # In production, make API call:
            # response = requests.post(
            #     f"{self.BASE_URL}/{self.account_id}/ads",
            #     params={"access_token": self.access_token},
            #     data=ad_payload
            # )

            ad.id = f"ma_{datetime.now().timestamp()}"
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
            ad_id: Meta ad ID

        Returns:
            Ad object or None if not found
        """
        self._ensure_authenticated()

        try:
            # In production, make API call
            if ad_id.startswith("ma_"):
                return Ad(
                    id=ad_id,
                    ad_group_id="mas_1",
                    name="Sample Meta Ad",
                    status=AdStatus.ENABLED,
                    type="image",
                    headline="Discover Our Products",
                    description="Shop now and save 20%",
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
        List ads in an ad set.

        Args:
            ad_group_id: Ad set ID

        Returns:
            List of ads
        """
        self._ensure_authenticated()

        try:
            # In production, make API call
            return [
                Ad(
                    id="ma_1",
                    ad_group_id=ad_group_id,
                    name="Instagram Story Ad",
                    status=AdStatus.ENABLED,
                    type="image",
                    headline="Limited Time Offer",
                    description="Shop the sale now",
                    final_url="https://example.com/sale",
                    created_at=datetime.now() - timedelta(days=30),
                    updated_at=datetime.now(),
                ),
                Ad(
                    id="ma_2",
                    ad_group_id=ad_group_id,
                    name="Facebook Feed Ad",
                    status=AdStatus.ENABLED,
                    type="video",
                    headline="See How It Works",
                    description="Watch our demo video",
                    final_url="https://example.com/demo",
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
            ad_group_id: Ad set ID (optional)
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
            # insights_endpoint = campaign_id or ad_group_id or ad_id or self.account_id
            # response = requests.get(
            #     f"{self.BASE_URL}/{insights_endpoint}/insights",
            #     params={
            #         "access_token": self.access_token,
            #         "fields": "impressions,clicks,spend,actions,action_values",
            #         "date_preset": date_range.upper(),
            #         "level": "ad" if ad_id else ("adset" if ad_group_id else "campaign")
            #     }
            # )

            # Simulate metrics
            metrics = PerformanceMetrics(
                campaign_id=campaign_id or "",
                ad_group_id=ad_group_id,
                ad_id=ad_id,
                date_range=date_range,
                impressions=78_450,
                clicks=2_341,
                cost=654.32,
                conversions=124,
                conversion_value=3_720.0,
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
            bid_strategy = self.BID_STRATEGIES.get(strategy, "LOWEST_COST_WITHOUT_CAP")
            self.update_campaign(campaign_id, {
                "bid_strategy": bid_strategy
            })

            return {
                "campaign_id": campaign_id,
                "new_strategy": strategy.value,
                "meta_strategy": bid_strategy,
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

        # Analyze CTR
        if performance.ctr < 1.5:
            suggestions.append(OptimizationSuggestion(
                type="creative",
                priority="high",
                title="Low Click-Through Rate",
                description=f"Your CTR of {performance.ctr:.2f}% is below Meta's 1.5% benchmark.",
                expected_impact="Improve CTR by 0.3-0.8%",
                action_items=[
                    "Test new creative formats (video, carousel)",
                    "Refresh ad creative weekly",
                    "A/B test headlines and descriptions",
                    "Use eye-catching images",
                ],
                current_value=f"{performance.ctr:.2f}%",
                suggested_value="1.8-2.3%",
            ))

        # Analyze frequency
        # Meta-specific: Check ad fatigue
        if performance.impressions > 100_000 and performance.ctr < 1.0:
            suggestions.append(OptimizationSuggestion(
                type="creative",
                priority="high",
                title="Possible Ad Fatigue",
                description="High impressions with declining CTR suggests audience fatigue.",
                expected_impact="Improve CTR by 0.5-1.0%",
                action_items=[
                    "Refresh ad creative",
                    "Rotate new creatives",
                    "Expand audience targeting",
                    "Exclude recent converters",
                ],
            ))

        # Analyze CPC
        if performance.cpc > 1.0:
            suggestions.append(OptimizationSuggestion(
                type="targeting",
                priority="medium",
                title="High Cost Per Click",
                description=f"Your CPC of ${performance.cpc:.2f} is above Meta's average.",
                expected_impact="Reduce CPC by 15-30%",
                action_items=[
                    "Refine audience targeting",
                    "Use lookalike audiences",
                    "Test different placements",
                    "Optimize for conversions instead of clicks",
                ],
                current_value=f"${performance.cpc:.2f}",
                suggested_value="$0.70-$0.85",
            ))

        # Analyze conversion cost
        if performance.conversions > 0:
            cost_per_conversion = performance.cost / performance.conversions
            if cost_per_conversion > 20.0:
                suggestions.append(OptimizationSuggestion(
                    type="budget",
                    priority="high",
                    title="High Cost Per Conversion",
                    description=f"Your cost per conversion of ${cost_per_conversion:.2f} needs improvement.",
                    expected_impact="Reduce CPA by 20-35%",
                    action_items=[
                        "Improve landing page conversion rate",
                        "Use value-based lookalike audiences",
                        "Set up conversion value optimization",
                        "Exclude non-converting audiences",
                    ],
                    current_value=f"${cost_per_conversion:.2f}",
                    suggested_value="$13-$16",
                ))

        # Analyze ROAS
        if performance.roas < 2.5:
            suggestions.append(OptimizationSuggestion(
                type="targeting",
                priority="medium",
                title="Improve Return on Ad Spend",
                description=f"ROAS of {performance.roas:.2f}x is below target for Meta ads.",
                expected_impact="Improve ROAS to 3-4x",
                action_items=[
                    "Optimize for purchase events",
                    "Use dynamic product ads",
                    "Implement catalog sales campaign",
                    "Set up value-based custom audiences",
                ],
                current_value=f"{performance.roas:.2f}x",
                suggested_value="3-4x",
            ))

        return suggestions

    def _map_campaign_status(self, status: CampaignStatus) -> str:
        """Map campaign status to Meta enum."""
        status_map = {
            CampaignStatus.ENABLED: "ACTIVE",
            CampaignStatus.PAUSED: "PAUSED",
            CampaignStatus.REMOVED: "ARCHIVED",
        }
        return status_map.get(status, "PAUSED")

    def _map_ad_status(self, status: AdStatus) -> str:
        """Map ad status to Meta enum."""
        status_map = {
            AdStatus.ENABLED: "ACTIVE",
            AdStatus.PAUSED: "PAUSED",
            AdStatus.DISABLED: "OFF",
        }
        return status_map.get(status, "PAUSED")

    def _build_targeting(self, targeting: Optional[Targeting]) -> Dict:
        """Build Meta targeting spec from Targeting object."""
        if not targeting:
            return {}

        targeting_spec = {}

        if targeting.locations:
            targeting_spec['geo_locations'] = {
                'countries': targeting.locations
            }

        if targeting.age_range:
            targeting_spec['age_min'] = targeting.age_range.get('min', 18)
            targeting_spec['age_max'] = targeting.age_range.get('max', 65)

        if targeting.genders:
            gender_map = {'male': 1, 'female': 2, 'other': 3}
            targeting_spec['genders'] = [gender_map.get(g, 0) for g in targeting.genders]

        if targeting.interests:
            targeting_spec['interests'] = [
                {'id': interest, 'name': interest}
                for interest in targeting.interests
            ]

        if targeting.devices:
            device_map = {
                'mobile': ['Mobile'],
                'desktop': ['Desktop'],
                'tablet': ['Tablet']
            }
            targeting_spec['device_platforms'] = []
            for device in targeting.devices:
                targeting_spec['device_platforms'].extend(device_map.get(device, []))

        return targeting_spec
