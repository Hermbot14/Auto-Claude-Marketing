"""
Advertising Platform Integrations

This module provides integrations with major advertising platforms including:
- Google Ads
- Meta Ads (Facebook, Instagram)
- LinkedIn Ads
"""

from .base import AdsPlatform, Campaign, AdGroup, Ad, PerformanceMetrics, BidStrategy, Targeting
from .google_ads import GoogleAdsPlatform
from .meta_ads import MetaAdsPlatform
from .linkedin_ads import LinkedInAdsPlatform

__all__ = [
    'AdsPlatform',
    'Campaign',
    'AdGroup',
    'Ad',
    'PerformanceMetrics',
    'BidStrategy',
    'Targeting',
    'GoogleAdsPlatform',
    'MetaAdsPlatform',
    'LinkedInAdsPlatform',
]

# Platform factory
def get_ads_platform(platform_name: str, config: dict) -> AdsPlatform:
    """
    Factory function to get an ads platform instance.

    Args:
        platform_name: 'google', 'meta', or 'linkedin'
        config: Configuration dict with API credentials

    Returns:
        AdsPlatform instance

    Raises:
        ValueError: If platform_name is not supported
    """
    platforms = {
        'google': GoogleAdsPlatform,
        'meta': MetaAdsPlatform,
        'linkedin': LinkedInAdsPlatform,
    }

    platform_class = platforms.get(platform_name.lower())
    if not platform_class:
        raise ValueError(f"Unsupported platform: {platform_name}. Supported: {list(platforms.keys())}")

    return platform_class(config)
