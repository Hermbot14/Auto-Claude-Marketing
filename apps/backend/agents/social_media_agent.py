"""
Social Media Agent Module
=========================

Handles social media content generation, scheduling, and publishing
across multiple platforms (Twitter/X, LinkedIn, Instagram, Facebook).

Generates platform-specific content with hashtag optimization and
provides engagement tracking capabilities.
"""

import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from core.client import create_client
from phase_config import get_phase_model, get_phase_thinking_budget
from phase_event import ExecutionPhase, emit_phase
from prompts import get_social_media_prompt
from ui import (
    BuildState,
    Icons,
    StatusManager,
    bold,
    box,
    highlight,
    icon,
    muted,
    print_status,
)

from .memory_manager import get_graphiti_context
from .session import run_agent_session
from .utils import find_subtask_in_plan, load_implementation_plan

logger = logging.getLogger(__name__)


async def run_social_media_agent(
    project_dir: Path,
    spec_dir: Path,
    model: str,
    verbose: bool = False,
) -> bool:
    """
    Run the social media agent to generate and schedule social media content.

    The social media agent:
    - Reads the campaign plan from implementation_plan.json
    - Identifies next pending social media subtask
    - Generates platform-specific content (Twitter, LinkedIn, Instagram, Facebook)
    - Optimizes hashtags for each platform
    - Creates scheduling recommendations
    - Provides engagement tracking setup
    - Updates plan status

    Args:
        project_dir: Root directory for the project
        spec_dir: Directory containing the campaign spec
        model: Claude model to use
        verbose: Whether to show detailed output

    Returns:
        bool: True if social media content creation completed successfully
    """
    # Initialize status manager for ccstatusline
    status_manager = StatusManager(project_dir)
    status_manager.set_active(spec_dir.name, BuildState.BUILDING)
    emit_phase(ExecutionPhase.CODING, "Social media content generation")

    # Show header
    content = [
        bold(f"{icon(Icons.SHARE)} SOCIAL MEDIA AGENT SESSION"),
        "",
        f"Spec: {highlight(spec_dir.name)}",
        muted(
            "Generating platform-specific social media content with hashtag optimization."
        ),
        "",
        muted(
            "The agent will create content for Twitter/X, LinkedIn, Instagram, and Facebook."
        ),
    ]
    print()
    print(box(content, width=70, style="heavy"))
    print()

    # Load implementation plan
    plan = load_implementation_plan(spec_dir)
    if not plan:
        print_status("Error: Could not load implementation plan", "error")
        status_manager.update(state=BuildState.ERROR)
        return False

    # Find next pending social media subtask
    next_subtask = None
    for phase in plan.get("phases", []):
        # Check if phase dependencies are met
        depends_on = phase.get("depends_on", [])
        if depends_on:
            # Skip phases with unmet dependencies
            continue

        # Find first pending subtask
        for subtask in phase.get("subtasks", []):
            if subtask.get("status") == "pending":
                # Check if this is a social media related subtask
                deliverable_type = subtask.get("deliverable_type", "")
                channel = subtask.get("channel", "")
                if (
                    deliverable_type in ["copy", "social", "coordination"]
                    or channel in ["twitter", "linkedin", "instagram", "facebook", "social"]
                ):
                    next_subtask = subtask
                    break
        if next_subtask:
            break

    if not next_subtask:
        print_status("No pending social media subtasks found", "info")
        status_manager.update(state=BuildState.PAUSED)
        return False

    subtask_id = next_subtask.get("id")
    subtask_desc = next_subtask.get("description", "No description")
    deliverable_type = next_subtask.get("deliverable_type", "copy")
    channel = next_subtask.get("channel", "social")

    print_status(f"Working on: {subtask_id}", "progress")
    print(f"Description: {subtask_desc}")
    print(f"Channel: {channel}")
    print(f"Deliverable Type: {deliverable_type}")
    print()

    # Get model and thinking budget
    social_model = get_phase_model(spec_dir, "social_media", model)
    social_thinking_budget = get_phase_thinking_budget(spec_dir, "social_media")

    # Create client with social media agent permissions
    client = create_client(
        project_dir,
        spec_dir,
        social_model,
        agent_type="social_media",
        max_thinking_tokens=social_thinking_budget,
    )

    # Generate prompt for social media content creation
    prompt = get_social_media_prompt(spec_dir, next_subtask, plan)

    # Retrieve Graphiti memory context (brand patterns, previous content performance)
    memory_context = await get_graphiti_context(
        spec_dir,
        project_dir,
        {
            "description": f"Creating social media content for {subtask_desc}",
            "id": subtask_id,
            "type": "social_media",
            "channel": channel,
        },
    )
    if memory_context:
        prompt += "\n\n" + memory_context
        print_status("Graphiti memory context loaded", "success")

    print_status("Running social media agent...", "progress")
    print()

    try:
        # Run social media content creation session
        async with client:
            status, response = await run_agent_session(
                client, prompt, spec_dir, verbose, phase=ExecutionPhase.CODING
            )

        if status == "error":
            print()
            print_status("Social media content creation failed", "error")
            status_manager.update(state=BuildState.ERROR)
            return False

        # Check if subtask was marked as completed
        updated_plan = load_implementation_plan(spec_dir)
        if updated_plan:
            completed_subtask = find_subtask_in_plan(updated_plan, subtask_id)
            if completed_subtask and completed_subtask.get("status") == "completed":
                print()
                content = [
                    bold(f"{icon(Icons.SUCCESS)} SOCIAL MEDIA CONTENT COMPLETE"),
                    "",
                    f"Subtask: {highlight(subtask_id)}",
                    f"Description: {subtask_desc}",
                    f"Channel: {channel}",
                    "",
                    muted("Social media content created and scheduled successfully."),
                ]
                print(box(content, width=70, style="heavy"))
                print()
                status_manager.update(state=BuildState.PAUSED)
                return True
            else:
                print()
                print_status("Warning: Subtask not marked as completed", "warning")
                print(muted("The agent may not have updated the status."))
                print(muted("Check implementation_plan.json manually."))
                status_manager.update(state=BuildState.PAUSED)
                return False
        else:
            print()
            print_status("Error: Could not load updated implementation plan", "error")
            status_manager.update(state=BuildState.ERROR)
            return False

    except Exception as e:
        print()
        print_status(f"Social media content creation error: {e}", "error")
        logger.error(f"Social media content creation error: {e}", exc_info=True)
        status_manager.update(state=BuildState.ERROR)
        return False


async def run_social_media_session(
    client: Any,
    spec_dir: Path,
    subtask: dict,
    plan: dict,
    verbose: bool = False,
) -> tuple[str, str]:
    """
    Run a single social media agent session.

    Args:
        client: Claude SDK client
        spec_dir: Spec directory path
        subtask: The subtask to work on
        plan: Full implementation plan
        verbose: Whether to show detailed output

    Returns:
        (status, response_text) tuple
    """
    channel = subtask.get("channel", "social")

    message = f"""Create social media content for the following subtask:

Subtask ID: {subtask.get('id')}
Description: {subtask.get('description')}
Deliverable Type: {subtask.get('deliverable_type', 'copy')}
Channel: {channel}

Campaign Context:
- Campaign: {plan.get('campaign', 'N/A')}
- Type: {plan.get('campaign_type', 'N/A')}
- Target Audience: {plan.get('target_audience', 'N/A')}
- Key Messages: {', '.join(plan.get('key_messages', []))}

Files to Create: {', '.join(subtask.get('files_to_create', []))}
Pattern Files: {', '.join(subtask.get('patterns_from', []))}

Verification Required: {subtask.get('verification', {}).get('type', 'manual')}

Platform Requirements for {channel.upper()}:
- Character limits and formatting
- Hashtag optimization
- Best posting times
- Engagement tracking setup

Please create platform-specific social media content following brand guidelines.
"""

    return await run_agent_session(
        client, message, spec_dir, verbose, phase=ExecutionPhase.CODING
    )


def create_platform_integrations(project_dir: Path) -> dict:
    """
    Create social media platform integrations configuration.

    This function sets up the structure for API integrations with
    social media platforms. Actual API credentials should be stored
    in environment variables for security.

    Args:
        project_dir: Root directory for the project

    Returns:
        Dict containing platform integration configurations
    """
    return {
        "twitter": {
            "api_key": "TWITTER_API_KEY",
            "api_secret": "TWITTER_API_SECRET",
            "access_token": "TWITTER_ACCESS_TOKEN",
            "access_secret": "TWITTER_ACCESS_SECRET",
            "bearer_token": "TWITTER_BEARER_TOKEN",
            "character_limit": 280,
            "supports_threads": True,
            "supports_images": True,
            "hashtag_limit": None,  # No specific limit but recommend 2-3
        },
        "linkedin": {
            "client_id": "LINKEDIN_CLIENT_ID",
            "client_secret": "LINKEDIN_CLIENT_SECRET",
            "access_token": "LINKEDIN_ACCESS_TOKEN",
            "character_limit": 3000,
            "supports_articles": True,
            "supports_images": True,
            "hashtag_limit": None,  # Recommend 3-5
        },
        "instagram": {
            "access_token": "INSTAGRAM_ACCESS_TOKEN",
            "business_account_id": "INSTAGRAM_BUSINESS_ID",
            "character_limit": 2200,
            "supports_stories": True,
            "supports_reels": True,
            "hashtag_limit": 30,
        },
        "facebook": {
            "app_id": "FACEBOOK_APP_ID",
            "app_secret": "FACEBOOK_APP_SECRET",
            "access_token": "FACEBOOK_ACCESS_TOKEN",
            "page_id": "FACEBOOK_PAGE_ID",
            "character_limit": 63206,
            "supports_stories": True,
            "supports_images": True,
            "hashtag_limit": None,  # Recommend 3-5
        },
    }


def get_optimal_posting_times(platform: str, timezone_str: str = "UTC") -> dict:
    """
    Get optimal posting times for each platform.

    Args:
        platform: Platform name (twitter, linkedin, instagram, facebook)
        timezone_str: Timezone string (default: UTC)

    Returns:
        Dict containing optimal posting times by day
    """
    optimal_times = {
        "twitter": {
            "weekdays": ["9:00 AM", "12:00 PM", "3:00 PM"],
            "weekends": ["10:00 AM", "12:00 PM"],
            "best_day": "Wednesday",
            "notes": "Post during commute hours and lunch breaks",
        },
        "linkedin": {
            "weekdays": ["8:00 AM", "12:00 PM", "5:00 PM"],
            "weekends": [],
            "best_day": "Tuesday",
            "notes": "Business hours only, avoid weekends",
        },
        "instagram": {
            "weekdays": ["11:00 AM", "2:00 PM", "7:00 PM"],
            "weekends": ["10:00 AM", "1:00 PM", "6:00 PM"],
            "best_day": "Friday",
            "notes": "Lunch hours and evening perform best",
        },
        "facebook": {
            "weekdays": ["9:00 AM", "3:00 PM"],
            "weekends": ["12:00 PM"],
            "best_day": "Thursday",
            "notes": "Mid-morning and mid-afternoon work well",
        },
    }

    return optimal_times.get(platform, {})


def generate_hashtags(content: str, platform: str, max_count: int = 30) -> list[str]:
    """
    Generate optimized hashtags for social media content.

    Args:
        content: The social media content
        platform: Target platform
        max_count: Maximum number of hashtags (platform-specific)

    Returns:
        List of optimized hashtags
    """
    # This is a placeholder for hashtag generation logic
    # In a full implementation, this would use NLP to extract keywords
    # and generate relevant hashtags based on trending topics

    # Platform-specific hashtag limits
    platform_limits = {
        "twitter": 3,  # Twitter recommends 2-3 hashtags
        "linkedin": 5,  # LinkedIn recommends 3-5 hashtags
        "instagram": 30,  # Instagram allows up to 30 hashtags
        "facebook": 5,  # Facebook recommends 3-5 hashtags
    }

    limit = platform_limits.get(platform, max_count)

    # Extract potential keywords from content
    # This would be more sophisticated in a real implementation
    words = content.lower().split()
    keywords = [w for w in words if len(w) > 4 and w.isalpha()]

    # Generate hashtags (in real implementation, use API for trending tags)
    hashtags = []
    for word in keywords[:limit]:
        hashtags.append(f"#{word}")

    return hashtags


def create_engagement_tracking(subtask_id: str, platform: str) -> dict:
    """
    Create engagement tracking configuration for social media posts.

    Args:
        subtask_id: The subtask identifier
        platform: Social media platform

    Returns:
        Dict containing tracking metrics and configuration
    """
    return {
        "subtask_id": subtask_id,
        "platform": platform,
        "metrics": {
            "impressions": {"type": "count", "description": "Total views"},
            "reach": {"type": "count", "description": "Unique users reached"},
            "engagements": {"type": "count", "description": "Total interactions"},
            "likes": {"type": "count", "description": "Number of likes"},
            "comments": {"type": "count", "description": "Number of comments"},
            "shares": {"type": "count", "description": "Number of shares/retweets"},
            "clicks": {"type": "count", "description": "Link clicks"},
        },
        "tracking_url": f"https://example.com/track/{subtask_id}",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
