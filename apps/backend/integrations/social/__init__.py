"""
Social Platform Integrations
============================

Unified API for publishing content across multiple social media platforms:
- Twitter/X
- LinkedIn
- Instagram
- Facebook

Each platform implements the SocialPlatform base interface for consistent
authentication, posting, scheduling, and analytics retrieval.
"""

from .base import SocialPlatform, SocialPlatformError, SocialPostResult
from .config import SocialConfig, get_social_config
from .facebook import FacebookPlatform
from .factory import create_platform, get_supported_platforms
from .instagram import InstagramPlatform
from .linkedin import LinkedInPlatform
from .models import MediaAttachment, ScheduledPost, SocialMetrics
from .twitter import TwitterPlatform

__all__ = [
    # Base classes
    "SocialPlatform",
    "SocialPlatformError",
    "SocialPostResult",
    # Configuration
    "SocialConfig",
    "get_social_config",
    # Platform implementations
    "TwitterPlatform",
    "LinkedInPlatform",
    "InstagramPlatform",
    "FacebookPlatform",
    # Factory
    "create_platform",
    "get_supported_platforms",
    # Models
    "MediaAttachment",
    "ScheduledPost",
    "SocialMetrics",
]

# Version info
__version__ = "1.0.0"
