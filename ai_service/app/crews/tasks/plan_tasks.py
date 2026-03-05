"""
Plan Tasks for CrewAI

This module defines tasks related to learning plan creation and management.
"""

from typing import Any, Optional, Type

from crewai import Task, Agent
from pydantic import BaseModel, Field

from app.core.logging import get_logger

logger = get_logger(__name__)


# Pydantic models for structured output
class MilestoneOutput(BaseModel):
    """Milestone output schema."""
    title: str = Field(description="Milestone title")
    description: str = Field(description="Milestone description")
    duration_days: int = Field(description="Duration in days")
    deliverables: list[str] = Field(description="List of deliverables")
    success_criteria: str = Field(description="Success criteria")


class TaskOutput(BaseModel):
    """Task output schema."""
    title: str = Field(description="Task title")
    description: str = Field(description="Task description")
    estimated_hours: float = Field(description="Estimated hours")
    priority: int = Field(description="Priority 1-5")
    dependencies: list[str] = Field(description="Dependent task titles")
    resources: list[str] = Field(description="Recommended resources")


class PlanProposalOutput(BaseModel):
    """Plan proposal output schema."""
    title: str = Field(description="Plan title")
    overview: str = Field(description="Plan overview")
    milestones: list[MilestoneOutput] = Field(description="List of milestones")
    tasks: list[TaskOutput] = Field(description="List of tasks")
    total_duration_days: int = Field(description="Total duration in days")
    total_hours: float = Field(description="Total estimated hours")
    risk_assessment: list[str] = Field(description="Risk factors")


def create_plan_analysis_task(
    agent: Agent,
    goal_description: str,
    target_date: Optional[str] = None,
    constraints: Optional[list[str]] = None,
) -> Task:
    """
    Create a task for analyzing a learning goal.
    
    This task analyzes the user's learning goal and extracts
    structured information for planning.
    
    Args:
        agent: The agent to assign this task to
        goal_description: The learning goal to analyze
        target_date: Optional target completion date
        constraints: Optional list of constraints
        
    Returns:
        Configured Task instance
    """
    constraints_str = ", ".join(constraints) if constraints else "无特殊约束"
    
    description = f"""
分析以下学习目标，提取关键信息用于制定学习计划。

## 学习目标
{goal_description}

## 目标日期
{target_date or "未指定"}

## 约束条件
{constraints_str}

## 分析要求
1. 使用 goal_analysis 工具分析目标
2. 使用 template_matching 工具查找匹配模板
3. 整合分析结果

## 输出内容
- 目标概述
- 需要掌握的技能列表
- 难度评估
- 前置知识要求
- 是否有匹配的模板
- 建议学习路径
"""
    
    task = Task(
        description=description,
        expected_output="结构化的目标分析结果（JSON格式）",
        agent=agent,
    )
    
    logger.info("plan_analysis_task.created", goal_len=len(goal_description))
    
    return task


def create_plan_generation_task(
    agent: Agent,
    goal_description: str,
    analysis_result: Optional[str] = None,
    target_date: Optional[str] = None,
    weekly_hours: int = 10,
    constraints: Optional[list[str]] = None,
) -> Task:
    """
    Create a task for generating a complete learning plan.
    
    This task generates a comprehensive learning plan with
    milestones, tasks, and risk assessment.
    
    Args:
        agent: The agent to assign this task to
        goal_description: The learning goal
        analysis_result: Result from plan_analysis_task (optional)
        target_date: Target completion date
        weekly_hours: Available weekly hours
        constraints: Additional constraints
        
    Returns:
        Configured Task instance
    """
    constraints_str = ", ".join(constraints) if constraints else "无"
    analysis_context = f"## 已有分析结果\n{analysis_result}\n" if analysis_result else ""
    
    description = f"""
基于学习目标创建详细的学习计划。

## 学习目标
{goal_description}

{analysis_context}

## 规划参数
- 目标完成日期：{target_date or "灵活安排"}
- 每周可用时间：{weekly_hours}小时
- 约束条件：{constraints_str}

## 计划要求
1. **里程碑设计**（3-5个）
   - 每个里程碑应有明确的阶段性目标
   - 持续时间应在2-4周之间
   - 包含具体的交付物和成功标准

2. **任务规划**
   - 每个里程碑下3-5个具体任务
   - 任务时长在1-8小时之间
   - 明确任务间的依赖关系
   - 推荐学习资源

3. **时间安排**
   - 根据每周可用时间合理分配
   - 预留复习和缓冲时间

4. **风险评估**
   - 识别潜在挑战
   - 提供应对策略

## 输出格式
请输出完整的JSON格式学习计划，包含所有里程碑和任务详情。
"""
    
    task = Task(
        description=description,
        expected_output="完整的学习计划提案（JSON格式）",
        agent=agent,
        output_json=PlanProposalOutput,
    )
    
    logger.info("plan_generation_task.created", goal_len=len(goal_description))
    
    return task


def create_plan_validation_task(
    agent: Agent,
    plan_data: str,
    user_constraints: Optional[str] = None,
) -> Task:
    """
    Create a task for validating a learning plan.
    
    This task reviews a plan proposal and identifies potential issues.
    
    Args:
        agent: The agent to assign this task to
        plan_data: The plan proposal to validate
        user_constraints: User's constraints to check against
        
    Returns:
        Configured Task instance
    """
    description = f"""
验证以下学习计划的可行性和完整性。

## 计划内容
{plan_data}

## 用户约束
{user_constraints or "无特殊约束"}

## 验证维度
1. **时间合理性**
   - 总时长是否合理
   - 每周负荷是否过重
   - 里程碑间隔是否均衡

2. **内容完整性**
   - 技能覆盖是否全面
   - 学习路径是否连贯
   - 是否有重要遗漏

3. **可执行性**
   - 任务粒度是否合适
   - 依赖关系是否清晰
   - 资源是否可获取

4. **风险检查**
   - 是否存在潜在阻塞
   - 时间估算是否保守

## 输出
- 验证结果（通过/需修改）
- 发现的问题列表
- 改进建议
"""
    
    task = Task(
        description=description,
        expected_output="计划验证报告（JSON格式）",
        agent=agent,
    )
    
    logger.info("plan_validation_task.created")
    
    return task
