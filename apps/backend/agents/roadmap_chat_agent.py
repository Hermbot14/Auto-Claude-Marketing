"""
Roadmap Chat Agent

Provides natural language processing for roadmap manipulation commands.
This agent uses the Claude SDK to parse user intent and extract roadmap operations.
"""

import json
import re
from typing import Any, Optional
from dataclasses import dataclass, asdict

from core.client import create_client


@dataclass
class RoadmapOperation:
    """Represents a single roadmap manipulation operation."""
    type: str
    target_id: Optional[str]
    data: dict[str, Any]
    description: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class ChatResponse:
    """Response from the roadmap chat agent."""
    response: str
    operations: list[RoadmapOperation]

    def to_dict(self) -> dict[str, Any]:
        return {
            'response': self.response,
            'operations': [op.to_dict() for op in self.operations]
        }


class RoadmapChatAgent:
    """
    Agent for processing natural language roadmap manipulation commands.

    Supports:
    - Adding context to phases/tasks
    - Redefining phases and tasks
    - Updating item status
    - Re-arranging priority lists
    """

    # Available operation types
    OP_ADD_CONTEXT = 'add_context'
    OP_REDEFINE_PHASE = 'redefine_phase'
    OP_REDEFINE_TASK = 'redefine_task'
    OP_UPDATE_STATUS = 'update_status'
    OP_REARRANGE_PRIORITY = 'rearrange_priority'
    OP_ADD_TASK = 'add_task'
    OP_DELETE_TASK = 'delete_task'
    OP_MOVE_TASK = 'move_task'

    def __init__(self, project_dir: str, spec_dir: str):
        self.project_dir = project_dir
        self.spec_dir = spec_dir
        self.client = None

    def _get_client(self):
        """Lazy initialization of Claude SDK client."""
        if self.client is None:
            self.client = create_client(
                project_dir=self.project_dir,
                spec_dir=self.spec_dir,
                model='claude-sonnet-4-5-20250929',
                agent_type='roadmap_chat',
                max_thinking_tokens=5000
            )
        return self.client

    async def process_command(
        self,
        user_message: str,
        roadmap: dict[str, Any],
        competitor_analysis: Optional[dict[str, Any]] = None
    ) -> ChatResponse:
        """
        Process a natural language command and extract roadmap operations.

        Args:
            user_message: The user's natural language command
            roadmap: Current roadmap data
            competitor_analysis: Optional competitor analysis data

        Returns:
            ChatResponse with response text and extracted operations
        """
        # Build context for the AI
        context = self._build_context(roadmap, competitor_analysis)

        # System prompt for intent parsing
        system_prompt = self._get_system_prompt()

        # User prompt with the command
        user_prompt = f"""User Command: {user_message}

Current Roadmap Context:
{json.dumps(context, indent=2)}

Analyze this command and extract any roadmap operations. Return a JSON response with:
- response: A natural language response to the user
- operations: Array of operation objects to execute

Each operation should have:
- type: One of {self._get_operation_types()}
- target_id: The ID of the phase/task to modify (if applicable)
- data: Additional data needed for the operation
- description: Human-readable description of what the operation does

Return ONLY valid JSON, no markdown formatting."""

        client = self._get_client()

        # Create agent session
        try:
            response = client.create_agent_session(
                name='roadmap-chat',
                starting_message=user_prompt,
                system_prompt=system_prompt
            )

            # Parse the response
            response_text = response['content'][0]['text']

            # Extract JSON from response (handle markdown code blocks)
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response_text, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                # Try to find raw JSON
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    json_str = json_match.group(0)
                else:
                    # Fallback: treat entire response as the response text
                    return ChatResponse(
                        response=response_text,
                        operations=[]
                    )

            # Parse JSON
            result = json.loads(json_str)

            # Convert operations to RoadmapOperation objects
            operations = []
            for op_data in result.get('operations', []):
                operations.append(RoadmapOperation(
                    type=op_data['type'],
                    target_id=op_data.get('target_id'),
                    data=op_data.get('data', {}),
                    description=op_data.get('description', '')
                ))

            return ChatResponse(
                response=result.get('response', 'Command processed.'),
                operations=operations
            )

        except Exception as e:
            # Return error response
            return ChatResponse(
                response=f"I'm sorry, I encountered an error processing your request: {str(e)}",
                operations=[]
            )

    def _build_context(
        self,
        roadmap: dict[str, Any],
        competitor_analysis: Optional[dict[str, Any]]
    ) -> dict[str, Any]:
        """Build context for the AI from roadmap data."""
        context = {
            'phases': [],
            'features': [],
            'has_competitor_analysis': competitor_analysis is not None
        }

        # Add phase information
        for phase in roadmap.get('phases', []):
            context['phases'].append({
                'id': phase['id'],
                'name': phase['name'],
                'description': phase.get('description', ''),
                'status': phase['status']
            })

        # Add feature information
        for feature in roadmap.get('features', []):
            context['features'].append({
                'id': feature['id'],
                'title': feature['title'],
                'description': feature.get('description', ''),
                'phase_id': feature['phaseId'],
                'status': feature['status'],
                'priority': feature['priority']
            })

        return context

    def _get_system_prompt(self) -> str:
        """Get the system prompt for intent parsing."""
        return f"""You are a roadmap assistant that helps users manipulate their product roadmap using natural language.

Your job is to:
1. Understand the user's intent from their command
2. Extract structured operations that can be executed
3. Provide a helpful, friendly response

Supported Operations:
- add_context: Add context/notes to a phase or task
  - target_id: The phase/task ID
  - data: {{"context": "the context to add"}}

- redefine_phase: Change a phase's name or description
  - target_id: The phase ID
  - data: {{"name": "new name", "description": "new description"}}

- redefine_task: Change a task's title or description
  - target_id: The task/feature ID
  - data: {{"title": "new title", "description": "new description"}}

- update_status: Change the status of a task
  - target_id: The task/feature ID
  - data: {{"status": "planned|in_progress|done"}}

- rearrange_priority: Reorder tasks by priority
  - data: {{"order": ["task-id-1", "task-id-2", ...]}}

- move_task: Move a task to a different phase
  - target_id: The task/feature ID
  - data: {{"new_phase_id": "target-phase-id"}}

- add_task: Create a new task
  - data: {{"title": "...", "description": "...", "phase_id": "...", "priority": "should"}}

- delete_task: Remove a task
  - target_id: The task/feature ID

IMPORTANT:
- Match task/phase names case-insensitively
- When a name is ambiguous, ask for clarification
- Use the provided context to find correct IDs
- Always validate operations against the roadmap schema
- Return ONLY valid JSON, no markdown code blocks

Example Commands:
- "Mark SEO audit as complete" -> update_status
- "Add more context to Q1 planning about budget constraints" -> add_context
- "Redefine Q1 as Q1 2026 - Product Launch" -> redefine_phase
- "Move social media strategy to top priority" -> rearrange_priority
- "Change task title to 'Updated SEO Audit'" -> redefine_task

Response Format:
{{
  "response": "Natural language response explaining what was done",
  "operations": [
    {{
      "type": "operation_type",
      "target_id": "id-if-applicable",
      "data": {{}},
      "description": "Human-readable description"
    }}
  ]
}}"""

    def _get_operation_types(self) -> str:
        """Get list of supported operation types."""
        return ', '.join([
            self.OP_ADD_CONTEXT,
            self.OP_REDEFINE_PHASE,
            self.OP_REDEFINE_TASK,
            self.OP_UPDATE_STATUS,
            self.OP_REARRANGE_PRIORITY,
            self.OP_ADD_TASK,
            self.OP_DELETE_TASK,
            self.OP_MOVE_TASK
        ])

    def find_task_by_name(self, roadmap: dict[str, Any], name: str) -> Optional[str]:
        """Find a task ID by its name (case-insensitive)."""
        name_lower = name.lower().strip()

        # Direct match
        for feature in roadmap.get('features', []):
            if feature['title'].lower().strip() == name_lower:
                return feature['id']

        # Partial match
        for feature in roadmap.get('features', []):
            if name_lower in feature['title'].lower():
                return feature['id']

        return None

    def find_phase_by_name(self, roadmap: dict[str, Any], name: str) -> Optional[str]:
        """Find a phase ID by its name (case-insensitive)."""
        name_lower = name.lower().strip()

        # Direct match
        for phase in roadmap.get('phases', []):
            if phase['name'].lower().strip() == name_lower:
                return phase['id']

        # Partial match
        for phase in roadmap.get('phases', []):
            if name_lower in phase['name'].lower():
                return phase['id']

        return None


async def process_roadmap_chat(
    project_dir: str,
    spec_dir: str,
    user_message: str,
    roadmap: dict[str, Any],
    competitor_analysis: Optional[dict[str, Any]] = None
) -> dict[str, Any]:
    """
    Process a roadmap chat command.

    This is the main entry point for the roadmap chat functionality.

    Args:
        project_dir: Project directory path
        spec_dir: Spec directory path
        user_message: User's natural language command
        roadmap: Current roadmap data
        competitor_analysis: Optional competitor analysis

    Returns:
        Dictionary with 'response' and 'operations' keys
    """
    agent = RoadmapChatAgent(project_dir, spec_dir)
    response = await agent.process_command(user_message, roadmap, competitor_analysis)
    return response.to_dict()
