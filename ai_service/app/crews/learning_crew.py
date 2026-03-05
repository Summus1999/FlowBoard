"""
Learning Crew for CrewAI

This module provides the main Crew orchestration for FlowBoard's
learning planning and review functionality.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime

from crewai import Crew, Process

from app.crews.agents.planner_agent import create_planner_agent
from app.crews.agents.decomposer_agent import create_decomposer_agent
from app.crews.agents.reviewer_agent import create_reviewer_agent
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
from app.crews.llm_adapter import FlowBoardLLM
from app.core.logging import get_logger

logger = get_logger(__name__)


def create_planning_crew(
    goal_description: str,
    target_date: Optional[str] = None,
    weekly_hours: int = 10,
    constraints: Optional[List[str]] = None,
    verbose: bool = True,
) -> Crew:
    """
    Create a Crew for learning plan generation.
    
    This crew combines the Planner and Decomposer agents to create
    comprehensive learning plans with task breakdowns.
    
    Args:
        goal_description: The learning goal to plan for
        target_date: Target completion date (ISO format)
        weekly_hours: Available weekly learning hours
        constraints: Additional planning constraints
        verbose: Enable verbose output
        
    Returns:
        Configured Crew instance
        
    Example:
        ```python
        from app.crews.learning_crew import create_planning_crew
        
        crew = create_planning_crew(
            goal_description="学习Python后端开发",
            target_date="2024-06-01",
            weekly_hours=10,
        )
        result = crew.kickoff()
        ```
    """
    logger.info(
        "planning_crew.creating",
        goal_len=len(goal_description),
        weekly_hours=weekly_hours,
    )
    
    # Create agents
    planner = create_planner_agent(verbose=verbose)
    decomposer = create_decomposer_agent(verbose=verbose)
    
    # Create tasks
    analysis_task = create_plan_analysis_task(
        agent=planner,
        goal_description=goal_description,
        target_date=target_date,
        constraints=constraints,
    )
    
    generation_task = create_plan_generation_task(
        agent=planner,
        goal_description=goal_description,
        target_date=target_date,
        weekly_hours=weekly_hours,
        constraints=constraints,
    )
    
    # Create crew
    crew = Crew(
        agents=[planner, decomposer],
        tasks=[analysis_task, generation_task],
        process=Process.sequential,
        verbose=verbose,
        memory=True,
        # Configuration
        max_rpm=20,
        share_crew=False,
    )
    
    logger.info("planning_crew.created")
    
    return crew


def create_decomposition_crew(
    task_title: str,
    task_description: str,
    estimated_hours: float,
    context: Optional[str] = None,
    verbose: bool = True,
) -> Crew:
    """
    Create a Crew for task decomposition.
    
    This crew focuses on breaking down complex tasks into
    manageable subtasks with dependency analysis.
    
    Args:
        task_title: Title of the task to decompose
        task_description: Description of the task
        estimated_hours: Estimated total hours
        context: Additional context information
        verbose: Enable verbose output
        
    Returns:
        Configured Crew instance
    """
    logger.info(
        "decomposition_crew.creating",
        task_title=task_title,
        estimated_hours=estimated_hours,
    )
    
    # Create agent
    decomposer = create_decomposer_agent(verbose=verbose)
    
    # Create tasks
    assessment_task = create_complexity_assessment_task(
        agent=decomposer,
        task_title=task_title,
        task_description=task_description,
        estimated_hours=estimated_hours,
    )
    
    decomposition_task = create_decomposition_task(
        agent=decomposer,
        task_title=task_title,
        task_description=task_description,
        estimated_hours=estimated_hours,
        context=context,
    )
    
    # Create crew
    crew = Crew(
        agents=[decomposer],
        tasks=[assessment_task, decomposition_task],
        process=Process.sequential,
        verbose=verbose,
        memory=True,
    )
    
    logger.info("decomposition_crew.created")
    
    return crew


def create_review_crew(
    period: str,
    tasks_data: str,
    start_date: str,
    end_date: str,
    verbose: bool = True,
) -> Crew:
    """
    Create a Crew for progress review generation.
    
    This crew analyzes learning progress and generates
    comprehensive review reports.
    
    Args:
        period: Review period (daily/weekly/monthly/milestone)
        tasks_data: JSON string of task completion data
        start_date: Period start date (ISO format)
        end_date: Period end date (ISO format)
        verbose: Enable verbose output
        
    Returns:
        Configured Crew instance
    """
    logger.info(
        "review_crew.creating",
        period=period,
        start_date=start_date,
        end_date=end_date,
    )
    
    # Create agent
    reviewer = create_reviewer_agent(verbose=verbose)
    
    # Create tasks
    metrics_task = create_metrics_analysis_task(
        agent=reviewer,
        tasks_data=tasks_data,
        start_date=start_date,
        end_date=end_date,
    )
    
    review_task = create_review_generation_task(
        agent=reviewer,
        period=period,
        metrics_data="{{metrics_task.output}}",  # Will be filled by previous task
        tasks_data=tasks_data,
        start_date=start_date,
        end_date=end_date,
    )
    
    # Create crew
    crew = Crew(
        agents=[reviewer],
        tasks=[metrics_task, review_task],
        process=Process.sequential,
        verbose=verbose,
        memory=True,
    )
    
    logger.info("review_crew.created")
    
    return crew


def create_learning_crew(
    goal_description: Optional[str] = None,
    verbose: bool = True,
) -> Crew:
    """
    Create a comprehensive Learning Crew with all agents.
    
    This crew combines Planner, Decomposer, and Reviewer agents
    for complete learning workflow support.
    
    Args:
        goal_description: Optional initial goal
        verbose: Enable verbose output
        
    Returns:
        Configured Crew instance
    """
    logger.info("learning_crew.creating")
    
    # Create all agents
    planner = create_planner_agent(verbose=verbose, allow_delegation=True)
    decomposer = create_decomposer_agent(verbose=verbose, allow_delegation=True)
    reviewer = create_reviewer_agent(verbose=verbose)
    
    # Create a minimal task list (tasks will be added dynamically)
    # In practice, use the specific crew creation functions above
    
    crew = Crew(
        agents=[planner, decomposer, reviewer],
        tasks=[],  # Tasks added dynamically
        process=Process.hierarchical,
        verbose=verbose,
        memory=True,
        manager_llm=FlowBoardLLM(),
    )
    
    logger.info("learning_crew.created", agent_count=3)
    
    return crew


class CrewExecutor:
    """
    Helper class for executing crews with result handling.
    
    Provides a convenient interface for running crews and
    processing their results.
    """
    
    def __init__(self, verbose: bool = True):
        """
        Initialize the executor.
        
        Args:
            verbose: Enable verbose output for crews
        """
        self.verbose = verbose
        self._last_result = None
    
    async def execute_planning(
        self,
        goal_description: str,
        target_date: Optional[str] = None,
        weekly_hours: int = 10,
        constraints: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Execute the planning crew.
        
        Args:
            goal_description: Learning goal
            target_date: Target date
            weekly_hours: Weekly hours available
            constraints: Planning constraints
            
        Returns:
            Planning result dictionary
        """
        logger.info("crew_executor.planning_start", goal=goal_description[:50])
        
        crew = create_planning_crew(
            goal_description=goal_description,
            target_date=target_date,
            weekly_hours=weekly_hours,
            constraints=constraints,
            verbose=self.verbose,
        )
        
        # Execute crew (synchronous in crewAI)
        result = crew.kickoff()
        
        self._last_result = result
        
        logger.info("crew_executor.planning_complete")
        
        return {
            "success": True,
            "result": result.raw if hasattr(result, 'raw') else str(result),
            "json_output": result.json_dict if hasattr(result, 'json_dict') else None,
        }
    
    async def execute_decomposition(
        self,
        task_title: str,
        task_description: str,
        estimated_hours: float,
        context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Execute the decomposition crew.
        
        Args:
            task_title: Task title
            task_description: Task description
            estimated_hours: Estimated hours
            context: Additional context
            
        Returns:
            Decomposition result dictionary
        """
        logger.info("crew_executor.decomposition_start", task=task_title)
        
        crew = create_decomposition_crew(
            task_title=task_title,
            task_description=task_description,
            estimated_hours=estimated_hours,
            context=context,
            verbose=self.verbose,
        )
        
        result = crew.kickoff()
        
        self._last_result = result
        
        logger.info("crew_executor.decomposition_complete")
        
        return {
            "success": True,
            "result": result.raw if hasattr(result, 'raw') else str(result),
            "json_output": result.json_dict if hasattr(result, 'json_dict') else None,
        }
    
    async def execute_review(
        self,
        period: str,
        tasks_data: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Execute the review crew.
        
        Args:
            period: Review period
            tasks_data: Task data JSON
            start_date: Period start
            end_date: Period end
            
        Returns:
            Review result dictionary
        """
        # Default dates if not provided
        if not end_date:
            end_date = datetime.now().isoformat()
        if not start_date:
            from datetime import timedelta
            period_days = {"daily": 1, "weekly": 7, "monthly": 30}.get(period, 7)
            start_dt = datetime.now() - timedelta(days=period_days)
            start_date = start_dt.isoformat()
        
        logger.info(
            "crew_executor.review_start",
            period=period,
            start=start_date,
            end=end_date,
        )
        
        crew = create_review_crew(
            period=period,
            tasks_data=tasks_data,
            start_date=start_date,
            end_date=end_date,
            verbose=self.verbose,
        )
        
        result = crew.kickoff()
        
        self._last_result = result
        
        logger.info("crew_executor.review_complete")
        
        return {
            "success": True,
            "result": result.raw if hasattr(result, 'raw') else str(result),
            "json_output": result.json_dict if hasattr(result, 'json_dict') else None,
        }
    
    @property
    def last_result(self):
        """Get the last execution result."""
        return self._last_result


# Singleton executor instance
_executor: Optional[CrewExecutor] = None


def get_crew_executor(verbose: bool = True) -> CrewExecutor:
    """
    Get the singleton CrewExecutor instance.
    
    Args:
        verbose: Enable verbose output
        
    Returns:
        CrewExecutor instance
    """
    global _executor
    if _executor is None:
        _executor = CrewExecutor(verbose=verbose)
    return _executor
