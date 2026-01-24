"""
Analytics Platform Integrations
===============================

This module provides integrations with major analytics platforms including:
- Google Analytics 4 (GA4)
- Mixpanel
- Amplitude

Features:
- Event tracking and analysis
- Revenue attribution and ROI tracking
- User analytics and cohort analysis
- Funnel analysis and conversion tracking
- Unified reporting across platforms
"""

from .base import (
    AnalyticsPlatform,
    AnalyticsEvent,
    AnalyticsUser,
    RevenueData,
    FunnelStep,
    FunnelAnalysis,
    CohortData,
)
from .config import AnalyticsConfig, get_analytics_config
from .ga4 import GoogleAnalytics4
from .mixpanel import MixpanelAnalytics
from .amplitude import AmplitudeAnalytics
from .unified import UnifiedAnalytics

__all__ = [
    # Base classes and types
    "AnalyticsPlatform",
    "AnalyticsEvent",
    "AnalyticsUser",
    "RevenueData",
    "FunnelStep",
    "FunnelAnalysis",
    "CohortData",
    # Configuration
    "AnalyticsConfig",
    "get_analytics_config",
    # Platform implementations
    "GoogleAnalytics4",
    "MixpanelAnalytics",
    "AmplitudeAnalytics",
    # Unified analytics
    "UnifiedAnalytics",
]


def get_analytics_platform(
    platform_name: str,
    config: AnalyticsConfig | None = None,
) -> AnalyticsPlatform:
    """
    Factory function to get an analytics platform instance.

    Args:
        platform_name: 'ga4', 'mixpanel', or 'amplitude'
        config: Optional AnalyticsConfig (uses get_analytics_config() if not provided)

    Returns:
        AnalyticsPlatform instance

    Raises:
        ValueError: If platform_name is not supported

    Example:
        >>> from integrations.analytics import get_analytics_platform
        >>> ga4 = get_analytics_platform('ga4')
        >>> revenue = ga4.get_revenue('2024-01-01', '2024-01-31')
    """
    if config is None:
        config = get_analytics_config()

    platforms = {
        "ga4": GoogleAnalytics4,
        "mixpanel": MixpanelAnalytics,
        "amplitude": AmplitudeAnalytics,
    }

    platform_class = platforms.get(platform_name.lower())
    if not platform_class:
        raise ValueError(
            f"Unsupported platform: {platform_name}. "
            f"Supported: {list(platforms.keys())}"
        )

    return platform_class(config)


def get_unified_analytics(config: AnalyticsConfig | None = None) -> UnifiedAnalytics:
    """
    Factory function to get unified analytics across all platforms.

    Args:
        config: Optional AnalyticsConfig (uses get_analytics_config() if not provided)

    Returns:
        UnifiedAnalytics instance aggregating data from all enabled platforms

    Example:
        >>> from integrations.analytics import get_unified_analytics
        >>> unified = get_unified_analytics()
        >>> report = unified.get_cross_platform_report('2024-01-01', '2024-01-31')
    """
    if config is None:
        config = get_analytics_config()

    return UnifiedAnalytics(config)
