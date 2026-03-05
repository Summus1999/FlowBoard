"""
CrewAI Agent Definitions for FlowBoard

This module contains role-based agent definitions that map to FlowBoard's
existing service-layer agents (Planner, Decomposer, Reviewer).
"""

from app.crews.agents.planner_agent import create_planner_agent
from app.crews.agents.decomposer_agent import create_decomposer_agent
from app.crews.agents.reviewer_agent import create_reviewer_agent

__all__ = [
    "create_planner_agent",
    "create_decomposer_agent",
    "create_reviewer_agent",
]
