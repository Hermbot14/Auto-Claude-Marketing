"""
Prompt Loading Utilities
========================

Functions for loading agent prompts from markdown files.
Supports dynamic prompt assembly based on project type for context optimization.
"""

import json
import os
import re
import subprocess
from pathlib import Path

from .project_context import (
    detect_project_capabilities,
    get_mcp_tools_for_project,
    load_project_index,
)


def _validate_branch_name(branch: str | None) -> str | None:
    """
    Validate a git branch name for safety and correctness.

    Args:
        branch: The branch name to validate

    Returns:
        The validated branch name, or None if invalid
    """
    if not branch or not isinstance(branch, str):
        return None

    # Trim whitespace
    branch = branch.strip()

    # Reject empty or whitespace-only strings
    if not branch:
        return None

    # Enforce maximum length (git refs can be long, but 255 is reasonable)
    if len(branch) > 255:
        return None

    # Require at least one alphanumeric character
    if not any(c.isalnum() for c in branch):
        return None

    # Only allow common git-ref characters: letters, numbers, ., _, -, /
    # This prevents prompt injection and other security issues
    if not re.match(r"^[A-Za-z0-9._/-]+$", branch):
        return None

    # Reject suspicious patterns that could be prompt injection attempts
    # (newlines, control characters are already blocked by the regex above)

    return branch


def get_base_branch_from_metadata(spec_dir: Path) -> str | None:
    """
    Read baseBranch from task_metadata.json if it exists.

    Args:
        spec_dir: Directory containing the spec files

    Returns:
        The baseBranch from metadata, or None if not found or invalid
    """
    metadata_path = spec_dir / "task_metadata.json"
    if metadata_path.exists():
        try:
            with open(metadata_path, encoding="utf-8") as f:
                metadata = json.load(f)
                base_branch = metadata.get("baseBranch")
                # Validate the branch name before returning
                return _validate_branch_name(base_branch)
        except (json.JSONDecodeError, OSError):
            pass
    return None


# Alias for backwards compatibility (internal use)
_get_base_branch_from_metadata = get_base_branch_from_metadata


def _detect_base_branch(spec_dir: Path, project_dir: Path) -> str:
    """
    Detect the base branch for a project/task.

    Priority order:
    1. baseBranch from task_metadata.json (task-level override)
    2. DEFAULT_BRANCH environment variable
    3. Auto-detect main/master/develop (if they exist in git)
    4. Fall back to "main"

    Args:
        spec_dir: Directory containing the spec files
        project_dir: Project root directory

    Returns:
        The detected base branch name
    """
    # 1. Check task_metadata.json for task-specific baseBranch
    metadata_branch = _get_base_branch_from_metadata(spec_dir)
    if metadata_branch:
        return metadata_branch

    # 2. Check for DEFAULT_BRANCH env var
    env_branch = _validate_branch_name(os.getenv("DEFAULT_BRANCH"))
    if env_branch:
        # Verify the branch exists (with timeout to prevent hanging)
        try:
            result = subprocess.run(
                ["git", "rev-parse", "--verify", env_branch],
                cwd=project_dir,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=3,
            )
            if result.returncode == 0:
                return env_branch
        except subprocess.TimeoutExpired:
            # Treat timeout as branch verification failure
            pass

    # 3. Auto-detect main/master/develop
    for branch in ["main", "master", "develop"]:
        try:
            result = subprocess.run(
                ["git", "rev-parse", "--verify", branch],
                cwd=project_dir,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=3,
            )
            if result.returncode == 0:
                return branch
        except subprocess.TimeoutExpired:
            # Treat timeout as branch verification failure, try next branch
            continue

    # 4. Fall back to "main"
    return "main"


# Directory containing prompt files
# prompts/ is a sibling directory of prompts_pkg/, so go up one level first
PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def get_planner_prompt(spec_dir: Path, project_type: str = "coding") -> str:
    """
    Load the planner agent prompt with spec path injected.
    The planner creates subtask-based implementation plans.

    Args:
        spec_dir: Directory containing the spec.md file
        project_type: Type of project - "coding" (default) or "marketing"

    Returns:
        The planner prompt content with spec path
    """
    # Choose prompt file based on project type
    if project_type == "marketing":
        prompt_file = PROMPTS_DIR / "planner_marketing.md"
    else:
        prompt_file = PROMPTS_DIR / "planner.md"

    if not prompt_file.exists():
        raise FileNotFoundError(
            f"Planner prompt not found at {prompt_file}\n"
            f"Make sure the auto-claude/prompts/{prompt_file.name} file exists."
        )

    prompt = prompt_file.read_text(encoding="utf-8")

    # Inject spec directory information at the beginning
    if project_type == "marketing":
        spec_context = f"""## CAMPAIGN BRIEF LOCATION

Your campaign brief is located at: `{spec_dir}/spec.md`

🚨 CRITICAL FILE CREATION INSTRUCTIONS 🚨

You MUST use the Write tool to create these files in the spec directory:
- `{spec_dir}/implementation_plan.json` - Campaign plan with subtasks (USE WRITE TOOL!)
- `{spec_dir}/build-progress.txt` - Progress notes (USE WRITE TOOL!)
- `{spec_dir}/init.sh` - Environment setup script (USE WRITE TOOL!)

DO NOT just describe what these files should contain. You MUST actually call the Write tool
with the file path and complete content to create them.

The project root is the parent of auto-claude/. Create campaign deliverables in the project root, not in the spec directory.

---

"""
    else:
        spec_context = f"""## SPEC LOCATION

Your spec file is located at: `{spec_dir}/spec.md`

🚨 CRITICAL FILE CREATION INSTRUCTIONS 🚨

You MUST use the Write tool to create these files in the spec directory:
- `{spec_dir}/implementation_plan.json` - Subtask-based implementation plan (USE WRITE TOOL!)
- `{spec_dir}/build-progress.txt` - Progress notes (USE WRITE TOOL!)
- `{spec_dir}/init.sh` - Environment setup script (USE WRITE TOOL!)

DO NOT just describe what these files should contain. You MUST actually call the Write tool
with the file path and complete content to create them.

The project root is the parent of auto-claude/. Implement code in the project root, not in the spec directory.

---

"""
    return spec_context + prompt


def get_coding_prompt(spec_dir: Path) -> str:
    """
    Load the coding agent prompt with spec path injected.

    Args:
        spec_dir: Directory containing the spec.md and implementation_plan.json

    Returns:
        The coding agent prompt content with spec path
    """
    prompt_file = PROMPTS_DIR / "coder.md"

    if not prompt_file.exists():
        raise FileNotFoundError(
            f"Coding prompt not found at {prompt_file}\n"
            "Make sure the auto-claude/prompts/coder.md file exists."
        )

    prompt = prompt_file.read_text(encoding="utf-8")

    spec_context = f"""## SPEC LOCATION

Your spec and progress files are located at:
- Spec: `{spec_dir}/spec.md`
- Implementation plan: `{spec_dir}/implementation_plan.json`
- Progress notes: `{spec_dir}/build-progress.txt`
- Recovery context: `{spec_dir}/memory/attempt_history.json`

The project root is the parent of auto-claude/. All code goes in the project root, not in the spec directory.

---

"""

    # Check for recovery context (stuck subtasks, retry hints)
    recovery_context = _get_recovery_context(spec_dir)
    if recovery_context:
        spec_context += recovery_context

    # Check for human input file
    human_input_file = spec_dir / "HUMAN_INPUT.md"
    if human_input_file.exists():
        human_input = human_input_file.read_text(encoding="utf-8").strip()
        if human_input:
            spec_context += f"""## HUMAN INPUT (READ THIS FIRST!)

The human has left you instructions. READ AND FOLLOW THESE CAREFULLY:

{human_input}

After addressing this input, you may delete or clear the HUMAN_INPUT.md file.

---

"""

    return spec_context + prompt


def _get_recovery_context(spec_dir: Path) -> str:
    """
    Get recovery context if there are failed attempts or stuck subtasks.

    Args:
        spec_dir: Spec directory containing memory/

    Returns:
        Recovery context string or empty string
    """
    import json

    attempt_history_file = spec_dir / "memory" / "attempt_history.json"

    if not attempt_history_file.exists():
        return ""

    try:
        with open(attempt_history_file, encoding="utf-8") as f:
            history = json.load(f)

        # Check for stuck subtasks
        stuck_subtasks = history.get("stuck_subtasks", [])
        if stuck_subtasks:
            context = """## ⚠️ RECOVERY ALERT - STUCK SUBTASKS DETECTED

Some subtasks have been attempted multiple times without success. These subtasks need:
- A COMPLETELY DIFFERENT approach
- Possibly simpler implementation
- Or escalation to human if infeasible

Stuck subtasks:
"""
            for stuck in stuck_subtasks:
                context += f"- {stuck['subtask_id']}: {stuck['reason']} ({stuck['attempt_count']} attempts)\n"

            context += "\nBefore working on any subtask, check memory/attempt_history.json for previous attempts!\n\n---\n\n"
            return context

        # Check for subtasks with multiple attempts
        subtasks_with_retries = []
        for subtask_id, subtask_data in history.get("subtasks", {}).items():
            attempts = subtask_data.get("attempts", [])
            if len(attempts) > 1 and subtask_data.get("status") != "completed":
                subtasks_with_retries.append((subtask_id, len(attempts)))

        if subtasks_with_retries:
            context = """## ⚠️ RECOVERY CONTEXT - RETRY AWARENESS

Some subtasks have been attempted before. When working on these:
1. READ memory/attempt_history.json for the specific subtask
2. See what approaches were tried
3. Use a DIFFERENT approach

Subtasks with previous attempts:
"""
            for subtask_id, attempt_count in subtasks_with_retries:
                context += f"- {subtask_id}: {attempt_count} attempts\n"

            context += "\n---\n\n"
            return context

        return ""

    except (OSError, json.JSONDecodeError, UnicodeDecodeError):
        return ""


def get_followup_planner_prompt(spec_dir: Path) -> str:
    """
    Load the follow-up planner agent prompt with spec path and key files injected.
    The follow-up planner adds new subtasks to an existing completed implementation plan.

    Args:
        spec_dir: Directory containing the completed spec and implementation_plan.json

    Returns:
        The follow-up planner prompt content with paths injected
    """
    prompt_file = PROMPTS_DIR / "followup_planner.md"

    if not prompt_file.exists():
        raise FileNotFoundError(
            f"Follow-up planner prompt not found at {prompt_file}\n"
            "Make sure the auto-claude/prompts/followup_planner.md file exists."
        )

    prompt = prompt_file.read_text(encoding="utf-8")

    # Inject spec directory information at the beginning
    spec_context = f"""## SPEC LOCATION (FOLLOW-UP MODE)

You are adding follow-up work to a **completed** spec.

**Key files in this spec directory:**
- Spec: `{spec_dir}/spec.md`
- Follow-up request: `{spec_dir}/FOLLOWUP_REQUEST.md` (READ THIS FIRST!)
- Implementation plan: `{spec_dir}/implementation_plan.json` (APPEND to this, don't replace)
- Progress notes: `{spec_dir}/build-progress.txt`
- Context: `{spec_dir}/context.json`
- Memory: `{spec_dir}/memory/`

**Important paths:**
- Spec directory: `{spec_dir}`
- Project root: Parent of auto-claude/ (where code should be implemented)

**Your task:**
1. Read `{spec_dir}/FOLLOWUP_REQUEST.md` to understand what to add
2. Read `{spec_dir}/implementation_plan.json` to see existing phases/subtasks
3. ADD new phase(s) with pending subtasks to the existing plan
4. PRESERVE all existing subtasks and their statuses

---

"""
    return spec_context + prompt


def is_first_run(spec_dir: Path) -> bool:
    """
    Check if this is the first run (no valid implementation plan with subtasks exists yet).

    The spec runner may create a skeleton implementation_plan.json with empty phases.
    This function checks for actual phases with subtasks, not just file existence.

    Args:
        spec_dir: Directory containing spec files

    Returns:
        True if implementation_plan.json doesn't exist or has no subtasks
    """
    plan_file = spec_dir / "implementation_plan.json"

    if not plan_file.exists():
        return True

    try:
        with open(plan_file, encoding="utf-8") as f:
            plan = json.load(f)

        # Check if there are any phases with subtasks
        phases = plan.get("phases", [])
        if not phases:
            return True

        # Check if any phase has subtasks
        total_subtasks = sum(len(phase.get("subtasks", [])) for phase in phases)
        return total_subtasks == 0
    except (OSError, json.JSONDecodeError, UnicodeDecodeError):
        # If we can't read the file, treat as first run
        return True


def _load_prompt_file(filename: str) -> str:
    """
    Load a prompt file from the prompts directory.

    Args:
        filename: Relative path to prompt file (e.g., "qa_reviewer.md" or "mcp_tools/electron_validation.md")

    Returns:
        Content of the prompt file

    Raises:
        FileNotFoundError: If prompt file doesn't exist
    """
    prompt_file = PROMPTS_DIR / filename
    if not prompt_file.exists():
        raise FileNotFoundError(f"Prompt file not found: {prompt_file}")
    return prompt_file.read_text(encoding="utf-8")


def get_qa_reviewer_prompt(spec_dir: Path, project_dir: Path) -> str:
    """
    Load the QA reviewer prompt with project-specific MCP tools dynamically injected.

    This function:
    1. Loads the base QA reviewer prompt
    2. Detects project capabilities from project_index.json
    3. Injects only relevant MCP tool documentation (Electron, Puppeteer, DB, API)
    4. Detects and injects the correct base branch for git comparisons

    This saves context window by excluding irrelevant tool docs.
    For example, a CLI Python project won't get Electron validation docs.

    Args:
        spec_dir: Directory containing the spec files
        project_dir: Root directory of the project

    Returns:
        The QA reviewer prompt with project-specific tools injected
    """
    # Detect the base branch for this task (from task_metadata.json or auto-detect)
    base_branch = _detect_base_branch(spec_dir, project_dir)

    # Load base QA reviewer prompt
    base_prompt = _load_prompt_file("qa_reviewer.md")

    # Replace {{BASE_BRANCH}} placeholder with the actual base branch
    base_prompt = base_prompt.replace("{{BASE_BRANCH}}", base_branch)

    # Load project index and detect capabilities
    project_index = load_project_index(project_dir)
    capabilities = detect_project_capabilities(project_index)

    # Get list of MCP tool doc files to include
    mcp_tool_files = get_mcp_tools_for_project(capabilities)

    # Load and assemble MCP tool sections
    mcp_sections = []
    for tool_file in mcp_tool_files:
        try:
            section = _load_prompt_file(tool_file)
            mcp_sections.append(section)
        except FileNotFoundError:
            # Skip missing files gracefully
            pass

    # Inject spec context at the beginning
    spec_context = f"""## SPEC LOCATION

Your spec and progress files are located at:
- Spec: `{spec_dir}/spec.md`
- Implementation plan: `{spec_dir}/implementation_plan.json`
- Progress notes: `{spec_dir}/build-progress.txt`
- QA report output: `{spec_dir}/qa_report.md`
- Fix request output: `{spec_dir}/QA_FIX_REQUEST.md`

The project root is: `{project_dir}`

## GIT BRANCH CONFIGURATION

**Base branch for comparison:** `{base_branch}`

When checking for unrelated changes, use three-dot diff syntax:
```bash
git diff {base_branch}...HEAD --name-status
```

This shows only changes made in the spec branch since it diverged from `{base_branch}`.

---

## PROJECT CAPABILITIES DETECTED

"""

    # Add capability summary for transparency
    active_caps = [k for k, v in capabilities.items() if v]
    if active_caps:
        spec_context += (
            "Based on project analysis, the following capabilities were detected:\n"
        )
        for cap in active_caps:
            cap_name = (
                cap.replace("is_", "").replace("has_", "").replace("_", " ").title()
            )
            spec_context += f"- {cap_name}\n"
        spec_context += "\nRelevant validation tools have been included below.\n\n"
    else:
        spec_context += (
            "No special project capabilities detected. Using standard validation.\n\n"
        )

    spec_context += "---\n\n"

    # Find injection point in base prompt (after PHASE 4, before PHASE 5)
    injection_marker = (
        "<!-- PROJECT-SPECIFIC VALIDATION TOOLS WILL BE INJECTED HERE -->"
    )

    if mcp_sections and injection_marker in base_prompt:
        # Replace marker with actual MCP tool sections
        mcp_content = "\n\n---\n\n## PROJECT-SPECIFIC VALIDATION TOOLS\n\n"
        mcp_content += "The following validation tools are available based on your project type:\n\n"
        mcp_content += "\n\n---\n\n".join(mcp_sections)
        mcp_content += "\n\n---\n"

        # Replace the multi-line marker comment block
        marker_pattern = r"<!-- PROJECT-SPECIFIC VALIDATION TOOLS WILL BE INJECTED HERE -->.*?<!-- - API validation \(for projects with API endpoints\) -->"
        base_prompt = re.sub(marker_pattern, mcp_content, base_prompt, flags=re.DOTALL)
    elif mcp_sections:
        # Fallback: append at the end if marker not found
        base_prompt += "\n\n---\n\n## PROJECT-SPECIFIC VALIDATION TOOLS\n\n"
        base_prompt += "\n\n---\n\n".join(mcp_sections)

    return spec_context + base_prompt


def get_qa_fixer_prompt(spec_dir: Path, project_dir: Path) -> str:
    """
    Load the QA fixer prompt with spec paths injected.

    Args:
        spec_dir: Directory containing the spec files
        project_dir: Root directory of the project

    Returns:
        The QA fixer prompt content with paths injected
    """
    base_prompt = _load_prompt_file("qa_fixer.md")

    spec_context = f"""## SPEC LOCATION

Your spec and progress files are located at:
- Spec: `{spec_dir}/spec.md`
- Implementation plan: `{spec_dir}/implementation_plan.json`
- QA fix request: `{spec_dir}/QA_FIX_REQUEST.md` (READ THIS FIRST!)
- QA report: `{spec_dir}/qa_report.md`

The project root is: `{project_dir}`

---

"""
    return spec_context + base_prompt


def get_content_creator_prompt(spec_dir: Path, subtask: dict, plan: dict) -> str:
    """
    Load the content creator prompt with campaign and subtask context injected.

    Args:
        spec_dir: Directory containing the spec files
        subtask: The subtask to work on (with id, description, deliverable_type, etc.)
        plan: Full implementation plan (campaign info, phases, etc.)

    Returns:
        The content creator prompt with context injected
    """
    base_prompt = _load_prompt_file("content_creator.md")

    # Build comprehensive context
    spec_context = f"""## CAMPAIGN LOCATION

Your campaign files are located at:
- Spec: `{spec_dir}/spec.md`
- Implementation plan: `{spec_dir}/implementation_plan.json`
- Context: `{spec_dir}/context.json`
- Brand patterns: `{spec_dir}/memory/brand_patterns.md`
- Content insights: `{spec_dir}/memory/content_insights/`

The project root is the parent of auto-claude/. Create content in the project root.

---

## CURRENT SUBTASK

**Subtask ID**: {subtask.get('id')}
**Description**: {subtask.get('description')}
**Deliverable Type**: {subtask.get('deliverable_type', 'copy')}
**Channel**: {subtask.get('channel', 'general')}

**Files to Create**:
{chr(10).join(f"- {f}" for f in subtask.get('files_to_create', []))}

**Pattern Files**:
{chr(10).join(f"- {f}" for f in subtask.get('patterns_from', []))}

**Verification**: {subtask.get('verification', {}).get('type', 'manual')}

---

## CAMPAIGN CONTEXT

**Campaign**: {plan.get('campaign', 'N/A')}
**Type**: {plan.get('campaign_type', 'N/A')}
**Target Audience**: {plan.get('target_audience', 'N/A')}

**Key Messages**:
{chr(10).join(f"- {msg}" for msg in plan.get('key_messages', []))}

**Success Metrics**:
- Primary: {plan.get('success_metrics', {}).get('primary', 'N/A')}
- Secondary: {', '.join(plan.get('success_metrics', {}).get('secondary', []))}

---

## YOUR DELIVERABLE

Create the marketing content specified in the current subtask above.

**Requirements**:
1. Read brand guidelines from project context
2. Apply SEO optimization (keywords, meta descriptions, headings)
3. Match the tone to the campaign type
4. Follow platform-specific best practices
5. Include quality checks before finalizing

**Content Type Guidelines**:
- Blog posts: 1,000-2,500 words, SEO-optimized, educational
- Social media: Platform-specific (Twitter: 280 chars, LinkedIn: 1,500 chars, etc.)
- Email campaigns: Subject line + body, mobile-responsive, clear CTA
- Ad copy: Benefit-focused, character limits by platform
- Landing pages: Headline, body, CTA, trust elements

**Brand Consistency**:
- All content must sound like it comes from the same brand
- Use approved terminology and language
- Reflect brand values consistently

**SEO Requirements** (for web content):
- Primary keyword in title/first paragraph
- Meta description (150-160 characters)
- Proper heading structure (H1 → H2 → H3)
- Internal/external links
- Alt text for images

---

"""

    return spec_context + base_prompt


def get_email_marketing_prompt(spec_dir: Path, subtask: dict, plan: dict) -> str:
    """
    Load the email marketing prompt with campaign and subtask context injected.

    Args:
        spec_dir: Directory containing the spec files
        subtask: The subtask to work on (with id, description, deliverable_type, etc.)
        plan: Full implementation plan (campaign info, phases, etc.)

    Returns:
        The email marketing prompt with context injected
    """
    base_prompt = _load_prompt_file("email_marketing.md")

    # Build comprehensive context
    spec_context = f"""## CAMPAIGN LOCATION

Your campaign files are located at:
- Spec: `{spec_dir}/spec.md`
- Implementation plan: `{spec_dir}/implementation_plan.json`
- Context: `{spec_dir}/context.json`
- Brand patterns: `{spec_dir}/memory/brand_patterns.md`
- Email insights: `{spec_dir}/memory/email_insights/`

The project root is the parent of auto-claude/. Create emails in the project root.

---

## CURRENT SUBTASK

**Subtask ID**: {subtask.get('id')}
**Description**: {subtask.get('description')}
**Deliverable Type**: {subtask.get('deliverable_type', 'email')}
**Email Type**: {subtask.get('email_type', 'broadcast')}

**Files to Create**:
{chr(10).join(f"- {f}" for f in subtask.get('files_to_create', []))}

**Pattern Files**:
{chr(10).join(f"- {f}" for f in subtask.get('patterns_from', []))}

**Verification**: {subtask.get('verification', {}).get('type', 'manual')}

---

## CAMPAIGN CONTEXT

**Campaign**: {plan.get('campaign', 'N/A')}
**Type**: {plan.get('campaign_type', 'N/A')}
**Target Audience**: {plan.get('target_audience', 'N/A')}

**Key Messages**:
{chr(10).join(f"- {msg}" for msg in plan.get('key_messages', []))}

**Success Metrics**:
- Primary: {plan.get('success_metrics', {}).get('primary', 'N/A')}
- Secondary: {', '.join(plan.get('success_metrics', {}).get('secondary', []))}

---

## YOUR DELIVERABLE

Create the email campaign specified in the current subtask above.

**Requirements**:
1. Read brand guidelines from project context
2. Create compelling subject lines (30-50 characters, A/B test variants)
3. Write scannable email body (200-300 words)
4. Add personalization tags ({{firstName}}, {{company}}, etc.)
5. Include clear CTA (single action, above the fold)
6. Ensure CAN-SPAM compliance (unsubscribe link, physical address)
7. Create drip sequence if applicable (3-7 emails over 2-4 weeks)

**Email Types**:
- **Broadcast**: One-time newsletter, announcement
- **Drip Sequence**: Nurture campaign, 3-7 emails
- **Welcome Series**: New subscriber onboarding, 3-5 emails
- **Transactional**: Order confirmations, shipping notifications
- **Promotional**: Sales, product launches, urgency/scarcity

**Subject Line Principles**:
- Use numbers: "5 ways to..."
- Create curiosity: "The secret to..."
- Add urgency: "24 hours left..."
- Personalize: "Sarah, your report is ready"
- Ask questions: "Ready for X?"
- Avoid spam triggers: ALL CAPS, "Free", excessive punctuation

**Email Structure**:
- Subject line: 30-50 characters (mobile: 25-30)
- Preheader: 80-100 characters
- Greeting: Personalized when possible
- Hook: First sentence grabs attention
- Body: Single value proposition, scannable
- CTA: Clear, single action
- Footer: Unsubscribe link, physical address

**CAN-SPAM Compliance**:
- Clear unsubscribe link
- Physical mailing address
- Accurate from name and subject line
- Honor opt-out requests

**Deliverability**:
- Spam score under 5/10
- Clean HTML code
- Balance text/images (60/40)
- Authenticate domain (SPF, DKIM)

---

"""

    return spec_context + base_prompt


def get_social_media_prompt(spec_dir: Path, subtask: dict, plan: dict) -> str:
    """
    Load the social media agent prompt with campaign and subtask context injected.

    Args:
        spec_dir: Directory containing the spec files
        subtask: The subtask to work on (with id, description, deliverable_type, etc.)
        plan: Full implementation plan (campaign info, phases, etc.)

    Returns:
        The social media agent prompt with context injected
    """
    base_prompt = _load_prompt_file("social_media.md")

    # Build comprehensive context
    channel = subtask.get("channel", "social")

    spec_context = f"""## CAMPAIGN LOCATION

Your campaign files are located at:
- Spec: `{spec_dir}/spec.md`
- Implementation plan: `{spec_dir}/implementation_plan.json`
- Context: `{spec_dir}/context.json`
- Brand patterns: `{spec_dir}/memory/brand_patterns.md`
- Social media insights: `{spec_dir}/memory/social_media/`

The project root is the parent of auto-claude/. Create social media content in the project root.

---

## CURRENT SUBTASK

**Subtask ID**: {subtask.get('id')}
**Description**: {subtask.get('description')}
**Deliverable Type**: {subtask.get('deliverable_type', 'copy')}
**Channel**: {channel}

**Files to Create**:
{chr(10).join(f"- {f}" for f in subtask.get('files_to_create', []))}

**Pattern Files**:
{chr(10).join(f"- {f}" for f in subtask.get('patterns_from', []))}

**Verification**: {subtask.get('verification', {}).get('type', 'manual')}

---

## CAMPAIGN CONTEXT

**Campaign**: {plan.get('campaign', 'N/A')}
**Type**: {plan.get('campaign_type', 'N/A')}
**Target Audience**: {plan.get('target_audience', 'N/A')}

**Key Messages**:
{chr(10).join(f"- {msg}" for msg in plan.get('key_messages', []))}

**Success Metrics**:
- Primary: {plan.get('success_metrics', {}).get('primary', 'N/A')}
- Secondary: {', '.join(plan.get('success_metrics', {}).get('secondary', []))}

---

## YOUR DELIVERABLE

Create platform-specific social media content for {channel.upper()}.

**Requirements**:
1. Read brand guidelines from project context
2. Follow platform-specific formatting (character limits, structure)
3. Optimize hashtags for the platform
4. Schedule posts at optimal times
5. Set up engagement tracking
6. Maintain brand consistency across platforms

**Platform Specifications**:

**Twitter/X:**
- Character limit: 280 (premium: 25,000)
- Hashtags: 2-3 relevant tags
- Best times: 9am, 12pm, 3pm weekdays
- Structure: Hook, value, CTA, hashtags

**LinkedIn:**
- Character limit: 3,000 (optimal: 1,500)
- Hashtags: 3-5 targeted tags
- Best times: 8am, 12pm, 5pm weekdays (business hours only)
- Structure: Hook, story/insight, takeaway, CTA

**Instagram:**
- Caption limit: 2,200 (optimal: 150-300)
- Hashtags: 20-30 (mix popular + niche)
- Best times: 11am, 2pm, 7pm weekdays; 10am, 1pm, 6pm weekends
- Structure: Hook, value/story, engagement question, hashtags

**Facebook:**
- Character limit: 63,206 (optimal: 40-80)
- Hashtags: 3-5 relevant tags
- Best times: 9am, 3pm weekdays; 12pm weekends
- Structure: Question or statement, value, CTA

**Hashtag Strategy**:
- Research trending and niche hashtags
- Use platform-specific limits (Twitter: 2-3, LinkedIn: 3-5, Instagram: 20-30, Facebook: 3-5)
- Mix of popular, niche, and branded hashtags
- Track hashtag performance

**Content Scheduling**:
- Post at optimal times for each platform
- Consider target audience time zone
- Space out posts appropriately
- Create content calendar for tracking

**Engagement Tracking**:
- Set up tracking URLs (UTM parameters)
- Define metrics: impressions, reach, engagements, clicks, shares
- Monitor and respond to comments
- Document performance insights

**Multi-Platform Strategy**:
- Adapt core message for each platform
- Cross-promote strategically
- Maintain consistent brand voice
- Use platform-specific features (threads, stories, reels)

---

"""

    return spec_context + base_prompt


def get_seo_prompt(spec_dir: Path, plan: dict, seo_task: str = "comprehensive_analysis") -> str:
    """
    Load the SEO agent prompt with campaign context injected.

    Args:
        spec_dir: Directory containing the spec files
        plan: Full implementation plan (campaign info, phases, etc.)
        seo_task: Specific SEO task to perform

    Returns:
        The SEO agent prompt with context injected
    """
    base_prompt = _load_prompt_file("seo.md")

    # Build comprehensive context
    spec_context = f"""## CAMPAIGN LOCATION

Your campaign files are located at:
- Spec: `{spec_dir}/spec.md`
- Implementation plan: `{spec_dir}/implementation_plan.json`
- Context: `{spec_dir}/context.json`
- Brand patterns: `{spec_dir}/memory/brand_patterns.md`
- SEO insights: `{spec_dir}/memory/seo_insights.md`
- Keyword research: `{spec_dir}/memory/keyword_research.json`

The project root is the parent of auto-claude/. Save SEO reports in the memory/ directory.

---

## SEO TASK

**Task Type**: {seo_task}

**Task Types**:
- `keyword_research`: Keyword discovery and opportunity analysis
- `on_page_analysis`: On-page SEO audit and recommendations
- `backlink_tracking`: Backlink profile analysis and opportunities
- `competitor_analysis`: Competitor SEO intelligence and gaps
- `rank_tracking`: Position tracking and visibility monitoring
- `comprehensive_analysis`: Full SEO audit covering all areas

---

## CAMPAIGN CONTEXT

**Campaign**: {plan.get('campaign', 'N/A')}
**Type**: {plan.get('campaign_type', 'N/A')}
**Target Audience**: {plan.get('target_audience', 'N/A')}

**Key Messages**:
{chr(10).join(f"- {msg}" for msg in plan.get('key_messages', []))}

**Success Metrics**:
- Primary: {plan.get('success_metrics', {}).get('primary', 'N/A')}
- Secondary: {', '.join(plan.get('success_metrics', {}).get('secondary', []))}

---

## YOUR SEO ANALYSIS

Perform the SEO task specified above and generate comprehensive reports.

**Requirements**:
1. Read campaign context and brand guidelines
2. Perform SEO analysis based on task type
3. Generate data-driven recommendations
4. Create SEO reports in memory/ directory
5. Provide content optimization briefs for content creators

**SEO Capabilities**:
- **Keyword Research**: Search volume, difficulty, opportunity scoring, search intent
- **On-Page SEO**: Title tags, meta descriptions, headings, content structure, internal linking
- **Backlink Analysis**: Profile analysis, gap identification, opportunity scoring
- **Competitor Intelligence**: Keyword gaps, content strategies, backlink comparison
- **Rank Tracking**: Position monitoring, visibility scoring, trend analysis

**Output Files**:
- `memory/seo_analysis_YYYYMMDD.json`: Detailed analysis results
- `memory/seo_insights.md`: Summary and recommendations
- `memory/keyword_research.json`: Keyword opportunity data
- `memory/competitor_seo_analysis.json`: Competitor intelligence

**Integration with Content Creation**:
After SEO analysis, provide SEO content briefs that include:
- Primary and secondary keywords
- Title tag and meta description recommendations
- Heading structure
- Content length and format requirements
- Internal/external linking suggestions

---

"""

    return spec_context + base_prompt
