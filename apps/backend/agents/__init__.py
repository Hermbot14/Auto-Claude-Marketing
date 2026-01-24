"""
Agents Module
=============

Modular agent system for autonomous coding and marketing content creation.

This module provides:
- run_autonomous_agent: Main coder agent loop
- run_followup_planner: Follow-up planner for completed specs
- run_content_creator: Marketing content generation agent
- run_social_media_agent: Social media content generation and scheduling agent
- run_email_agent: Email marketing campaigns and drip sequences agent
- Memory management (Graphiti + file-based fallback)
- Session management and post-processing
- Utility functions for git and plan management

Uses lazy imports to avoid circular dependencies.
"""

# Explicit import required by CodeQL static analysis
# (CodeQL doesn't recognize __getattr__ dynamic exports)
from .utils import sync_spec_to_source

__all__ = [
    # Main API
    "run_autonomous_agent",
    "run_followup_planner",
    "run_content_creator",
    "run_social_media_agent",
    "run_email_agent",
    # Memory
    "debug_memory_system_status",
    "get_graphiti_context",
    "save_session_memory",
    "save_session_to_graphiti",
    # Session
    "run_agent_session",
    "post_session_processing",
    # Utils
    "get_latest_commit",
    "get_commit_count",
    "load_implementation_plan",
    "find_subtask_in_plan",
    "find_phase_for_subtask",
    "sync_spec_to_source",
    # Constants
    "AUTO_CONTINUE_DELAY_SECONDS",
    "HUMAN_INTERVENTION_FILE",
]


def __getattr__(name):
    """Lazy imports to avoid circular dependencies."""
    if name in ("AUTO_CONTINUE_DELAY_SECONDS", "HUMAN_INTERVENTION_FILE"):
        from .base import AUTO_CONTINUE_DELAY_SECONDS, HUMAN_INTERVENTION_FILE

        return locals()[name]
    elif name == "run_autonomous_agent":
        from .coder import run_autonomous_agent

        return run_autonomous_agent
    elif name == "run_content_creator":
        from .content_creator import run_content_creator

        return run_content_creator
    elif name == "run_social_media_agent":
        from .social_media_agent import run_social_media_agent

        return run_social_media_agent
    elif name == "run_email_agent":
        from .email_agent import run_email_agent

        return run_email_agent
    elif name in (
        "debug_memory_system_status",
        "get_graphiti_context",
        "save_session_memory",
        "save_session_to_graphiti",
    ):
        from .memory_manager import (
            debug_memory_system_status,
            get_graphiti_context,
            save_session_memory,
            save_session_to_graphiti,
        )

        return locals()[name]
    elif name == "run_followup_planner":
        from .planner import run_followup_planner

        return run_followup_planner
    elif name in ("post_session_processing", "run_agent_session"):
        from .session import post_session_processing, run_agent_session

        return locals()[name]
    elif name in (
        "find_phase_for_subtask",
        "find_subtask_in_plan",
        "get_commit_count",
        "get_latest_commit",
        "load_implementation_plan",
        "sync_spec_to_source",
    ):
        from .utils import (
            find_phase_for_subtask,
            find_subtask_in_plan,
            get_commit_count,
            get_latest_commit,
            load_implementation_plan,
            sync_spec_to_source,
        )

        return locals()[name]
    raise AttributeError(f"module 'agents' has no attribute '{name}'")
