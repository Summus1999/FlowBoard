"""
Metrics Calculator Tool for CrewAI

Wraps FlowBoard's metrics calculation functionality for learning
progress analysis and review generation.
"""

import json
from datetime import datetime, timedelta
from typing import Any, Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from app.core.logging import get_logger

logger = get_logger(__name__)


class MetricsInput(BaseModel):
    """Input schema for metrics calculation."""
    tasks_data: str = Field(
        description="JSON string of task data with status, completion dates, and durations"
    )
    start_date: str = Field(
        description="Start date for metrics calculation (ISO format)"
    )
    end_date: str = Field(
        description="End date for metrics calculation (ISO format)"
    )


class MetricsOutput(BaseModel):
    """Output schema for metrics calculation."""
    total_tasks: int = Field(description="Total number of tasks")
    completed_tasks: int = Field(description="Number of completed tasks")
    completion_rate: float = Field(description="Completion rate percentage")
    total_hours: float = Field(description="Total learning hours")
    avg_daily_hours: float = Field(description="Average daily learning hours")
    streak_days: int = Field(description="Consecutive learning days")
    consistency_score: float = Field(description="Learning consistency score (0-100)")


class MetricsCalculatorTool(BaseTool):
    """
    Tool for calculating learning progress metrics.
    
    This tool analyzes task completion data and learning activities
    to produce metrics useful for progress review.
    """
    
    name: str = "metrics_calculator"
    description: str = (
        "Calculates learning progress metrics including completion rate, "
        "total hours, streak days, and consistency score. "
        "Use this when generating a progress review or analyzing learning patterns."
    )
    args_schema: Type[BaseModel] = MetricsInput
    
    def _run(
        self,
        tasks_data: str,
        start_date: str,
        end_date: str,
    ) -> str:
        """
        Execute metrics calculation.
        
        Args:
            tasks_data: JSON string of task data
            start_date: Start date ISO string
            end_date: End date ISO string
            
        Returns:
            JSON string with calculated metrics
        """
        logger.info("metrics_calculator_tool.run")
        
        try:
            tasks = json.loads(tasks_data) if isinstance(tasks_data, str) else tasks_data
            start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        except (json.JSONDecodeError, ValueError) as e:
            logger.error("metrics_calculator_tool.parse_error", error=str(e))
            return json.dumps({"error": f"Failed to parse input: {str(e)}"})
        
        metrics = self._calculate_metrics(tasks, start, end)
        
        return json.dumps(metrics, ensure_ascii=False, indent=2)
    
    def _calculate_metrics(
        self,
        tasks: list[dict],
        start_date: datetime,
        end_date: datetime,
    ) -> dict:
        """
        Calculate comprehensive learning metrics.
        
        Args:
            tasks: List of task dictionaries
            start_date: Period start date
            end_date: Period end date
            
        Returns:
            Dictionary with all metrics
        """
        total_tasks = len(tasks)
        completed_tasks = sum(
            1 for t in tasks
            if t.get("status") == "completed" or t.get("status") == "done"
        )
        
        completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
        
        # Calculate total hours from task durations
        total_minutes = sum(
            t.get("duration_minutes", 0) or t.get("estimated_minutes", 30)
            for t in tasks
            if t.get("status") in ("completed", "done")
        )
        total_hours = total_minutes / 60
        
        # Calculate average daily hours
        days_diff = max(1, (end_date - start_date).days)
        avg_daily_hours = total_hours / days_diff
        
        # Calculate streak days (simplified)
        streak_days = self._calculate_streak(tasks)
        
        # Calculate consistency score
        consistency_score = self._calculate_consistency(tasks, days_diff)
        
        return {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "completion_rate": round(completion_rate, 1),
            "total_hours": round(total_hours, 1),
            "avg_daily_hours": round(avg_daily_hours, 2),
            "streak_days": streak_days,
            "consistency_score": round(consistency_score, 1),
            "period_days": days_diff,
            "productivity_rating": self._get_productivity_rating(avg_daily_hours, consistency_score),
        }
    
    def _calculate_streak(self, tasks: list[dict]) -> int:
        """
        Calculate consecutive learning days.
        
        Args:
            tasks: List of tasks with completion dates
            
        Returns:
            Number of consecutive days with completed tasks
        """
        completion_dates = set()
        
        for task in tasks:
            completed_at = task.get("completed_at")
            if completed_at and task.get("status") in ("completed", "done"):
                try:
                    if isinstance(completed_at, str):
                        dt = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
                    else:
                        dt = completed_at
                    completion_dates.add(dt.date())
                except (ValueError, AttributeError):
                    continue
        
        if not completion_dates:
            return 0
        
        # Sort dates and find longest streak ending at most recent date
        sorted_dates = sorted(completion_dates, reverse=True)
        streak = 1
        
        for i in range(len(sorted_dates) - 1):
            if (sorted_dates[i] - sorted_dates[i + 1]).days == 1:
                streak += 1
            else:
                break
        
        return streak
    
    def _calculate_consistency(self, tasks: list[dict], period_days: int) -> float:
        """
        Calculate learning consistency score.
        
        Based on how evenly distributed the learning activities are
        across the period.
        
        Args:
            tasks: List of tasks
            period_days: Number of days in period
            
        Returns:
            Consistency score from 0 to 100
        """
        if period_days == 0 or not tasks:
            return 0.0
        
        # Count unique days with activity
        active_days = set()
        for task in tasks:
            completed_at = task.get("completed_at")
            if completed_at and task.get("status") in ("completed", "done"):
                try:
                    if isinstance(completed_at, str):
                        dt = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
                    else:
                        dt = completed_at
                    active_days.add(dt.date())
                except (ValueError, AttributeError):
                    continue
        
        # Consistency = percentage of days with activity
        # Adjusted for reasonable expectations (5-6 days per week is excellent)
        expected_active_days = period_days * 0.7  # 70% of days
        actual_ratio = len(active_days) / max(1, expected_active_days)
        
        return min(100, actual_ratio * 100)
    
    def _get_productivity_rating(
        self,
        avg_daily_hours: float,
        consistency_score: float,
    ) -> str:
        """
        Generate a productivity rating based on metrics.
        
        Args:
            avg_daily_hours: Average daily learning hours
            consistency_score: Learning consistency score
            
        Returns:
            Rating string: excellent/good/fair/needs_improvement
        """
        combined_score = (avg_daily_hours * 10 + consistency_score) / 2
        
        if combined_score >= 70:
            return "excellent"
        elif combined_score >= 50:
            return "good"
        elif combined_score >= 30:
            return "fair"
        else:
            return "needs_improvement"
