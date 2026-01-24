"""
Marketing Analytics Agent
==========================

Agent for analyzing marketing data, generating insights, and providing
recommendations for campaign optimization, competitor intelligence, and
trend detection.
"""

import logging
from pathlib import Path
from typing import Any

from core.client import create_client
from prompts_pkg.project_context import load_project_index

logger = logging.getLogger(__name__)


async def analyze_marketing_data(
    project_dir: Path,
    query: str,
    campaign_context: dict[str, Any] | None = None,
    model: str = "claude-sonnet-4-5-20250929",
) -> dict[str, Any]:
    """
    Analyze marketing data and generate intelligence.

    Args:
        project_dir: Path to project directory
        query: User's marketing question or request
        campaign_context: Optional context about current campaigns
        model: Claude model to use

    Returns:
        Dictionary with analysis results including:
        - insights: Generated marketing insights
        - recommendations: Actionable recommendations
        - data_sources: Data sources consulted
        - confidence: Confidence level in analysis
    """
    try:
        # Load project context
        project_index = load_project_index(project_dir)

        # Build marketing context
        context = _build_marketing_context(project_index, campaign_context)

        # Create client with marketing analytics configuration
        spec_dir = project_dir / ".auto-claude" / "marketing-analytics"
        spec_dir.mkdir(parents=True, exist_ok=True)

        client = create_client(
            project_dir=project_dir,
            spec_dir=spec_dir,
            model=model,
            agent_type="marketing_analytics",
            max_thinking_tokens=10000,  # Higher thinking for strategic analysis
        )

        # Build system prompt with marketing focus
        system_prompt = _build_marketing_system_prompt(context)

        # Create agent session
        session_name = f"marketing-analytics-{int(query[:50])}"
        response = client.create_agent_session(
            name=session_name,
            starting_message=f"""Analyze the following marketing request:

Query: {query}

Context:
- Campaigns: {context.get('campaigns', 'No active campaigns')}
- Competitors: {context.get('competitors', 'No competitor data')}
- Metrics: {context.get('metrics', 'No performance data')}
- Goals: {context.get('goals', 'No specific goals')}

Please provide:
1. Key insights and findings
2. Data-driven recommendations
3. Trend analysis (if applicable)
4. Competitor intelligence (if applicable)
5. Optimization opportunities

Format your response with clear sections and actionable next steps."""
        )

        # Extract insights from response
        insights = _extract_insights(response, context)

        return {
            "success": True,
            "insights": insights,
            "context": context,
            "response": response,
        }

    except Exception as e:
        logger.error(f"Marketing analytics failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "insights": None,
        }


def _build_marketing_context(
    project_index: dict[str, Any],
    campaign_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build marketing context from project data."""
    context = {
        "project_type": project_index.get("project_type", "unknown"),
        "campaigns": [],
        "competitors": [],
        "metrics": {},
        "goals": [],
    }

    # Add campaign context if provided
    if campaign_context:
        context.update(campaign_context)

    # Extract marketing-related files
    marketing_files = [
        f for f in project_index.get("files", [])
        if any(keyword in f.lower() for keyword in ["campaign", "marketing", "ads", "social"])
    ]

    if marketing_files:
        context["marketing_files"] = marketing_files

    return context


def _build_marketing_system_prompt(context: dict[str, Any]) -> str:
    """Build system prompt for marketing analytics."""
    return f"""You are an expert Marketing Intelligence Analyst specializing in data-driven marketing insights, competitive analysis, and campaign optimization.

## Your Capabilities

1. **Campaign Performance Analysis**
   - Analyze campaign metrics (CTR, CPC, conversion rates, ROAS)
   - Identify underperforming campaigns and optimization opportunities
   - Compare performance across channels and segments
   - Provide actionable recommendations for improvement

2. **Competitor Intelligence**
   - Analyze competitor strategies and positioning
   - Identify competitive gaps and opportunities
   - Benchmark performance against industry standards
   - Monitor competitor campaign changes and messaging

3. **Trend Detection**
   - Identify emerging marketing trends in the industry
   - Analyze platform algorithm changes and their impact
   - Detect shifts in consumer behavior and preferences
   - Provide early warnings about market changes

4. **Recommendation Engine**
   - Generate A/B test ideas based on data
   - Suggest content optimization strategies
   - Recommend budget allocation adjustments
   - Propose channel-specific tactics

5. **Budget Optimization**
   - Analyze spend efficiency across channels
   - Recommend bid adjustments
   - Identify wasted spend and optimization opportunities
   - Suggest budget reallocation strategies

## Current Context

{context}

## Analysis Framework

For every analysis, provide:

1. **Data Summary**: What data you analyzed and key metrics
2. **Key Insights**: 3-5 critical findings with data backing
3. **Recommendations**: Actionable steps prioritized by impact
4. **Confidence Level**: How confident you are in the analysis (High/Medium/Low)
5. **Next Steps**: Specific actions to take immediately

## Quality Standards

- Base all insights on data, not assumptions
- Provide specific metrics and benchmarks
- Include context for recommendations (why this matters)
- Prioritize by business impact (ROI, revenue, efficiency)
- Be concise and actionable

## Marketing KPIs You Track

- **Awareness**: Impressions, reach, share of voice
- **Engagement**: CTR, engagement rate, time on page
- **Conversion**: Conversion rate, cost per conversion, ROAS
- **Retention**: Churn rate, customer lifetime value, repeat purchase rate
- **Advocacy**: NPS, referrals, social shares

Begin your analysis with the data and context provided."""


def _extract_insights(response: str, context: dict[str, Any]) -> dict[str, Any]:
    """Extract structured insights from agent response."""
    return {
        "summary": response[:500] if len(response) > 500 else response,
        "full_response": response,
        "categories": _categorize_insights(response),
        "confidence": "medium",  # Default, could be enhanced
        "recommendations": _extract_recommendations(response),
    }


def _categorize_insights(response: str) -> list[str]:
    """Categorize insights by type."""
    categories = []
    response_lower = response.lower()

    category_keywords = {
        "campaign_performance": ["campaign", "performance", "ctr", "conversion", "roas"],
        "competitor_intelligence": ["competitor", "competition", "market share", "benchmark"],
        "trend_analysis": ["trend", "emerging", "shift", "change", "algorithm"],
        "budget_optimization": ["budget", "spend", "cost", "efficiency", "allocation"],
        "content_strategy": ["content", "messaging", "creative", "copy", "a/b test"],
        "audience_insights": ["audience", "segment", "demographic", "persona", "targeting"],
    }

    for category, keywords in category_keywords.items():
        if any(keyword in response_lower for keyword in keywords):
            categories.append(category)

    return categories if categories else ["general"]


def _extract_recommendations(response: str) -> list[dict[str, Any]]:
    """Extract actionable recommendations from response."""
    recommendations = []

    # Simple extraction - could be enhanced with NLP
    lines = response.split("\n")
    for line in lines:
        line = line.strip()
        # Look for recommendation patterns
        if line.startswith(("-", "*", "•", "1.", "2.", "3.", "4.", "5.")):
            rec = line.lstrip("-*•123456789.").strip()
            if len(rec) > 20:  # Filter out short lines
                recommendations.append({
                    "text": rec,
                    "priority": "medium",  # Default priority
                    "category": _guess_recommendation_category(rec),
                })

    return recommendations[:10]  # Limit to top 10


def _guess_recommendation_category(rec: str) -> str:
    """Guess the category of a recommendation."""
    rec_lower = rec.lower()

    if any(word in rec_lower for word in ["campaign", "ad", "bid"]):
        return "campaign_optimization"
    if any(word in rec_lower for word in ["content", "copy", "creative", "image"]):
        return "content"
    if any(word in rec_lower for word in ["budget", "spend", "allocate"]):
        return "budget"
    if any(word in rec_lower for word in ["audience", "target", "segment"]):
        return "audience"
    if any(word in rec_lower for word in ["test", "experiment", "a/b"]):
        return "testing"

    return "general"
