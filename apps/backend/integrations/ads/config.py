"""
Configuration management for advertising platform integrations.
"""

import os
from dataclasses import dataclass, field
from typing import Dict, Any, Optional


@dataclass
class GoogleAdsConfig:
    """Google Ads configuration."""
    developer_token: str
    client_id: str
    client_secret: str
    refresh_token: str
    customer_id: str
    login_customer_id: Optional[str] = None
    enabled: bool = True


@dataclass
class MetaAdsConfig:
    """Meta Ads (Facebook/Instagram) configuration."""
    access_token: str
    account_id: str
    app_id: Optional[str] = None
    app_secret: Optional[str] = None
    business_id: Optional[str] = None
    enabled: bool = True


@dataclass
class LinkedInAdsConfig:
    """LinkedIn Ads configuration."""
    access_token: str
    account_id: str
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    refresh_token: Optional[str] = None
    enabled: bool = True


@dataclass
class AdsIntegrationsConfig:
    """All ads integrations configuration."""
    google_ads: Optional[GoogleAdsConfig] = None
    meta_ads: Optional[MetaAdsConfig] = None
    linkedin_ads: Optional[LinkedInAdsConfig] = None
    log_level: str = "INFO"
    cache_enabled: bool = True
    cache_ttl: int = 3600

    @classmethod
    def from_env(cls) -> 'AdsIntegrationsConfig':
        """
        Load configuration from environment variables.

        Returns:
            AdsIntegrationsConfig instance
        """
        config = cls()

        # Google Ads
        if os.getenv('GOOGLE_ADS_DEVELOPER_TOKEN'):
            config.google_ads = GoogleAdsConfig(
                developer_token=os.getenv('GOOGLE_ADS_DEVELOPER_TOKEN', ''),
                client_id=os.getenv('GOOGLE_ADS_CLIENT_ID', ''),
                client_secret=os.getenv('GOOGLE_ADS_CLIENT_SECRET', ''),
                refresh_token=os.getenv('GOOGLE_ADS_REFRESH_TOKEN', ''),
                customer_id=os.getenv('GOOGLE_ADS_CUSTOMER_ID', ''),
                login_customer_id=os.getenv('GOOGLE_ADS_LOGIN_CUSTOMER_ID'),
                enabled=os.getenv('GOOGLE_ADS_ENABLED', 'true').lower() == 'true',
            )

        # Meta Ads
        if os.getenv('META_ADS_ACCESS_TOKEN'):
            config.meta_ads = MetaAdsConfig(
                access_token=os.getenv('META_ADS_ACCESS_TOKEN', ''),
                account_id=os.getenv('META_ADS_ACCOUNT_ID', ''),
                app_id=os.getenv('META_ADS_APP_ID'),
                app_secret=os.getenv('META_ADS_APP_SECRET'),
                business_id=os.getenv('META_ADS_BUSINESS_ID'),
                enabled=os.getenv('META_ADS_ENABLED', 'true').lower() == 'true',
            )

        # LinkedIn Ads
        if os.getenv('LINKEDIN_ADS_ACCESS_TOKEN'):
            config.linkedin_ads = LinkedInAdsConfig(
                access_token=os.getenv('LINKEDIN_ADS_ACCESS_TOKEN', ''),
                account_id=os.getenv('LINKEDIN_ADS_ACCOUNT_ID', ''),
                client_id=os.getenv('LINKEDIN_ADS_CLIENT_ID'),
                client_secret=os.getenv('LINKEDIN_ADS_CLIENT_SECRET'),
                refresh_token=os.getenv('LINKEDIN_ADS_REFRESH_TOKEN'),
                enabled=os.getenv('LINKEDIN_ADS_ENABLED', 'true').lower() == 'true',
            )

        # General settings
        config.log_level = os.getenv('ADS_LOG_LEVEL', 'INFO')
        config.cache_enabled = os.getenv('ADS_CACHE_ENABLED', 'true').lower() == 'true'
        config.cache_ttl = int(os.getenv('ADS_CACHE_TTL', '3600'))

        return config

    @classmethod
    def from_dict(cls, config_dict: Dict[str, Any]) -> 'AdsIntegrationsConfig':
        """
        Load configuration from dictionary.

        Args:
            config_dict: Configuration dictionary

        Returns:
            AdsIntegrationsConfig instance
        """
        config = cls()

        # Google Ads
        google_ads = config_dict.get('google_ads')
        if google_ads and google_ads.get('enabled', True):
            config.google_ads = GoogleAdsConfig(**google_ads)

        # Meta Ads
        meta_ads = config_dict.get('meta_ads')
        if meta_ads and meta_ads.get('enabled', True):
            config.meta_ads = MetaAdsConfig(**meta_ads)

        # LinkedIn Ads
        linkedin_ads = config_dict.get('linkedin_ads')
        if linkedin_ads and linkedin_ads.get('enabled', True):
            config.linkedin_ads = LinkedInAdsConfig(**linkedin_ads)

        # General settings
        config.log_level = config_dict.get('log_level', 'INFO')
        config.cache_enabled = config_dict.get('cache_enabled', True)
        config.cache_ttl = config_dict.get('cache_ttl', 3600)

        return config

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert configuration to dictionary.

        Returns:
            Configuration dictionary (secrets omitted)
        """
        result = {
            'log_level': self.log_level,
            'cache_enabled': self.cache_enabled,
            'cache_ttl': self.cache_ttl,
        }

        if self.google_ads:
            result['google_ads'] = {
                'customer_id': self.google_ads.customer_id,
                'enabled': self.google_ads.enabled,
            }

        if self.meta_ads:
            result['meta_ads'] = {
                'account_id': self.meta_ads.account_id,
                'enabled': self.meta_ads.enabled,
            }

        if self.linkedin_ads:
            result['linkedin_ads'] = {
                'account_id': self.linkedin_ads.account_id,
                'enabled': self.linkedin_ads.enabled,
            }

        return result

    def get_platform_config(self, platform: str) -> Optional[Dict[str, Any]]:
        """
        Get configuration for a specific platform.

        Args:
            platform: Platform name ('google', 'meta', 'linkedin')

        Returns:
            Platform configuration dict or None

        Raises:
            ValueError: If platform is not supported
        """
        platform_map = {
            'google': self.google_ads,
            'meta': self.meta_ads,
            'linkedin': self.linkedin_ads,
        }

        config = platform_map.get(platform)
        if not config or not config.enabled:
            return None

        # Convert dataclass to dict
        if platform == 'google':
            return {
                'developer_token': config.developer_token,
                'client_id': config.client_id,
                'client_secret': config.client_secret,
                'refresh_token': config.refresh_token,
                'customer_id': config.customer_id,
                'login_customer_id': config.login_customer_id,
            }
        elif platform == 'meta':
            return {
                'access_token': config.access_token,
                'account_id': config.account_id,
                'app_id': config.app_id,
                'app_secret': config.app_secret,
                'business_id': config.business_id,
            }
        elif platform == 'linkedin':
            return {
                'access_token': config.access_token,
                'account_id': config.account_id,
                'client_id': config.client_id,
                'client_secret': config.client_secret,
                'refresh_token': config.refresh_token,
            }

        raise ValueError(f"Unsupported platform: {platform}")
