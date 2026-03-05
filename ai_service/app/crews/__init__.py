"""
CrewAI Integration Module for FlowBoard

This module provides multi-agent orchestration capabilities using the crewAI framework,
integrated with FlowBoard's existing LangGraph workflow and ModelGateway infrastructure.

Architecture:
- agents/: Agent definitions (Planner, Decomposer, Reviewer)
- tasks/: Task definitions for each agent
- tools/: Custom tools wrapping FlowBoard services
- callbacks.py: SSE streaming callback handler
- llm_adapter.py: FlowBoardLLM adapter for ModelGateway
- learning_crew.py: Main crew orchestration
"""

from app.crews.llm_adapter import FlowBoardLLM
from app.crews.learning_crew import create_learning_crew, create_planning_crew

__all__ = [
    "FlowBoardLLM",
    "create_learning_crew",
    "create_planning_crew",
]
