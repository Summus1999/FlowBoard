"""
CrewAI Tool Definitions for FlowBoard

Custom tools that wrap FlowBoard's existing services and utilities,
enabling crewAI agents to interact with the system.
"""

from app.crews.tools.goal_analysis_tool import GoalAnalysisTool
from app.crews.tools.template_tool import TemplateMatchingTool
from app.crews.tools.metrics_tool import MetricsCalculatorTool
from app.crews.tools.database_tool import DatabaseQueryTool

__all__ = [
    "GoalAnalysisTool",
    "TemplateMatchingTool",
    "MetricsCalculatorTool",
    "DatabaseQueryTool",
]
