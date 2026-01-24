"""
Base classes and interfaces for advertising platform integrations.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any


class BidStrategy(Enum):
    """Bid strategy types."""
    MANUAL_CPC = "manual_cpc"
    MAXIMIZE_CLICKS = "maximize_clicks"
    MAXIMIZE_CONVERSIONS = "maximize_conversions"
    TARGET_CPA = "target_cpa"
    TARGET_ROAS = "target_roas"
    TARGET_IMPRESSION_SHARE = "target_impression_share"


class CampaignStatus(Enum):
    """Campaign status."""
    ENABLED = "enabled"
    PAUSED = "paused"
    REMOVED = "removed"


class AdStatus(Enum):
    """Ad status."""
    ENABLED = "enabled"
    PAUSED = "paused"
    DISABLED = "disabled"


@dataclass
class Targeting:
    """Targeting criteria."""
    locations: List[str] = field(default_factory=list)  # Countries, regions, cities
    languages: List[str] = field(default_factory=list)  # Language codes
    age_range: Optional[Dict[str, int]] = None  # {'min': 18, 'max': 65}
    genders: List[str] = field(default_factory=list)  # 'male', 'female', 'other'
    interests: List[str] = field(default_factory=list)  # Interest categories
    keywords: List[str] = field(default_factory=list)  # For search ads
    placements: List[str] = field(default_factory=list)  # Websites, apps
    devices: List[str] = field(default_factory=list)  # 'mobile', 'desktop', 'tablet'
    custom_audiences: List[str] = field(default_factory=list)  # Custom audience IDs
    lookalike_audiences: List[str] = field(default_factory=list)  # Lookalike IDs
    exclusions: Dict[str, List[str]] = field(default_factory=dict)  # Exclusion criteria


@dataclass
class Campaign:
    """Campaign data model."""
    id: Optional[str] = None
    name: str = ""
    status: CampaignStatus = CampaignStatus.ENABLED
    budget: float = 0.0  # Daily budget
    budget_type: str = "daily"  # daily, lifetime
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    bid_strategy: BidStrategy = BidStrategy.MANUAL_CPC
    target_roas: Optional[float] = None  # For ROAS campaigns
    target_cpa: Optional[float] = None  # For CPA campaigns
    targeting: Optional[Targeting] = None
    adgroups: List['AdGroup'] = field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    platform_specific: Dict[str, Any] = field(default_factory=dict)  # Platform-specific data


@dataclass
class AdGroup:
    """Ad group data model."""
    id: Optional[str] = None
    campaign_id: str = ""
    name: str = ""
    status: CampaignStatus = CampaignStatus.ENABLED
    default_bid: float = 0.0
    keywords: List[str] = field(default_factory=list)
    ads: List['Ad'] = field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    platform_specific: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Ad:
    """Ad data model."""
    id: Optional[str] = None
    ad_group_id: str = ""
    name: str = ""
    status: AdStatus = AdStatus.ENABLED
    type: str = "text"  # text, image, video, carousel, etc.
    headline: str = ""
    description: str = ""
    display_url: str = ""
    final_url: str = ""
    creative_asset_id: Optional[str] = None  # For image/video ads
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    call_to_action: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    platform_specific: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PerformanceMetrics:
    """Performance metrics data model."""
    campaign_id: str = ""
    ad_group_id: Optional[str] = None
    ad_id: Optional[str] = None
    date_range: str = "last_30_days"
    impressions: int = 0
    clicks: int = 0
    cost: float = 0.0
    conversions: int = 0
    conversion_value: float = 0.0
    ctr: float = 0.0  # Click-through rate
    cpc: float = 0.0  # Cost per click
    cpm: float = 0.0  # Cost per mille (1000 impressions)
    roas: float = 0.0  # Return on ad spend
    average_position: float = 0.0
    quality_score: Optional[float] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    platform_specific: Dict[str, Any] = field(default_factory=dict)

    def calculate_metrics(self):
        """Calculate derived metrics."""
        if self.impressions > 0:
            self.ctr = (self.clicks / self.impressions) * 100
            self.cpm = (self.cost / self.impressions) * 1000
        if self.clicks > 0:
            self.cpc = self.cost / self.clicks
        if self.cost > 0:
            self.roas = self.conversion_value / self.cost


@dataclass
class OptimizationSuggestion:
    """Optimization suggestion data model."""
    type: str  # 'bid', 'budget', 'creative', 'targeting'
    priority: str  # 'high', 'medium', 'low'
    title: str
    description: str
    expected_impact: str
    action_items: List[str] = field(default_factory=list)
    current_value: Optional[Any] = None
    suggested_value: Optional[Any] = None


class AdsPlatformError(Exception):
    """Base exception for ads platform errors."""
    pass


class AuthenticationError(AdsPlatformError):
    """Authentication failed."""
    pass


class RateLimitError(AdsPlatformError):
    """Rate limit exceeded."""
    pass


class ValidationError(AdsPlatformError):
    """Validation error."""
    pass


class AdsPlatform(ABC):
    """
    Abstract base class for advertising platform integrations.

    All platform implementations must inherit from this class and implement
    the abstract methods.
    """

    def __init__(self, config: Dict[str, Any]):
        """
        Initialize the ads platform.

        Args:
            config: Configuration dict with API credentials and settings
        """
        self.config = config
        self.access_token = config.get('access_token')
        self.refresh_token = config.get('refresh_token')
        self.client_id = config.get('client_id')
        self.client_secret = config.get('client_secret')
        self.developer_token = config.get('developer_token')
        self.customer_id = config.get('customer_id') or config.get('account_id')
        self.account_id = self.customer_id

    @abstractmethod
    def authenticate(self) -> bool:
        """
        Authenticate with the platform.

        Returns:
            True if authentication successful

        Raises:
            AuthenticationError: If authentication fails
        """
        pass

    @abstractmethod
    def create_campaign(self, campaign: Campaign) -> Campaign:
        """
        Create a new campaign.

        Args:
            campaign: Campaign object with campaign details

        Returns:
            Created campaign with ID assigned

        Raises:
            ValidationError: If campaign data is invalid
            AdsPlatformError: If creation fails
        """
        pass

    @abstractmethod
    def get_campaign(self, campaign_id: str) -> Optional[Campaign]:
        """
        Get a campaign by ID.

        Args:
            campaign_id: Platform campaign ID

        Returns:
            Campaign object or None if not found
        """
        pass

    @abstractmethod
    def list_campaigns(self, status: Optional[CampaignStatus] = None) -> List[Campaign]:
        """
        List all campaigns.

        Args:
            status: Filter by status (optional)

        Returns:
            List of campaigns
        """
        pass

    @abstractmethod
    def update_campaign(self, campaign_id: str, updates: Dict[str, Any]) -> Campaign:
        """
        Update a campaign.

        Args:
            campaign_id: Platform campaign ID
            updates: Dict of fields to update

        Returns:
            Updated campaign
        """
        pass

    @abstractmethod
    def delete_campaign(self, campaign_id: str) -> bool:
        """
        Delete/remove a campaign.

        Args:
            campaign_id: Platform campaign ID

        Returns:
            True if successful
        """
        pass

    @abstractmethod
    def create_ad_group(self, campaign_id: str, ad_group: AdGroup) -> AdGroup:
        """
        Create a new ad group.

        Args:
            campaign_id: Campaign ID
            ad_group: AdGroup object

        Returns:
            Created ad group with ID assigned
        """
        pass

    @abstractmethod
    def get_ad_group(self, ad_group_id: str) -> Optional[AdGroup]:
        """
        Get an ad group by ID.

        Args:
            ad_group_id: Platform ad group ID

        Returns:
            AdGroup object or None if not found
        """
        pass

    @abstractmethod
    def list_ad_groups(self, campaign_id: str) -> List[AdGroup]:
        """
        List ad groups in a campaign.

        Args:
            campaign_id: Campaign ID

        Returns:
            List of ad groups
        """
        pass

    @abstractmethod
    def create_ad(self, ad_group_id: str, ad: Ad) -> Ad:
        """
        Create a new ad.

        Args:
            ad_group_id: Ad group ID
            ad: Ad object

        Returns:
            Created ad with ID assigned
        """
        pass

    @abstractmethod
    def get_ad(self, ad_id: str) -> Optional[Ad]:
        """
        Get an ad by ID.

        Args:
            ad_id: Platform ad ID

        Returns:
            Ad object or None if not found
        """
        pass

    @abstractmethod
    def list_ads(self, ad_group_id: str) -> List[Ad]:
        """
        List ads in an ad group.

        Args:
            ad_group_id: Ad group ID

        Returns:
            List of ads
        """
        pass

    @abstractmethod
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
            date_range: Predefined date range (last_7_days, last_30_days, etc.)
            start_date: Custom start date
            end_date: Custom end date

        Returns:
            PerformanceMetrics object
        """
        pass

    @abstractmethod
    def optimize_bids(self, campaign_id: str, strategy: BidStrategy) -> Dict[str, Any]:
        """
        Optimize bids for a campaign.

        Args:
            campaign_id: Campaign ID
            strategy: Bid strategy to apply

        Returns:
            Dict with optimization results
        """
        pass

    @abstractmethod
    def get_optimization_suggestions(self, campaign_id: str) -> List[OptimizationSuggestion]:
        """
        Get optimization suggestions for a campaign.

        Args:
            campaign_id: Campaign ID

        Returns:
            List of optimization suggestions
        """
        pass

    def _validate_required_fields(self, obj: Any, required_fields: List[str]):
        """
        Validate that required fields are present.

        Args:
            obj: Object to validate
            required_fields: List of required field names

        Raises:
            ValidationError: If any required field is missing or empty
        """
        for field in required_fields:
            value = getattr(obj, field, None)
            if value is None or (isinstance(value, str) and not value.strip()):
                raise ValidationError(f"Required field '{field}' is missing or empty")
