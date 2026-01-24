"""
Email Marketing Agent Module
============================

Handles email marketing campaigns with drip sequences, personalization,
and A/B testing templates. Integrates with major email service providers.

Uses the new email provider integrations in integrations/email/ for
actual API communication with Mailchimp, SendGrid, and ConvertKit.
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from core.client import create_client
from phase_config import get_phase_model, get_phase_thinking_budget
from phase_event import ExecutionPhase, emit_phase
from prompts import get_email_marketing_prompt
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

# Import email provider integrations
from integrations.email import (
    CampaignAnalytics,
    ConvertKitProvider,
    EmailCampaign,
    EmailList,
    EmailProvider,
    EmailProviderError,
    MailchimpProvider,
    SendGridProvider,
    get_email_provider,
)


async def run_email_agent(
    project_dir: Path,
    spec_dir: Path,
    model: str,
    verbose: bool = False,
) -> bool:
    """
    Run the email marketing agent to generate email campaigns.

    The email agent:
    - Reads the campaign plan from implementation_plan.json
    - Identifies next pending email-related subtask
    - Generates email campaigns with drip sequences
    - Applies personalization and A/B testing templates
    - Integrates with email service providers via provider API
    - Tracks analytics

    Args:
        project_dir: Root directory for the project
        spec_dir: Directory containing the campaign spec
        model: Claude model to use
        verbose: Whether to show detailed output

    Returns:
        bool: True if email creation completed successfully
    """
    # Initialize status manager for ccstatusline
    status_manager = StatusManager(project_dir)
    status_manager.set_active(spec_dir.name, BuildState.BUILDING)
    emit_phase(ExecutionPhase.CODING, "Email marketing")

    # Show header
    content = [
        bold(f"{icon(Icons.EMAIL)} EMAIL MARKETING AGENT SESSION"),
        "",
        f"Spec: {highlight(spec_dir.name)}",
        muted(
            "Generating email campaigns with drip sequences, "
            "personalization, and A/B testing."
        ),
        "",
        muted("The agent will create email deliverables following the campaign plan."),
        "",
        muted("Available providers: Mailchimp, SendGrid, ConvertKit"),
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

    # Find next pending email subtask
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
                # Check if this is an email-related subtask
                deliverable_type = subtask.get("deliverable_type", "")
                subtask_desc = subtask.get("description", "").lower()

                # Email-related indicators
                is_email_subtask = (
                    "email" in deliverable_type.lower()
                    or "email" in subtask_desc
                    or "drip" in subtask_desc
                    or "newsletter" in subtask_desc
                    or "campaign" in subtask_desc
                )

                if is_email_subtask:
                    next_subtask = subtask
                    break
        if next_subtask:
            break

    if not next_subtask:
        print_status("No pending email subtasks found", "info")
        status_manager.update(state=BuildState.PAUSED)
        return False

    subtask_id = next_subtask.get("id")
    subtask_desc = next_subtask.get("description", "No description")
    deliverable_type = next_subtask.get("deliverable_type", "email")

    print_status(f"Working on: {subtask_id}", "progress")
    print(f"Description: {subtask_desc}")
    print(f"Deliverable Type: {deliverable_type}")
    print()

    # Get model and thinking budget
    email_model = get_phase_model(spec_dir, "email", model)
    email_thinking_budget = get_phase_thinking_budget(spec_dir, "email")

    # Create client with email agent permissions
    client = create_client(
        project_dir,
        spec_dir,
        email_model,
        agent_type="email_agent",
        max_thinking_tokens=email_thinking_budget,
    )

    # Generate prompt for email creation
    prompt = get_email_marketing_prompt(spec_dir, next_subtask, plan)

    # Add provider information to prompt
    prompt += _get_provider_info()

    # Retrieve Graphiti memory context (email patterns, previous campaigns)
    memory_context = await get_graphiti_context(
        spec_dir,
        project_dir,
        {
            "description": f"Creating email campaign for {subtask_desc}",
            "id": subtask_id,
            "type": deliverable_type,
        },
    )
    if memory_context:
        prompt += "\n\n" + memory_context
        print_status("Graphiti memory context loaded", "success")

    print_status("Running email marketing agent...", "progress")
    print()

    try:
        # Run email creation session
        async with client:
            status, response = await run_agent_session(
                client, prompt, spec_dir, verbose, phase=ExecutionPhase.CODING
            )

        if status == "error":
            print()
            print_status("Email creation failed", "error")
            status_manager.update(state=BuildState.ERROR)
            return False

        # Check if subtask was marked as completed
        updated_plan = load_implementation_plan(spec_dir)
        if updated_plan:
            completed_subtask = find_subtask_in_plan(updated_plan, subtask_id)
            if completed_subtask and completed_subtask.get("status") == "completed":
                print()
                content = [
                    bold(f"{icon(Icons.SUCCESS)} EMAIL CAMPAIGN CREATED"),
                    "",
                    f"Subtask: {highlight(subtask_id)}",
                    f"Description: {subtask_desc}",
                    "",
                    muted("Email campaign created and verified successfully."),
                ]
                print(box(content, width=70, style="heavy"))
                print()
                status_manager.update(state=BuildState.PAUSED)
                return True
            else:
                print()
                print_status(
                    "Warning: Subtask not marked as completed", "warning"
                )
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
        print_status(f"Email creation error: {e}", "error")
        logger.error(f"Email creation error: {e}", exc_info=True)
        status_manager.update(state=BuildState.ERROR)
        return False


def _get_provider_info() -> str:
    """
    Generate provider information section for agent prompt.

    Returns:
        Markdown-formatted provider information
    """
    lines = [
        "",
        "## Email Provider Integrations",
        "",
        "The following email service providers are available for campaign management:",
        "",
        "### 1. Mailchimp",
        "- **API**: Requires API key and audience ID",
        "- **Features**: Lists, campaigns, templates, analytics",
        "- **Usage**: `provider = get_email_provider('mailchimp', api_key='...', audience_id='...')`",
        "",
        "### 2. SendGrid",
        "- **API**: Requires API key",
        "- **Features**: Contact lists, single sends, marketing campaigns, analytics",
        "- **Usage**: `provider = get_email_provider('sendgrid', api_key='...')`",
        "",
        "### 3. ConvertKit",
        "- **API**: Requires API key (and secret for some endpoints)",
        "- **Features**: Forms (lists), broadcasts (campaigns), sequences, analytics",
        "- **Usage**: `provider = get_email_provider('convertkit', api_key='...', api_secret='...')`",
        "",
        "### Common Provider Interface",
        "All providers support the following operations:",
        "```python",
        "# Get lists/audiences",
        "lists = await provider.get_lists()",
        "",
        "# Create campaign",
        "campaign = await provider.create_campaign(",
        "    list_id='...',",
        "    subject='Welcome!',",
        "    html_content='<html>...</html>',",
        "    from_name='Sender',",
        "    from_email='sender@example.com'",
        ")",
        "",
        "# Send campaign",
        "await provider.send_campaign(campaign.id)",
        "",
        "# Get analytics",
        "analytics = await provider.get_analytics(campaign.id)",
        "print(f'Open rate: {analytics.open_rate}%')",
        "print(f'Click rate: {analytics.click_rate}%')",
        "",
        "# Add subscriber",
        "await provider.add_subscriber(",
        "    list_id='...',",
        "    email='user@example.com',",
        "    first_name='John'",
        ")",
        "```",
        "",
        "### Environment Variables",
        "Set these in `.env` file or environment:",
        "- `MAILCHIMP_API_KEY`: Mailchimp API key",
        "- `MAILCHIMP_AUDIENCE_ID`: Default Mailchimp audience ID (optional)",
        "- `SENDGRID_API_KEY`: SendGrid API key",
        "- `CONVERTKIT_API_KEY`: ConvertKit API key",
        "- `CONVERTKIT_API_SECRET`: ConvertKit API secret (optional)",
        "",
        "### Testing Connections",
        "```python",
        "provider = get_email_provider('mailchimp', api_key='...')",
        "is_connected = await provider.test_connection()",
        "```",
    ]

    return "\n".join(lines)


async def run_email_agent_session(
    client: Any,
    spec_dir: Path,
    subtask: dict,
    plan: dict,
    verbose: bool = False,
) -> tuple[str, str]:
    """
    Run a single email agent session.

    Args:
        client: Claude SDK client
        spec_dir: Spec directory path
        subtask: The subtask to work on
        plan: Full implementation plan
        verbose: Whether to show detailed output

    Returns:
        (status, response_text) tuple
    """
    message = f"""Create email campaign for the following subtask:

Subtask ID: {subtask.get('id')}
Description: {subtask.get('description')}
Deliverable Type: {subtask.get('deliverable_type', 'email')}
Email Type: {subtask.get('email_type', 'broadcast')}

Campaign Context:
- Campaign: {plan.get('campaign', 'N/A')}
- Type: {plan.get('campaign_type', 'N/A')}
- Target Audience: {plan.get('target_audience', 'N/A')}
- Key Messages: {', '.join(plan.get('key_messages', []))}

Files to Create: {', '.join(subtask.get('files_to_create', []))}
Pattern Files: {', '.join(subtask.get('patterns_from', []))}

Verification Required: {subtask.get('verification', {}).get('type', 'manual')}

{_get_provider_info()}

Please create the email campaign following best practices:
- Compelling subject lines (30-50 chars)
- Mobile-responsive design
- Personalization tags
- Clear CTAs
- CAN-SPAM compliance

Use the provider integrations to:
1. Connect to the email service (Mailchimp, SendGrid, or ConvertKit)
2. Create the campaign using provider.create_campaign()
3. Send the campaign using provider.send_campaign()
4. Track analytics using provider.get_analytics()
"""

    return await run_agent_session(
        client, message, spec_dir, verbose, phase=ExecutionPhase.CODING
    )


def document_email_insights(
    spec_dir: Path,
    subtask_id: str,
    email_type: str,
    insights: dict,
) -> Path:
    """
    Document email campaign insights for future reference.

    Args:
        spec_dir: Spec directory path
        subtask_id: ID of the completed subtask
        email_type: Type of email (broadcast, drip_sequence, welcome, etc.)
        insights: Dictionary containing insights data

    Returns:
        Path to the saved insights file
    """
    memory_dir = spec_dir / "memory"
    email_insights_dir = memory_dir / "email_insights"
    email_insights_dir.mkdir(parents=True, exist_ok=True)

    # Build insights
    insights_data = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "subtask_id": subtask_id,
        "email_type": email_type,
        "subject_line": insights.get("subject_line", ""),
        "personalization_used": insights.get("personalization", []),
        "ab_test_variants": insights.get("ab_test_variants", []),
        "segmentation": insights.get("segmentation", {}),
        "what_worked": insights.get("what_worked", []),
        "what_to_avoid": insights.get("what_to_avoid", []),
        "performance_predictions": insights.get("performance_predictions", {}),
        "recommendations": insights.get("recommendations", []),
        "provider": insights.get("provider", ""),
        "campaign_id": insights.get("campaign_id", ""),
        "analytics": insights.get("analytics", {}),
    }

    # Save insights
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    insight_file = email_insights_dir / f"email_{timestamp}.json"
    with open(insight_file, "w", encoding="utf-8") as f:
        json.dump(insights_data, f, indent=2)

    logger.info(f"Email insights saved to: {insight_file}")
    return insight_file
