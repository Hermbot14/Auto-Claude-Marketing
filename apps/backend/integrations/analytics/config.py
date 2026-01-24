"""
Analytics Configuration
======================

Configuration management for analytics platform integrations.
Supports Google Analytics 4, Mixpanel, and Amplitude.
"""

import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class AnalyticsConfig:
    """Configuration for analytics platform integrations."""

    # Google Analytics 4
    ga4_enabled: bool = False
    ga4_property_id: str | None = None
    ga4_service_account_path: str | None = None
    ga4_credentials_json: str | None = None

    # Mixpanel
    mixpanel_enabled: bool = False
    mixpanel_project_id: str | None = None
    mixpanel_api_secret: str | None = None
    mixpanel_api_region: str = "US"  # US or EU

    # Amplitude
    amplitude_enabled: bool = False
    amplitude_api_key: str | None = None
    amplitude_secret_key: str | None = None
    amplitude_api_region: str = "US"  # US or EU

    # General settings
    default_timezone: str = "UTC"
    batch_size: int = 100
    timeout_seconds: int = 30
    max_retries: int = 3

    # Cache settings
    cache_enabled: bool = True
    cache_ttl_hours: int = 1

    # Data retention
    retention_days: int = 90

    # Date range defaults
    default_lookback_days: int = 30

    def is_valid(self) -> bool:
        """Check if at least one analytics integration is configured."""
        return self.ga4_enabled or self.mixpanel_enabled or self.amplitude_enabled

    def has_ga4(self) -> bool:
        """Check if GA4 integration is available."""
        return self.ga4_enabled and bool(self.ga4_property_id)

    def has_mixpanel(self) -> bool:
        """Check if Mixpanel integration is available."""
        return self.mixpanel_enabled and bool(
            self.mixpanel_project_id and self.mixpanel_api_secret
        )

    def has_amplitude(self) -> bool:
        """Check if Amplitude integration is available."""
        return self.amplitude_enabled and bool(
            self.amplitude_api_key and self.amplitude_secret_key
        )

    @classmethod
    def from_env(cls) -> "AnalyticsConfig":
        """Create configuration from environment variables."""
        return cls(
            ga4_enabled=os.getenv("GA4_ENABLED", "").lower() == "true",
            ga4_property_id=os.getenv("GA4_PROPERTY_ID"),
            ga4_service_account_path=os.getenv("GA4_SERVICE_ACCOUNT_PATH"),
            ga4_credentials_json=os.getenv("GA4_CREDENTIALS_JSON"),
            mixpanel_enabled=os.getenv("MIXPANEL_ENABLED", "").lower() == "true",
            mixpanel_project_id=os.getenv("MIXPANEL_PROJECT_ID"),
            mixpanel_api_secret=os.getenv("MIXPANEL_API_SECRET"),
            mixpanel_api_region=os.getenv("MIXPANEL_API_REGION", "US"),
            amplitude_enabled=os.getenv("AMPLITUDE_ENABLED", "").lower() == "true",
            amplitude_api_key=os.getenv("AMPLITUDE_API_KEY"),
            amplitude_secret_key=os.getenv("AMPLITUDE_SECRET_KEY"),
            amplitude_api_region=os.getenv("AMPLITUDE_API_REGION", "US"),
            default_timezone=os.getenv("ANALYTICS_TIMEZONE", "UTC"),
            batch_size=int(os.getenv("ANALYTICS_BATCH_SIZE", "100")),
            timeout_seconds=int(os.getenv("ANALYTICS_TIMEOUT", "30")),
            max_retries=int(os.getenv("ANALYTICS_MAX_RETRIES", "3")),
            cache_enabled=os.getenv("ANALYTICS_CACHE_ENABLED", "true").lower() == "true",
            cache_ttl_hours=int(os.getenv("ANALYTICS_CACHE_TTL_HOURS", "1")),
            retention_days=int(os.getenv("ANALYTICS_RETENTION_DAYS", "90")),
            default_lookback_days=int(os.getenv("ANALYTICS_LOOKBACK_DAYS", "30")),
        )

    @classmethod
    def from_file(cls, config_path: Path) -> "AnalyticsConfig":
        """Load configuration from JSON file."""
        if not config_path.exists():
            logger.warning(f"Analytics config file not found: {config_path}")
            return cls.from_env()

        try:
            with open(config_path, encoding="utf-8") as f:
                data = json.load(f)
            return cls(**data)
        except (json.JSONDecodeError, OSError, TypeError) as e:
            logger.error(f"Failed to load analytics config: {e}")
            return cls.from_env()

    def save(self, config_path: Path) -> None:
        """Save configuration to JSON file."""
        config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(self.__dict__, f, indent=2)


def get_analytics_config(
    config_path: Path | None = None,
) -> AnalyticsConfig:
    """
    Get analytics configuration from file or environment.

    Args:
        config_path: Optional path to config file

    Returns:
        AnalyticsConfig instance
    """
    if config_path and config_path.exists():
        return AnalyticsConfig.from_file(config_path)
    return AnalyticsConfig.from_env()


def is_analytics_enabled() -> bool:
    """Quick check if any analytics integration is enabled."""
    config = get_analytics_config()
    return config.is_valid()
