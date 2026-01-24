"""
SEO Configuration
=================

Configuration management for SEO integrations.
Supports multiple SEO tools and APIs.
"""

import json
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class SEOConfig:
    """Configuration for SEO integrations."""

    # SEMrush API
    semrush_enabled: bool = False
    semrush_api_key: str | None = None

    # Ahrefs API
    ahrefs_enabled: bool = False
    ahrefs_api_key: str | None = None

    # Moz API
    moz_enabled: bool = False
    moz_access_id: str | None = None
    moz_secret_key: str | None = None

    # Google Search Console
    gsc_enabled: bool = False
    gsc_credentials_path: str | None = None

    # General settings
    default_location: str = "us"
    default_language: str = "en"
    max_keywords_per_search: int = 100
    search_engine: str = "google"

    # Cache settings
    cache_enabled: bool = True
    cache_ttl_hours: int = 24

    def is_valid(self) -> bool:
        """Check if any SEO integration is configured."""
        return (
            self.semrush_enabled
            or self.ahrefs_enabled
            or self.moz_enabled
            or self.gsc_enabled
        )

    def has_keyword_research(self) -> bool:
        """Check if keyword research is available."""
        return self.semrush_enabled or self.ahrefs_enabled or self.moz_enabled

    def has_backlink_analysis(self) -> bool:
        """Check if backlink analysis is available."""
        return self.ahrefs_enabled or self.moz_enabled or self.semrush_enabled

    def has_rank_tracking(self) -> bool:
        """Check if rank tracking is available."""
        return self.semrush_enabled or self.ahrefs_enabled or self.gsc_enabled

    @classmethod
    def from_env(cls) -> "SEOConfig":
        """Create configuration from environment variables."""
        return cls(
            semrush_enabled=os.getenv("SEMRUSH_ENABLED", "").lower() == "true",
            semrush_api_key=os.getenv("SEMRUSH_API_KEY"),
            ahrefs_enabled=os.getenv("AHREFS_ENABLED", "").lower() == "true",
            ahrefs_api_key=os.getenv("AHREFS_API_KEY"),
            moz_enabled=os.getenv("MOZ_ENABLED", "").lower() == "true",
            moz_access_id=os.getenv("MOZ_ACCESS_ID"),
            moz_secret_key=os.getenv("MOZ_SECRET_KEY"),
            gsc_enabled=os.getenv("GSC_ENABLED", "").lower() == "true",
            gsc_credentials_path=os.getenv("GSC_CREDENTIALS_PATH"),
            default_location=os.getenv("SEO_DEFAULT_LOCATION", "us"),
            default_language=os.getenv("SEO_DEFAULT_LANGUAGE", "en"),
            max_keywords_per_search=int(os.getenv("SEO_MAX_KEYWORDS", "100")),
            search_engine=os.getenv("SEO_SEARCH_ENGINE", "google"),
            cache_enabled=os.getenv("SEO_CACHE_ENABLED", "true").lower() == "true",
            cache_ttl_hours=int(os.getenv("SEO_CACHE_TTL_HOURS", "24")),
        )

    @classmethod
    def from_file(cls, config_path: Path) -> "SEOConfig":
        """Load configuration from JSON file."""
        if not config_path.exists():
            logger.warning(f"SEO config file not found: {config_path}")
            return cls.from_env()

        try:
            with open(config_path, encoding="utf-8") as f:
                data = json.load(f)
            return cls(**data)
        except (json.JSONDecodeError, OSError, TypeError) as e:
            logger.error(f"Failed to load SEO config: {e}")
            return cls.from_env()

    def save(self, config_path: Path) -> None:
        """Save configuration to JSON file."""
        config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(self.__dict__, f, indent=2)


def get_seo_config(config_path: Path | None = None) -> SEOConfig:
    """
    Get SEO configuration from file or environment.

    Args:
        config_path: Optional path to config file

    Returns:
        SEOConfig instance
    """
    if config_path and config_path.exists():
        return SEOConfig.from_file(config_path)
    return SEOConfig.from_env()


def is_seo_enabled() -> bool:
    """Quick check if any SEO integration is enabled."""
    config = get_seo_config()
    return config.is_valid()
