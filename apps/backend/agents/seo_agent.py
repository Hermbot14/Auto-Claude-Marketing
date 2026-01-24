"""
SEO Agent Module
================

Handles SEO analysis and optimization sessions for marketing campaigns.
Provides keyword research, on-page SEO analysis, backlink tracking,
competitor analysis, and rank tracking capabilities.
"""

import asyncio
import logging
from pathlib import Path
from typing import Any

from core.client import create_client
from phase_config import get_phase_model, get_phase_thinking_budget
from phase_event import ExecutionPhase, emit_phase
from prompts import get_seo_prompt
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


async def run_seo_agent(
    project_dir: Path,
    spec_dir: Path,
    model: str,
    verbose: bool = False,
    seo_task: str | None = None,
) -> bool:
    """
    Run the SEO agent for campaign analysis and optimization.

    The SEO agent:
    - Analyzes campaign content for SEO opportunities
    - Performs keyword research and analysis
    - Provides on-page SEO recommendations
    - Tracks competitor SEO strategies
    - Monitors search engine rankings
    - Generates SEO-optimized content suggestions

    Args:
        project_dir: Root directory for the project
        spec_dir: Directory containing the campaign spec
        model: Claude model to use
        verbose: Whether to show detailed output
        seo_task: Specific SEO task to perform (keyword_research, on_page_analysis,
                 backlink_tracking, competitor_analysis, rank_tracking)

    Returns:
        bool: True if SEO analysis completed successfully
    """
    # Initialize status manager for ccstatusline
    status_manager = StatusManager(project_dir)
    status_manager.set_active(spec_dir.name, BuildState.BUILDING)
    emit_phase(ExecutionPhase.CODING, "SEO analysis")

    # Show header
    content = [
        bold(f"{icon(Icons.SEARCH)} SEO AGENT SESSION"),
        "",
        f"Spec: {highlight(spec_dir.name)}",
        muted("Analyzing and optimizing campaign content for search engines."),
        "",
        muted("The agent will perform SEO analysis and provide recommendations."),
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

    # Determine SEO task
    if not seo_task:
        seo_task = "comprehensive_analysis"

    print_status(f"SEO Task: {seo_task}", "progress")
    print()

    # Get model and thinking budget
    seo_model = get_phase_model(spec_dir, "seo", model)
    seo_thinking_budget = get_phase_thinking_budget(spec_dir, "seo")

    # Create client with SEO agent permissions
    client = create_client(
        project_dir,
        spec_dir,
        seo_model,
        agent_type="seo_agent",
        max_thinking_tokens=seo_thinking_budget,
    )

    # Generate prompt for SEO analysis
    prompt = get_seo_prompt(spec_dir, plan, seo_task)

    # Retrieve Graphiti memory context (previous SEO insights, keywords)
    memory_context = await get_graphiti_context(
        spec_dir,
        project_dir,
        {
            "description": f"Performing SEO analysis: {seo_task}",
            "id": f"seo-{seo_task}",
            "type": "seo_analysis",
        },
    )
    if memory_context:
        prompt += "\n\n" + memory_context
        print_status("Graphiti memory context loaded", "success")

    print_status("Running SEO agent...", "progress")
    print()

    try:
        # Run SEO analysis session
        async with client:
            status, response = await run_agent_session(
                client, prompt, spec_dir, verbose, phase=ExecutionPhase.CODING
            )

        if status == "error":
            print()
            print_status("SEO analysis failed", "error")
            status_manager.update(state=BuildState.ERROR)
            return False

        # Success - display completion message
        print()
        content = [
            bold(f"{icon(Icons.SUCCESS)} SEO ANALYSIS COMPLETE"),
            "",
            f"Task: {highlight(seo_task)}",
            "",
            muted("SEO analysis and recommendations generated successfully."),
        ]
        print(box(content, width=70, style="heavy"))
        print()
        status_manager.update(state=BuildState.PAUSED)
        return True

    except Exception as e:
        print()
        print_status(f"SEO analysis error: {e}", "error")
        logger.error(f"SEO analysis error: {e}", exc_info=True)
        status_manager.update(state=BuildState.ERROR)
        return False


async def run_keyword_research(
    project_dir: Path,
    spec_dir: Path,
    model: str,
    verbose: bool = False,
) -> bool:
    """
    Run keyword research analysis.

    Args:
        project_dir: Root directory for the project
        spec_dir: Directory containing the campaign spec
        model: Claude model to use
        verbose: Whether to show detailed output

    Returns:
        bool: True if keyword research completed successfully
    """
    return await run_seo_agent(
        project_dir, spec_dir, model, verbose, seo_task="keyword_research"
    )


async def run_on_page_analysis(
    project_dir: Path,
    spec_dir: Path,
    model: str,
    verbose: bool = False,
) -> bool:
    """
    Run on-page SEO analysis.

    Args:
        project_dir: Root directory for the project
        spec_dir: Directory containing the campaign spec
        model: Claude model to use
        verbose: Whether to show detailed output

    Returns:
        bool: True if on-page analysis completed successfully
    """
    return await run_seo_agent(
        project_dir, spec_dir, model, verbose, seo_task="on_page_analysis"
    )


async def run_competitor_seo_analysis(
    project_dir: Path,
    spec_dir: Path,
    model: str,
    verbose: bool = False,
) -> bool:
    """
    Run competitor SEO analysis.

    Args:
        project_dir: Root directory for the project
        spec_dir: Directory containing the campaign spec
        model: Claude model to use
        verbose: Whether to show detailed output

    Returns:
        bool: True if competitor analysis completed successfully
    """
    return await run_seo_agent(
        project_dir, spec_dir, model, verbose, seo_task="competitor_analysis"
    )


async def run_rank_tracking(
    project_dir: Path,
    spec_dir: Path,
    model: str,
    verbose: bool = False,
) -> bool:
    """
    Run rank tracking analysis.

    Args:
        project_dir: Root directory for the project
        spec_dir: Directory containing the campaign spec
        model: Claude model to use
        verbose: Whether to show detailed output

    Returns:
        bool: True if rank tracking completed successfully
    """
    return await run_seo_agent(
        project_dir, spec_dir, model, verbose, seo_task="rank_tracking"
    )
