"""
SEO Integration Module
======================

Provides SEO analysis capabilities for marketing campaigns.

Supports:
- Keyword research and analysis
- On-page SEO auditing
- Backlink tracking and analysis
- Competitor SEO intelligence
- Rank tracking and monitoring

Integrations:
- SEMrush API (optional)
- Ahrefs API (optional)
- Moz API (optional)
- Google Search Console API (optional)
"""

from .config import SEOConfig, get_seo_config
from .keyword_research import KeywordResearcher
from .on_page_analyzer import OnPageAnalyzer
from .backlink_tracker import BacklinkTracker
from .competitor_analyzer import CompetitorAnalyzer
from .rank_tracker import RankTracker

__all__ = [
    "SEOConfig",
    "get_seo_config",
    "KeywordResearcher",
    "OnPageAnalyzer",
    "BacklinkTracker",
    "CompetitorAnalyzer",
    "RankTracker",
]
