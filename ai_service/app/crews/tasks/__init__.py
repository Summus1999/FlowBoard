"""
CrewAI Task Definitions for FlowBoard

This module contains task definitions that correspond to FlowBoard's
learning planning, task decomposition, and review functionalities.
"""

from app.crews.tasks.plan_tasks import (
    create_plan_analysis_task,
    create_plan_generation_task,
)
from app.crews.tasks.decompose_tasks import (
    create_complexity_assessment_task,
    create_decomposition_task,
)
from app.crews.tasks.review_tasks import (
    create_metrics_analysis_task,
    create_review_generation_task,
)

__all__ = [
    "create_plan_analysis_task",
    "create_plan_generation_task",
    "create_complexity_assessment_task",
    "create_decomposition_task",
    "create_metrics_analysis_task",
    "create_review_generation_task",
]
