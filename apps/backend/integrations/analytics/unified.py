"""
Unified Analytics Platform
==========================

Aggregates data from multiple analytics platforms (GA4, Mixpanel, Amplitude)
into unified reports and metrics.

This module provides:
- Cross-platform revenue reporting
- Unified user analytics
- Aggregated funnel analysis
- ROI tracking across platforms
- Platform comparison and validation
"""

import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date

from .base import (
    AnalyticsPlatform,
    AnalyticsEvent,
    AnalyticsUser,
    FunnelAnalysis,
    FunnelStep,
    RevenueData,
)
from .config import AnalyticsConfig
from .ga4 import GoogleAnalytics4
from .mixpanel import MixpanelAnalytics
from .amplitude import AmplitudeAnalytics

logger = logging.getLogger(__name__)


@dataclass
class CrossPlatformRevenue:
    """Unified revenue data from multiple platforms."""

    total_revenue: float
    currency: str
    start_date: date
    end_date: date
    revenue_by_platform: dict[str, float] = field(default_factory=dict)
    transaction_count: int = 0
    average_order_value: float = 0.0

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "total_revenue": round(self.total_revenue, 2),
            "currency": self.currency,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "revenue_by_platform": {
                k: round(v, 2) for k, v in self.revenue_by_platform.items()
            },
            "transaction_count": self.transaction_count,
            "average_order_value": round(self.average_order_value, 2),
        }


@dataclass
class CrossPlatformUsers:
    """Unified user metrics from multiple platforms."""

    total_unique_users: int
    start_date: date
    end_date: date
    users_by_platform: dict[str, int] = field(default_factory=dict)
    overlap_percentage: float = 0.0

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "total_unique_users": self.total_unique_users,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "users_by_platform": self.users_by_platform,
            "overlap_percentage": round(self.overlap_percentage, 2),
        }


@dataclass
class PlatformComparison:
    """Comparison metrics across platforms."""

    metric_name: str
    start_date: date
    end_date: date
    values_by_platform: dict[str, float] = field(default_factory=dict)
    variance_percentage: float = 0.0
    recommendation: str = ""

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "metric_name": self.metric_name,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "values_by_platform": {
                k: round(v, 2) for k, v in self.values_by_platform.items()
            },
            "variance_percentage": round(self.variance_percentage, 2),
            "recommendation": self.recommendation,
        }


@dataclass
class ROIMetrics:
    """ROI tracking metrics."""

    total_revenue: float
    total_spend: float
    roi_percentage: float
    roas: float  # Return on Ad Spend
    start_date: date
    end_date: date
    roi_by_platform: dict[str, float] = field(default_factory=dict)
    roi_by_campaign: dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "total_revenue": round(self.total_revenue, 2),
            "total_spend": round(self.total_spend, 2),
            "roi_percentage": round(self.roi_percentage, 2),
            "roas": round(self.roas, 2),
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "roi_by_platform": {
                k: round(v, 2) for k, v in self.roi_by_platform.items()
            },
            "roi_by_campaign": {
                k: round(v, 2) for k, v in self.roi_by_campaign.items()
            },
        }


class UnifiedAnalytics:
    """
    Unified analytics platform that aggregates data from GA4, Mixpanel, and Amplitude.

    Provides cross-platform reporting, ROI tracking, and platform comparison.
    """

    def __init__(self, config: AnalyticsConfig):
        """
        Initialize unified analytics.

        Args:
            config: AnalyticsConfig with platform credentials
        """
        self.config = config
        self.platforms: dict[str, AnalyticsPlatform] = {}
        self._initialize_platforms()

    def _initialize_platforms(self) -> None:
        """Initialize enabled analytics platforms."""
        if self.config.has_ga4():
            try:
                ga4 = GoogleAnalytics4(self.config)
                if ga4.authenticate():
                    self.platforms["ga4"] = ga4
                    logger.info("GA4 platform initialized")
            except Exception as e:
                logger.error(f"Failed to initialize GA4: {e}")

        if self.config.has_mixpanel():
            try:
                mixpanel = MixpanelAnalytics(self.config)
                if mixpanel.authenticate():
                    self.platforms["mixpanel"] = mixpanel
                    logger.info("Mixpanel platform initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Mixpanel: {e}")

        if self.config.has_amplitude():
            try:
                amplitude = AmplitudeAnalytics(self.config)
                if amplitude.authenticate():
                    self.platforms["amplitude"] = amplitude
                    logger.info("Amplitude platform initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Amplitude: {e}")

        if not self.platforms:
            logger.warning("No analytics platforms successfully initialized")

    def get_cross_platform_revenue(
        self,
        start_date: date | str,
        end_date: date | str,
        currency: str = "USD",
    ) -> CrossPlatformRevenue:
        """
        Get unified revenue metrics across all platforms.

        Args:
            start_date: Start date
            end_date: End date
            currency: Currency code

        Returns:
            CrossPlatformRevenue with aggregated revenue data
        """
        total_revenue = 0.0
        revenue_by_platform: dict[str, float] = {}
        total_transactions = 0

        for platform_name, platform in self.platforms.items():
            try:
                platform_revenue = platform.get_revenue(start_date, end_date, currency)
                revenue_value = float(platform_revenue.total_revenue)
                total_revenue += revenue_value
                revenue_by_platform[platform_name] = revenue_value
                total_transactions += platform_revenue.transaction_count
            except Exception as e:
                logger.error(f"Failed to get revenue from {platform_name}: {e}")
                revenue_by_platform[platform_name] = 0.0

        aov = total_revenue / total_transactions if total_transactions > 0 else 0.0

        return CrossPlatformRevenue(
            total_revenue=total_revenue,
            currency=currency,
            start_date=self._parse_date(start_date),
            end_date=self._parse_date(end_date),
            revenue_by_platform=revenue_by_platform,
            transaction_count=total_transactions,
            average_order_value=aov,
        )

    def get_cross_platform_users(
        self,
        start_date: date | str,
        end_date: date | str,
    ) -> CrossPlatformUsers:
        """
        Get unified user metrics across all platforms.

        Args:
            start_date: Start date
            end_date: End date

        Returns:
            CrossPlatformUsers with aggregated user data
        """
        users_by_platform: dict[str, int] = {}
        max_users = 0

        for platform_name, platform in self.platforms.items():
            try:
                user_count = platform.get_user_count(start_date, end_date)
                users_by_platform[platform_name] = user_count
                max_users = max(max_users, user_count)
            except Exception as e:
                logger.error(f"Failed to get users from {platform_name}: {e}")
                users_by_platform[platform_name] = 0

        # Estimate overlap (simplified - actual overlap requires user ID matching)
        total_users = sum(users_by_platform.values())
        overlap_percentage = (
            ((total_users - max_users) / max_users) * 100 if max_users > 0 else 0.0
        )

        return CrossPlatformUsers(
            total_unique_users=max_users,  # Conservative estimate
            start_date=self._parse_date(start_date),
            end_date=self._parse_date(end_date),
            users_by_platform=users_by_platform,
            overlap_percentage=overlap_percentage,
        )

    def compare_platforms(
        self,
        metric: str = "revenue",
        start_date: date | str,
        end_date: date | str,
    ) -> PlatformComparison:
        """
        Compare a specific metric across platforms.

        Args:
            metric: Metric to compare (revenue, users, etc.)
            start_date: Start date
            end_date: End date

        Returns:
            PlatformComparison with comparison data
        """
        values_by_platform: dict[str, float] = {}

        for platform_name, platform in self.platforms.items():
            try:
                if metric == "revenue":
                    data = platform.get_revenue(start_date, end_date)
                    values_by_platform[platform_name] = float(data.total_revenue)
                elif metric == "users":
                    values_by_platform[platform_name] = float(
                        platform.get_user_count(start_date, end_date)
                    )
                else:
                    logger.warning(f"Unsupported metric for comparison: {metric}")
            except Exception as e:
                logger.error(f"Failed to get {metric} from {platform_name}: {e}")
                values_by_platform[platform_name] = 0.0

        # Calculate variance
        if len(values_by_platform) > 1:
            values = list(values_by_platform.values())
            mean_value = sum(values) / len(values) if values else 0.0
            variance = (
                sum((v - mean_value) ** 2 for v in values) / len(values)
                if values
                else 0.0
            )
            variance_percentage = (
                (variance**0.5 / mean_value) * 100 if mean_value > 0 else 0.0
            )
        else:
            variance_percentage = 0.0

        # Generate recommendation
        recommendation = self._generate_comparison_recommendation(
            metric, values_by_platform, variance_percentage
        )

        return PlatformComparison(
            metric_name=metric,
            start_date=self._parse_date(start_date),
            end_date=self._parse_date(end_date),
            values_by_platform=values_by_platform,
            variance_percentage=variance_percentage,
            recommendation=recommendation,
        )

    def get_roi_metrics(
        self,
        start_date: date | str,
        end_date: date | str,
        ad_spend_by_platform: dict[str, float] | None = None,
    ) -> ROIMetrics:
        """
        Calculate ROI metrics across platforms.

        Args:
            start_date: Start date
            end_date: End date
            ad_spend_by_platform: Optional ad spend data by platform

        Returns:
            ROIMetrics with ROI calculations
        """
        revenue_data = self.get_cross_platform_revenue(start_date, end_date)
        total_revenue = revenue_data.total_revenue

        # Use provided spend or default to revenue/2 for estimation
        if ad_spend_by_platform:
            total_spend = sum(ad_spend_by_platform.values())
        else:
            total_spend = total_revenue / 2  # Conservative estimate

        roi_percentage = (
            ((total_revenue - total_spend) / total_spend) * 100 if total_spend > 0 else 0.0
        )
        roas = total_revenue / total_spend if total_spend > 0 else 0.0

        # Calculate ROI by platform
        roi_by_platform: dict[str, float] = {}
        for platform_name, revenue in revenue_data.revenue_by_platform.items():
            spend = ad_spend_by_platform.get(platform_name, 0.0) if ad_spend_by_platform else revenue / 2
            roi_by_platform[platform_name] = (
                ((revenue - spend) / spend) * 100 if spend > 0 else 0.0
            )

        return ROIMetrics(
            total_revenue=total_revenue,
            total_spend=total_spend,
            roi_percentage=roi_percentage,
            roas=roas,
            start_date=self._parse_date(start_date),
            end_date=self._parse_date(end_date),
            roi_by_platform=roi_by_platform,
        )

    def get_cross_platform_report(
        self,
        start_date: date | str,
        end_date: date | str,
        ad_spend_by_platform: dict[str, float] | None = None,
    ) -> dict:
        """
        Generate comprehensive cross-platform analytics report.

        Args:
            start_date: Start date
            end_date: End date
            ad_spend_by_platform: Optional ad spend data for ROI calculation

        Returns:
            Dictionary with all cross-platform metrics
        """
        revenue = self.get_cross_platform_revenue(start_date, end_date)
        users = self.get_cross_platform_users(start_date, end_date)
        roi = self.get_roi_metrics(start_date, end_date, ad_spend_by_platform)
        revenue_comparison = self.compare_platforms("revenue", start_date, end_date)
        user_comparison = self.compare_platforms("users", start_date, end_date)

        return {
            "revenue": revenue.to_dict(),
            "users": users.to_dict(),
            "roi": roi.to_dict(),
            "platform_comparison": {
                "revenue": revenue_comparison.to_dict(),
                "users": user_comparison.to_dict(),
            },
            "platforms_enabled": list(self.platforms.keys()),
            "report_period": {
                "start_date": self._parse_date(start_date).isoformat(),
                "end_date": self._parse_date(end_date).isoformat(),
            },
        }

    def track_event_all_platforms(self, event: AnalyticsEvent) -> dict[str, bool]:
        """
        Track an event across all configured platforms.

        Args:
            event: AnalyticsEvent to track

        Returns:
            Dictionary mapping platform names to success status
        """
        results: dict[str, bool] = {}

        for platform_name, platform in self.platforms.items():
            try:
                results[platform_name] = platform.track_event(event)
            except Exception as e:
                logger.error(f"Failed to track event on {platform_name}: {e}")
                results[platform_name] = False

        return results

    def _generate_comparison_recommendation(
        self,
        metric: str,
        values_by_platform: dict[str, float],
        variance_percentage: float,
    ) -> str:
        """
        Generate recommendation based on platform comparison.

        Args:
            metric: Metric being compared
            values_by_platform: Values by platform
            variance_percentage: Variance across platforms

        Returns:
            Recommendation string
        """
        if variance_percentage > 30:
            return (
                f"High variance ({variance_percentage:.1f}%) detected across platforms for {metric}. "
                "Review tracking implementation and data attribution settings."
            )

        if not values_by_platform:
            return "No data available for comparison."

        best_platform = max(values_by_platform, key=values_by_platform.get)
        return (
            f"Low variance across platforms. {best_platform} reports highest {metric}. "
            "Data appears consistent across platforms."
        )

    def _parse_date(self, date_input: date | str) -> date:
        """
        Parse date input to date object.

        Args:
            date_input: date object or ISO string

        Returns:
            date object
        """
        if isinstance(date_input, date):
            return date_input
        if isinstance(date_input, str):
            return date.fromisoformat(date_input)
        raise TypeError(f"Invalid date type: {type(date_input)}")

    @property
    def enabled_platforms(self) -> list[str]:
        """Get list of enabled platform names."""
        return list(self.platforms.keys())

    def is_platform_enabled(self, platform_name: str) -> bool:
        """Check if a specific platform is enabled."""
        return platform_name in self.platforms
