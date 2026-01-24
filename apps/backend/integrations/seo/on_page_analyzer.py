"""
On-Page SEO Analyzer
====================

Analyzes web pages and content for SEO optimization.

Features:
- Title tag analysis
- Meta description analysis
- Heading structure audit
- Content optimization checks
- Internal linking analysis
- Technical SEO assessment
"""

import logging
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from bs4 import BeautifulSoup

from .config import SEOConfig, get_seo_config

logger = logging.getLogger(__name__)


class IssueSeverity(str, Enum):
    """Issue severity levels."""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


@dataclass
class SEOIssue:
    """SEO issue found during analysis."""

    type: str
    severity: IssueSeverity
    description: str
    recommendation: str
    location: str | None = None
    current_value: str | None = None
    expected_value: str | None = None


@dataclass
class OnPageAnalysisResult:
    """Results from on-page SEO analysis."""

    url: str
    title_tag: str | None = None
    meta_description: str | None = None
    h1_tag: str | None = None
    h2_tags: list[str] = field(default_factory=list)
    h3_tags: list[str] = field(default_factory=list)
    word_count: int = 0
    issues: list[SEOIssue] = field(default_factory=list)
    score: int = 0  # 0-100 SEO score
    readability_score: int = 0  # 0-100
    keyword_density: dict[str, float] = field(default_factory=dict)
    internal_links: int = 0
    external_links: int = 0
    images: int = 0
    images_without_alt: int = 0


class OnPageAnalyzer:
    """
    On-page SEO analysis.

    Analyzes HTML content for SEO optimization opportunities.
    """

    def __init__(self, config: SEOConfig | None = None):
        """
        Initialize on-page analyzer.

        Args:
            config: SEO configuration (uses env if None)
        """
        self.config = config or get_seo_config()

    def analyze_html(
        self,
        html_content: str,
        url: str = "unknown",
        target_keywords: list[str] | None = None,
    ) -> OnPageAnalysisResult:
        """
        Analyze HTML content for SEO issues.

        Args:
            html_content: HTML content to analyze
            url: URL of the page (for reporting)
            target_keywords: Keywords to check for optimization

        Returns:
            OnPageAnalysisResult with issues and recommendations
        """
        logger.info(f"Analyzing on-page SEO for: {url}")

        soup = BeautifulSoup(html_content, "html.parser")
        result = OnPageAnalysisResult(url=url)

        # Extract basic elements
        result.title_tag = self._extract_title(soup)
        result.meta_description = self._extract_meta_description(soup)
        result.h1_tag = self._extract_h1(soup)
        result.h2_tags = self._extract_headings(soup, "h2")
        result.h3_tags = self._extract_headings(soup, "h3")

        # Analyze content
        body_text = self._extract_body_text(soup)
        result.word_count = len(body_text.split())

        # Count links
        result.internal_links = len(soup.find_all("a", href=re.compile(r"^/")))
        result.external_links = len(
            [a for a in soup.find_all("a", href=True) if not a["href"].startswith("/")]
        )

        # Analyze images
        result.images = len(soup.find_all("img"))
        result.images_without_alt = len(
            [img for img in soup.find_all("img") if not img.get("alt")]
        )

        # Run SEO checks
        self._check_title_tag(result)
        self._check_meta_description(result)
        self._check_heading_structure(result)
        self._check_content_length(result)
        self._check_images(result)
        self._check_internal_linking(result)
        self._check_keyword_optimization(result, body_text, target_keywords)

        # Calculate scores
        result.score = self._calculate_seo_score(result)
        result.readability_score = self._calculate_readability_score(body_text)

        # Calculate keyword density
        if target_keywords:
            result.keyword_density = self._calculate_keyword_density(
                body_text, target_keywords
            )

        return result

    def analyze_markdown(
        self,
        markdown_content: str,
        url: str = "unknown",
        target_keywords: list[str] | None = None,
    ) -> OnPageAnalysisResult:
        """
        Analyze markdown content for SEO issues.

        Args:
            markdown_content: Markdown content to analyze
            url: URL of the page (for reporting)
            target_keywords: Keywords to check for optimization

        Returns:
            OnPageAnalysisResult with issues and recommendations
        """
        logger.info(f"Analyzing markdown SEO for: {url}")

        result = OnPageAnalysisResult(url=url)

        # Extract headings from markdown
        result.h1_tag = self._extract_markdown_heading(markdown_content, 1)
        result.h2_tags = self._extract_markdown_headings(markdown_content, 2)
        result.h3_tags = self._extract_markdown_headings(markdown_content, 3)

        # Get word count
        result.word_count = len(markdown_content.split())

        # Extract frontmatter for title/description
        title, description = self._extract_frontmatter(markdown_content)
        result.title_tag = title
        result.meta_description = description

        # Run checks
        self._check_title_tag(result)
        self._check_meta_description(result)
        self._check_heading_structure(result)
        self._check_content_length(result)
        self._check_keyword_optimization(result, markdown_content, target_keywords)

        # Calculate scores
        result.score = self._calculate_seo_score(result)
        result.readability_score = self._calculate_readability_score(markdown_content)

        # Calculate keyword density
        if target_keywords:
            result.keyword_density = self._calculate_keyword_density(
                markdown_content, target_keywords
            )

        return result

    def _extract_title(self, soup: BeautifulSoup) -> str | None:
        """Extract title tag from HTML."""
        title_tag = soup.find("title")
        return title_tag.get_text() if title_tag else None

    def _extract_meta_description(self, soup: BeautifulSoup) -> str | None:
        """Extract meta description from HTML."""
        meta = soup.find("meta", attrs={"name": "description"})
        return meta.get("content") if meta else None

    def _extract_h1(self, soup: BeautifulSoup) -> str | None:
        """Extract H1 tag from HTML."""
        h1 = soup.find("h1")
        return h1.get_text() if h1 else None

    def _extract_headings(self, soup: BeautifulSoup, level: str) -> list[str]:
        """Extract headings of specific level."""
        headings = soup.find_all(level)
        return [h.get_text().strip() for h in headings]

    def _extract_body_text(self, soup: BeautifulSoup) -> str:
        """Extract body text from HTML."""
        body = soup.find("body")
        if body:
            # Remove scripts and styles
            for script in body(["script", "style"]):
                script.decompose()
            return body.get_text()
        return ""

    def _extract_markdown_heading(self, content: str, level: int) -> str | None:
        """Extract first heading at level from markdown."""
        pattern = f"^{'#' * level}\\s+(.+)$"
        match = re.search(pattern, content, re.MULTILINE)
        return match.group(1) if match else None

    def _extract_markdown_headings(self, content: str, level: int) -> list[str]:
        """Extract all headings at level from markdown."""
        pattern = f"^{'#' * level}\\s+(.+)$"
        matches = re.findall(pattern, content, re.MULTILINE)
        return matches

    def _extract_frontmatter(self, content: str) -> tuple[str | None, str | None]:
        """Extract title and description from YAML frontmatter."""
        frontmatter_match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
        if frontmatter_match:
            frontmatter = frontmatter_match.group(1)
            title = self._extract_yaml_field(frontmatter, "title")
            description = self._extract_yaml_field(frontmatter, "description")
            return title, description
        return None, None

    def _extract_yaml_field(self, yaml_content: str, field: str) -> str | None:
        """Extract a field value from YAML content."""
        pattern = f'{field}:\\s*["\']?([^"\'\\n]+)["\']?'
        match = re.search(pattern, yaml_content)
        return match.group(1).strip() if match else None

    def _check_title_tag(self, result: OnPageAnalysisResult) -> None:
        """Check title tag optimization."""
        if not result.title_tag:
            result.issues.append(
                SEOIssue(
                    type="missing_title",
                    severity=IssueSeverity.CRITICAL,
                    description="Missing title tag",
                    recommendation="Add a compelling title tag (50-60 characters)",
                    expected_value="50-60 characters",
                )
            )
            return

        length = len(result.title_tag)
        if length < 30:
            result.issues.append(
                SEOIssue(
                    type="title_too_short",
                    severity=IssueSeverity.HIGH,
                    description=f"Title tag too short ({length} characters)",
                    recommendation="Expand title to 50-60 characters for better SEO",
                    current_value=f"{length} characters",
                    expected_value="50-60 characters",
                )
            )
        elif length > 60:
            result.issues.append(
                SEOIssue(
                    type="title_too_long",
                    severity=IssueSeverity.MEDIUM,
                    description=f"Title tag too long ({length} characters)",
                    recommendation="Shorten title to 50-60 characters to avoid truncation",
                    current_value=f"{length} characters",
                    expected_value="50-60 characters",
                )
            )

    def _check_meta_description(self, result: OnPageAnalysisResult) -> None:
        """Check meta description optimization."""
        if not result.meta_description:
            result.issues.append(
                SEOIssue(
                    type="missing_meta_description",
                    severity=IssueSeverity.HIGH,
                    description="Missing meta description",
                    recommendation="Add a compelling meta description (150-160 characters)",
                    expected_value="150-160 characters",
                )
            )
            return

        length = len(result.meta_description)
        if length < 120:
            result.issues.append(
                SEOIssue(
                    type="meta_description_too_short",
                    severity=IssueSeverity.MEDIUM,
                    description=f"Meta description too short ({length} characters)",
                    recommendation="Expand to 150-160 characters for better CTR",
                    current_value=f"{length} characters",
                    expected_value="150-160 characters",
                )
            )
        elif length > 160:
            result.issues.append(
                SEOIssue(
                    type="meta_description_too_long",
                    severity=IssueSeverity.LOW,
                    description=f"Meta description too long ({length} characters)",
                    recommendation="Shorten to 150-160 characters to avoid truncation",
                    current_value=f"{length} characters",
                    expected_value="150-160 characters",
                )
            )

    def _check_heading_structure(self, result: OnPageAnalysisResult) -> None:
        """Check heading structure."""
        if not result.h1_tag:
            result.issues.append(
                SEOIssue(
                    type="missing_h1",
                    severity=IssueSeverity.CRITICAL,
                    description="Missing H1 tag",
                    recommendation="Add a single H1 tag with your primary keyword",
                )
            )

        if len(result.h2_tags) == 0 and result.word_count > 300:
            result.issues.append(
                SEOIssue(
                    type="missing_h2",
                    severity=IssueSeverity.MEDIUM,
                    description="No H2 tags found",
                    recommendation="Add H2 tags to structure your content",
                )
            )

    def _check_content_length(self, result: OnPageAnalysisResult) -> None:
        """Check content length."""
        if result.word_count < 300:
            result.issues.append(
                SEOIssue(
                    type="content_too_short",
                    severity=IssueSeverity.MEDIUM,
                    description=f"Content too short ({result.word_count} words)",
                    recommendation="Aim for at least 300 words for better SEO",
                    current_value=f"{result.word_count} words",
                    expected_value="300+ words",
                )
            )

    def _check_images(self, result: OnPageAnalysisResult) -> None:
        """Check image optimization."""
        if result.images_without_alt > 0:
            result.issues.append(
                SEOIssue(
                    type="images_missing_alt",
                    severity=IssueSeverity.MEDIUM,
                    description=f"{result.images_without_alt} images missing alt text",
                    recommendation="Add descriptive alt text to all images",
                    current_value=f"{result.images_without_alt} missing",
                    expected_value="All images with alt text",
                )
            )

    def _check_internal_linking(self, result: OnPageAnalysisResult) -> None:
        """Check internal linking."""
        if result.internal_links < 2 and result.word_count > 500:
            result.issues.append(
                SEOIssue(
                    type="few_internal_links",
                    severity=IssueSeverity.LOW,
                    description=f"Only {result.internal_links} internal links found",
                    recommendation="Add 3-5 internal links to related content",
                    current_value=f"{result.internal_links} links",
                    expected_value="3-5 links",
                )
            )

    def _check_keyword_optimization(
        self,
        result: OnPageAnalysisResult,
        content: str,
        target_keywords: list[str] | None,
    ) -> None:
        """Check keyword optimization."""
        if not target_keywords:
            return

        content_lower = content.lower()

        for keyword in target_keywords[:3]:  # Check top 3 keywords
            keyword_lower = keyword.lower()
            if keyword_lower not in content_lower:
                result.issues.append(
                    SEOIssue(
                        type="keyword_missing",
                        severity=IssueSeverity.MEDIUM,
                        description=f"Target keyword '{keyword}' not found in content",
                        recommendation=f"Naturally include '{keyword}' in your content",
                    )
                )

    def _calculate_seo_score(self, result: OnPageAnalysisResult) -> int:
        """Calculate overall SEO score (0-100)."""
        score = 100

        # Deduct points for issues
        for issue in result.issues:
            deductions = {
                IssueSeverity.CRITICAL: 20,
                IssueSeverity.HIGH: 10,
                IssueSeverity.MEDIUM: 5,
                IssueSeverity.LOW: 2,
                IssueSeverity.INFO: 0,
            }
            score -= deductions.get(issue.severity, 0)

        return max(score, 0)

    def _calculate_readability_score(self, content: str) -> int:
        """
        Calculate Flesch Reading Ease score.

        Returns 0-100 score (higher = easier to read).
        """
        words = content.split()
        sentences = re.split(r"[.!?]+", content)
        sentences = [s.strip() for s in sentences if s.strip()]

        if not words or not sentences:
            return 0

        word_count = len(words)
        sentence_count = len(sentences)
        syllable_count = sum(self._count_syllables(word) for word in words)

        # Flesch Reading Ease formula
        score = (
            206.835
            - (1.015 * (word_count / sentence_count))
            - (84.6 * (syllable_count / word_count))
        )

        return max(min(int(score), 100), 0)

    def _count_syllables(self, word: str) -> int:
        """Estimate syllable count in a word."""
        word = word.lower()
        word = re.sub(r"[^a-z]", "", word)

        if not word:
            return 0

        # Basic syllable counting
        count = 0
        vowels = "aeiouy"
        prev_was_vowel = False

        for char in word:
            is_vowel = char in vowels
            if is_vowel and not prev_was_vowel:
                count += 1
            prev_was_vowel = is_vowel

        # Adjust for silent e
        if word.endswith("e"):
            count -= 1

        # Ensure at least 1 syllable
        return max(count, 1)

    def _calculate_keyword_density(
        self, content: str, keywords: list[str]
    ) -> dict[str, float]:
        """Calculate keyword density as percentage."""
        words = content.lower().split()
        total_words = len(words)

        if total_words == 0:
            return {}

        density = {}
        for keyword in keywords:
            keyword_lower = keyword.lower()
            keyword_count = content.lower().count(keyword_lower)
            density[keyword] = round((keyword_count / total_words) * 100, 2)

        return density
