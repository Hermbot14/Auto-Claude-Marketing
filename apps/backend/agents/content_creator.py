"""
Content Creator Agent Module
============================

Handles marketing content creation sessions for campaign deliverables.
Creates brand-aligned, SEO-optimized content across multiple channels.
"""

import asyncio
import logging
from pathlib import Path
from typing import Any

from core.client import create_client
from phase_config import get_phase_model, get_phase_thinking_budget
from phase_event import ExecutionPhase, emit_phase
from prompts import get_content_creator_prompt
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


async def run_content_creator(
    project_dir: Path,
    spec_dir: Path,
    model: str,
    verbose: bool = False,
) -> bool:
    """
    Run the content creator agent to generate marketing deliverables.

    The content creator agent:
    - Reads the campaign plan from implementation_plan.json
    - Identifies next pending content subtask
    - Generates brand-aligned marketing content
    - Applies SEO optimization
    - Performs quality checks
    - Updates plan status

    Args:
        project_dir: Root directory for the project
        spec_dir: Directory containing the campaign spec
        model: Claude model to use
        verbose: Whether to show detailed output

    Returns:
        bool: True if content creation completed successfully
    """
    # Initialize status manager for ccstatusline
    status_manager = StatusManager(project_dir)
    status_manager.set_active(spec_dir.name, BuildState.BUILDING)
    emit_phase(ExecutionPhase.CODING, "Content creation")

    # Show header
    content = [
        bold(f"{icon(Icons.PEN)} CONTENT CREATOR SESSION"),
        "",
        f"Spec: {highlight(spec_dir.name)}",
        muted("Generating marketing content with brand awareness and SEO optimization."),
        "",
        muted("The agent will create deliverables following the campaign plan."),
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

    # Find next pending content subtask
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
                # Check if this is a content-related subtask
                deliverable_type = subtask.get("deliverable_type", "")
                if deliverable_type in ["copy", "visual", "strategy", "coordination"]:
                    next_subtask = subtask
                    break
        if next_subtask:
            break

    if not next_subtask:
        print_status("No pending content subtasks found", "info")
        status_manager.update(state=BuildState.PAUSED)
        return False

    subtask_id = next_subtask.get("id")
    subtask_desc = next_subtask.get("description", "No description")
    deliverable_type = next_subtask.get("deliverable_type", "copy")

    print_status(f"Working on: {subtask_id}", "progress")
    print(f"Description: {subtask_desc}")
    print(f"Deliverable Type: {deliverable_type}")
    print()

    # Get model and thinking budget
    content_model = get_phase_model(spec_dir, "content", model)
    content_thinking_budget = get_phase_thinking_budget(spec_dir, "content")

    # Create client with content creator permissions
    client = create_client(
        project_dir,
        spec_dir,
        content_model,
        agent_type="content_creator",
        max_thinking_tokens=content_thinking_budget,
    )

    # Generate prompt for content creation
    prompt = get_content_creator_prompt(spec_dir, next_subtask, plan)

    # Retrieve Graphiti memory context (brand patterns, previous content)
    memory_context = await get_graphiti_context(
        spec_dir,
        project_dir,
        {
            "description": f"Creating content for {subtask_desc}",
            "id": subtask_id,
            "type": deliverable_type,
        },
    )
    if memory_context:
        prompt += "\n\n" + memory_context
        print_status("Graphiti memory context loaded", "success")

    print_status("Running content creator agent...", "progress")
    print()

    try:
        # Run content creation session
        async with client:
            status, response = await run_agent_session(
                client, prompt, spec_dir, verbose, phase=ExecutionPhase.CODING
            )

        if status == "error":
            print()
            print_status("Content creation failed", "error")
            status_manager.update(state=BuildState.ERROR)
            return False

        # Check if subtask was marked as completed
        updated_plan = load_implementation_plan(spec_dir)
        if updated_plan:
            completed_subtask = find_subtask_in_plan(updated_plan, subtask_id)
            if completed_subtask and completed_subtask.get("status") == "completed":
                print()
                content = [
                    bold(f"{icon(Icons.SUCCESS)} CONTENT CREATION COMPLETE"),
                    "",
                    f"Subtask: {highlight(subtask_id)}",
                    f"Description: {subtask_desc}",
                    "",
                    muted("Content created and verified successfully."),
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
        print_status(f"Content creation error: {e}", "error")
        logger.error(f"Content creation error: {e}", exc_info=True)
        status_manager.update(state=BuildState.ERROR)
        return False


async def run_content_creator_session(
    client: Any,
    spec_dir: Path,
    subtask: dict,
    plan: dict,
    verbose: bool = False,
) -> tuple[str, str]:
    """
    Run a single content creator session.

    Args:
        client: Claude SDK client
        spec_dir: Spec directory path
        subtask: The subtask to work on
        plan: Full implementation plan
        verbose: Whether to show detailed output

    Returns:
        (status, response_text) tuple
    """
    message = f"""Create marketing content for the following subtask:

Subtask ID: {subtask.get('id')}
Description: {subtask.get('description')}
Deliverable Type: {subtask.get('deliverable_type', 'copy')}
Channel: {subtask.get('channel', 'general')}

Campaign Context:
- Campaign: {plan.get('campaign', 'N/A')}
- Type: {plan.get('campaign_type', 'N/A')}
- Target Audience: {plan.get('target_audience', 'N/A')}
- Key Messages: {', '.join(plan.get('key_messages', []))}

Files to Create: {', '.join(subtask.get('files_to_create', []))}
Pattern Files: {', '.join(subtask.get('patterns_from', []))}

Verification Required: {subtask.get('verification', {}).get('type', 'manual')}

Please create the marketing content following brand guidelines and SEO best practices.
"""

    return await run_agent_session(
        client, message, spec_dir, verbose, phase=ExecutionPhase.CODING
    )
