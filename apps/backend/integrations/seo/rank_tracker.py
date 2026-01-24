"""
Rank Tracker Module
===================

Tracks search engine rankings for target keywords.

Features:
- Position tracking
- Visibility score calculation
- Ranking history and trends
- SERP feature tracking
- Competitor rank comparison
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from .config import SEOConfig, get_seo_config

logger = logging.getLogger(__name__)


@dataclass
class RankingData:
    """Keyword ranking data."""

    keyword: str
    current_position: int | None = None
    previous_position: int | None = None
    change: int | None = None  # Position change (positive = improved)
    url: str | None = None
    search_volume: int | None = None
    traffic: int | None = None  # Estimated organic traffic
    ctr: float | None = None  # Click-through rate
    trend: str = "stable"  # improving, declining, stable, volatile
    serp_features: list[str] = field(default_factory=list)  # featured_snippet, local_pack, etc.
    ranking_date: str | None = None


@dataclass
class VisibilityScore:
    """Visibility score metrics."""

    score: int  # 0-10,000+
    change: int  # Change from previous period
    tracked_keywords: int
    keywords_in_top_3: int
    keywords_in_top_10: int
    keywords_on_page_2: int  # Positions 11-20
    average_position: float


@dataclass
class RankTrackingResult:
    """Results from rank tracking."""

    keywords_tracked: int = 0
    rankings: list[RankingData] = field(default_factory=list)
    visibility: VisibilityScore | None = None
    top_performers: list[RankingData] = field(default_factory=list)
    quick_wins: list[RankingData] = field(
        default_factory=list
    )  # Keywords ranking 11-20
    decliners: list[RankingData] = field(default_factory=list)
    serp_features_owned: list[dict[str, Any]] = field(default_factory=list)
    serp_feature_opportunities: list[dict[str, Any]] = field(default_factory=list)


class RankTracker:
    """
    Rank tracking and monitoring.

    Supports multiple SEO tools:
    - SEMrush (primary)
    - Ahrefs (secondary)
    - Google Search Console (native)
    """

    def __init__(self, config: SEOConfig | None = None):
        """
        Initialize rank tracker.

        Args:
            config: SEO configuration (uses env if None)
        """
        self.config = config or get_seo_config()

    def track_rankings(
        self,
        keywords: list[str],
        domain: str,
        location: str | None = None,
        language: str | None = None,
    ) -> RankTrackingResult:
        """
        Track rankings for target keywords.

        Args:
            keywords: Keywords to track
            domain: Domain to check rankings for
            location: Target location
            language: Target language

        Returns:
            RankTrackingResult with ranking data
        """
        logger.info(f"Tracking rankings for {len(keywords)} keywords")

        location = location or self.config.default_location
        language = language or self.config.default_language

        # Try API-based tracking first
        if self.config.semrush_enabled:
            return self._track_with_semrush(keywords, domain, location, language)
        elif self.config.ahrefs_enabled:
            return self._track_with_ahrefs(keywords, domain, location, language)
        elif self.config.gsc_enabled:
            return self._track_with_gsc(keywords, domain)
        else:
            # Return empty result (no API configured)
            return RankTrackingResult()

    def calculate_visibility_score(
        self, rankings: list[RankingData]
    ) -> VisibilityScore:
        """
        Calculate overall visibility score.

        Args:
            rankings: List of ranking data

        Returns:
            VisibilityScore with calculated metrics
        """
        if not rankings:
            return VisibilityScore(score=0, tracked_keywords=0, **self._empty_metrics())

        tracked_keywords = len(rankings)

        # Count positions
        top_3 = len([r for r in rankings if r.current_position and r.current_position <= 3])
        top_10 = len([r for r in rankings if r.current_position and r.current_position <= 10])
        page_2 = len([r for r in rankings if r.current_position and 11 <= r.current_position <= 20])

        # Calculate average position
        positions = [r.current_position for r in rankings if r.current_position]
        avg_position = sum(positions) / len(positions) if positions else 100

        # Calculate visibility score
        # Weight: position 1 = 100 points, position 100 = 1 point
        score = sum(
            self._position_to_points(r.current_position, r.search_volume)
            for r in rankings
            if r.current_position
        )

        return VisibilityScore(
            score=int(score),
            change=0,  # Would need historical data
            tracked_keywords=tracked_keywords,
            keywords_in_top_3=top_3,
            keywords_in_top_10=top_10,
            keywords_on_page_2=page_2,
            average_position=round(avg_position, 1),
        )

    def find_quick_wins(self, rankings: list[RankingData]) -> list[RankingData]:
        """
        Find quick win opportunities (keywords ranking 11-20).

        Args:
            rankings: List of ranking data

        Returns:
            List of quick win opportunities sorted by search volume
        """
        quick_wins = [
            r
            for r in rankings
            if r.current_position and 11 <= r.current_position <= 20
        ]

        # Sort by search volume (descending)
        quick_wins.sort(
            key=lambda x: x.search_volume or 0, reverse=True
        )

        return quick_wins

    def find_serp_feature_opportunities(
        self, rankings: list[RankingData]
    ) -> list[dict[str, Any]]:
        """
        Find SERP feature opportunities.

        Args:
            rankings: List of ranking data

        Returns:
            List of SERP feature opportunities
        """
        opportunities = []

        for ranking in rankings:
            # Featured snippet opportunities (ranking 1-10, question keywords)
            if ranking.current_position and ranking.current_position <= 10:
                if any(
                    word in ranking.keyword.lower()
                    for word in ["how", "what", "why", "when", "where", "who", "guide"]
                ):
                    opportunities.append(
                        {
                            "keyword": ranking.keyword,
                            "feature": "featured_snippet",
                            "current_position": ranking.current_position,
                            "opportunity": "high",
                            "recommended_format": "definition or list format",
                        }
                    )

        return opportunities

    def analyze_ranking_trends(
        self, rankings: list[RankingData]
    ) -> dict[str, list[RankingData]]:
        """
        Analyze ranking trends.

        Args:
            rankings: List of ranking data

        Returns:
            Dictionary with trend categories
        """
        improving = []
        declining = []
        stable = []
        volatile = []

        for ranking in rankings:
            if ranking.change is None:
                continue

            if ranking.change > 5:
                improving.append(ranking)
            elif ranking.change < -5:
                declining.append(ranking)
            elif abs(ranking.change) <= 2:
                stable.append(ranking)
            else:
                volatile.append(ranking)

        return {
            "improving": improving,
            "declining": declining,
            "stable": stable,
            "volatile": volatile,
        }

    def _position_to_points(self, position: int, search_volume: int | None = None) -> float:
        """
        Convert ranking position to points.

        Higher position = more points.
        Weighted by search volume if available.
        """
        # Base points (100 for #1, 1 for #100)
        base_points = max(101 - position, 1)

        # Weight by search volume
        if search_volume:
            volume_weight = min(search_volume / 1000, 10)  # Cap at 10x
            return base_points * volume_weight

        return base_points

    def _empty_metrics(self) -> dict[str, int | float]:
        """Return empty metrics dict."""
        return {
            "keywords_in_top_3": 0,
            "keywords_in_top_10": 0,
            "keywords_on_page_2": 0,
            "average_position": 100.0,
        }

    def _track_with_semrush(
        self, keywords: list[str], domain: str, location: str, language: str
    ) -> RankTrackingResult:
        """Track rankings using SEMrush API."""
        # TODO: Implement SEMrush API integration
        logger.info("SEMrush API integration not yet implemented")
        return RankTrackingResult()

    def _track_with_ahrefs(
        self, keywords: list[str], domain: str, location: str, language: str
    ) -> RankTrackingResult:
        """Track rankings using Ahrefs API."""
        # TODO: Implement Ahrefs API integration
        logger.info("Ahrefs API integration not yet implemented")
        return RankTrackingResult()

    def _track_with_gsc(self, keywords: list[str], domain: str) -> RankTrackingResult:
        """Track rankings using Google Search Console API."""
        # TODO: Implement GSC API integration
        logger.info("Google Search Console API integration not yet implemented")
        return RankTrackingResult()

    def estimate_traffic_potential(
        self, keyword: str, target_position: int, search_volume: int | None = None
    ) -> int:
        """
        Estimate organic traffic potential for a keyword at target position.

        Args:
            keyword: Keyword to analyze
            target_position: Target ranking position
            search_volume: Monthly search volume

        Returns:
            Estimated monthly organic traffic
        """
        if not search_volume:
            return 0

        # CTR by position (industry averages)
        ctr_by_position = {
            1: 0.285,  # 28.5%
            2: 0.157,  # 15.7%
            3: 0.110,  # 11.0%
            4: 0.080,  # 8.0%
            5: 0.063,  # 6.3%
            6: 0.052,  # 5.2%
            7: 0.044,  # 4.4%
            8: 0.038,  # 3.8%
            9: 0.034,  # 3.4%
            10: 0.031,  # 3.1%
        }

        ctr = ctr_by_position.get(target_position, 0.01)  # Default to 1%
        return int(search_volume * ctr)
