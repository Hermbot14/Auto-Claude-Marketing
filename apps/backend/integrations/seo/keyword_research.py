"""
Keyword Research Module
========================

Provides keyword research and analysis capabilities.

Features:
- Keyword discovery and expansion
- Search volume and difficulty analysis
- Search intent classification
- Keyword opportunity scoring
- Long-tail keyword identification
"""

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from .config import SEOConfig, get_seo_config

logger = logging.getLogger(__name__)


class SearchIntent(str, Enum):
    """Search intent categories."""

    INFORMATIONAL = "informational"
    NAVIGATIONAL = "navigational"
    COMMERCIAL_INVESTIGATION = "commercial_investigation"
    TRANSACTIONAL = "transactional"


@dataclass
class KeywordData:
    """Keyword research data."""

    keyword: str
    search_volume: int | None = None
    difficulty: int | None = None  # 0-100
    opportunity_score: int | None = None  # 0-100
    search_intent: SearchIntent = SearchIntent.INFORMATIONAL
    current_ranking: int | None = None
    cpc: float | None = None  # Cost per click
    competition: float | None = None  # 0-1
    trend: list[int] = field(default_factory=list)  # Monthly trend
    related_keywords: list[str] = field(default_factory=list)
    suggested_bid: float | None = None


class KeywordResearcher:
    """
    Keyword research and analysis.

    Supports multiple SEO tools:
    - SEMrush (primary)
    - Ahrefs (secondary)
    - Moz (fallback)
    - Built-in analysis (no API required)
    """

    def __init__(self, config: SEOConfig | None = None):
        """
        Initialize keyword researcher.

        Args:
            config: SEO configuration (uses env if None)
        """
        self.config = config or get_seo_config()

    def research_keywords(
        self,
        seed_keywords: list[str],
        location: str | None = None,
        language: str | None = None,
    ) -> list[KeywordData]:
        """
        Perform keyword research from seed keywords.

        Args:
            seed_keywords: Base keywords to research
            location: Target location (default: from config)
            language: Target language (default: from config)

        Returns:
            List of keyword data with metrics
        """
        location = location or self.config.default_location
        language = language or self.config.default_language

        logger.info(f"Researching {len(seed_keywords)} seed keywords")

        # Try API-based research first
        if self.config.semrush_enabled:
            return self._research_with_semrush(seed_keywords, location, language)
        elif self.config.ahrefs_enabled:
            return self._research_with_ahrefs(seed_keywords, location, language)
        elif self.config.moz_enabled:
            return self._research_with_moz(seed_keywords, location, language)
        else:
            # Fallback to built-in analysis
            return self._research_builtin(seed_keywords)

    def analyze_keyword_opportunity(
        self,
        keyword: str,
        your_ranking: int | None = None,
        target_ranking: int = 3,
    ) -> dict[str, Any]:
        """
        Analyze opportunity for a specific keyword.

        Args:
            keyword: Keyword to analyze
            your_ranking: Your current ranking (if any)
            target_ranking: Target ranking position

        Returns:
            Opportunity analysis with recommendations
        """
        logger.info(f"Analyzing opportunity for: {keyword}")

        # Get keyword data
        keywords = self.research_keywords([keyword])
        if not keywords:
            return {"error": "No data available for keyword"}

        kw_data = keywords[0]

        # Calculate opportunity
        opportunity = self._calculate_opportunity_score(kw_data, your_ranking)

        # Generate recommendations
        recommendations = self._generate_recommendations(kw_data, your_ranking)

        return {
            "keyword": keyword,
            "current_ranking": your_ranking,
            "target_ranking": target_ranking,
            "search_volume": kw_data.search_volume,
            "difficulty": kw_data.difficulty,
            "opportunity_score": opportunity,
            "search_intent": kw_data.search_intent.value,
            "recommendations": recommendations,
            "estimated_traffic_potential": self._estimate_traffic(
                kw_data.search_volume, target_ranking
            ),
        }

    def find_keyword_gaps(
        self,
        your_keywords: list[str],
        competitor_keywords: list[str],
    ) -> list[dict[str, Any]]:
        """
        Find keywords competitors rank for that you don't.

        Args:
            your_keywords: Keywords you rank for
            competitor_keywords: Keywords competitor ranks for

        Returns:
            List of keyword gap opportunities
        """
        logger.info("Finding keyword gaps")

        your_set = set(k.lower() for k in your_keywords)
        competitor_set = set(k.lower() for k in competitor_keywords)

        gaps = competitor_set - your_set

        # Research each gap
        opportunities = []
        for gap in list(gaps)[:20]:  # Limit to 20 for performance
            kw_data = self.research_keywords([gap])
            if kw_data:
                opportunities.append(
                    {
                        "keyword": gap,
                        "search_volume": kw_data[0].search_volume,
                        "difficulty": kw_data[0].difficulty,
                        "opportunity_score": kw_data[0].opportunity_score,
                        "search_intent": kw_data[0].search_intent.value,
                    }
                )

        # Sort by opportunity score
        opportunities.sort(
            key=lambda x: x.get("opportunity_score") or 0, reverse=True
        )

        return opportunities

    def classify_search_intent(self, keyword: str) -> SearchIntent:
        """
        Classify the search intent for a keyword.

        Args:
            keyword: Keyword to classify

        Returns:
            Search intent category
        """
        keyword_lower = keyword.lower()

        # Transactional indicators
        transactional_words = [
            "buy",
            "price",
            "cheap",
            "deal",
            "discount",
            "order",
            "purchase",
            "sale",
            "coupon",
            "best price",
        ]
        if any(word in keyword_lower for word in transactional_words):
            return SearchIntent.TRANSACTIONAL

        # Commercial investigation indicators
        commercial_words = [
            "best",
            "review",
            "vs",
            "comparison",
            "compare",
            "top",
            "rating",
            "recommended",
        ]
        if any(word in keyword_lower for word in commercial_words):
            return SearchIntent.COMMERCIAL_INVESTIGATION

        # Navigational indicators
        navigational_patterns = ["login", "signin", "official", "website", "www"]
        if any(
            pattern in keyword_lower or keyword_lower.startswith(pattern)
            for pattern in navigational_patterns
        ):
            return SearchIntent.NAVIGATIONAL

        # Default to informational
        return SearchIntent.INFORMATIONAL

    def _calculate_opportunity_score(
        self, kw_data: KeywordData, current_ranking: int | None
    ) -> int:
        """Calculate opportunity score (0-100)."""
        if not kw_data.search_volume or not kw_data.difficulty:
            return 50

        # Base score from search volume
        volume_score = min(kw_data.search_volume / 1000, 100)

        # Penalty for high difficulty
        difficulty_penalty = kw_data.difficulty

        # Bonus for ranking gaps
        ranking_bonus = 0
        if current_ranking and current_ranking > 10:
            ranking_bonus = (current_ranking - 10) * 2

        # Calculate final score
        opportunity = (volume_score * 0.6) + ((100 - difficulty_penalty) * 0.4)
        opportunity += ranking_bonus

        return min(max(int(opportunity), 0), 100)

    def _generate_recommendations(
        self, kw_data: KeywordData, current_ranking: int | None
    ) -> list[str]:
        """Generate SEO recommendations based on keyword analysis."""
        recommendations = []

        if kw_data.difficulty and kw_data.difficulty > 70:
            recommendations.append(
                "High difficulty - consider long-tail variations or focus on lower-competition keywords"
            )

        if current_ranking and current_ranking > 10:
            recommendations.append(
                f"Currently ranking #{current_ranking} - optimize content to reach page 1"
            )

        if not current_ranking:
            recommendations.append("Not ranking - create new content targeting this keyword")

        if kw_data.search_volume and kw_data.search_volume > 1000:
            recommendations.append("High search volume - prioritize in content calendar")

        intent_recommendations = {
            SearchIntent.INFORMATIONAL: "Create comprehensive, educational content",
            SearchIntent.COMMERCIAL_INVESTIGATION: "Include comparisons and reviews",
            SearchIntent.TRANSACTIONAL: "Optimize for conversions with clear CTAs",
            SearchIntent.NAVIGATIONAL: "Ensure brand visibility in search results",
        }
        recommendations.append(intent_recommendations.get(kw_data.search_intent, ""))

        return [r for r in recommendations if r]

    def _estimate_traffic(self, search_volume: int | None, ranking: int) -> int:
        """Estimate organic traffic from ranking position."""
        if not search_volume:
            return 0

        # CTR by position (approximate)
        ctr_by_position = {
            1: 0.30,
            2: 0.15,
            3: 0.10,
            4: 0.08,
            5: 0.06,
            6: 0.05,
            7: 0.04,
            8: 0.03,
            9: 0.02,
            10: 0.02,
        }

        ctr = ctr_by_position.get(ranking, 0.01)
        return int(search_volume * ctr)

    def _research_with_semrush(
        self, seed_keywords: list[str], location: str, language: str
    ) -> list[KeywordData]:
        """Research keywords using SEMrush API."""
        # TODO: Implement SEMrush API integration
        logger.info("SEMrush API integration not yet implemented")
        return self._research_builtin(seed_keywords)

    def _research_with_ahrefs(
        self, seed_keywords: list[str], location: str, language: str
    ) -> list[KeywordData]:
        """Research keywords using Ahrefs API."""
        # TODO: Implement Ahrefs API integration
        logger.info("Ahrefs API integration not yet implemented")
        return self._research_builtin(seed_keywords)

    def _research_with_moz(
        self, seed_keywords: list[str], location: str, language: str
    ) -> list[KeywordData]:
        """Research keywords using Moz API."""
        # TODO: Implement Moz API integration
        logger.info("Moz API integration not yet implemented")
        return self._research_builtin(seed_keywords)

    def _research_builtin(self, seed_keywords: list[str]) -> list[KeywordData]:
        """
        Built-in keyword analysis (no API required).

        Provides basic analysis based on keyword patterns.
        """
        results = []

        for keyword in seed_keywords:
            intent = self.classify_search_intent(keyword)

            # Generate related keywords (basic variations)
            related = self._generate_related_keywords(keyword)

            results.append(
                KeywordData(
                    keyword=keyword,
                    search_intent=intent,
                    related_keywords=related,
                )
            )

        return results

    def _generate_related_keywords(self, keyword: str) -> list[str]:
        """Generate related keyword variations."""
        variations = []

        # Add common modifiers
        modifiers = [
            "best",
            "how to",
            "guide",
            "tips",
            "tutorial",
            "vs",
            "review",
            "cheap",
            "near me",
        ]

        for modifier in modifiers[:5]:  # Limit variations
            variations.append(f"{modifier} {keyword}")
            variations.append(f"{keyword} {modifier}")

        return variations[:10]  # Return top 10
