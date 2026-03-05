"""
Decomposition Tasks for CrewAI

This module defines tasks related to task decomposition and dependency analysis.
"""

from typing import Any, Optional, Type

from crewai import Task, Agent
from pydantic import BaseModel, Field

from app.core.logging import get_logger

logger = get_logger(__name__)


# Pydantic models for structured output
class SubTaskOutput(BaseModel):
    """Subtask output schema."""
    id: str = Field(description="Subtask ID")
    title: str = Field(description="Subtask title")
    description: str = Field(description="Subtask description")
    estimated_minutes: int = Field(description="Estimated minutes")
    complexity: str = Field(description="Complexity: simple/medium/complex")
    dependencies: list[str] = Field(description="Dependent subtask IDs")
    checklist: list[str] = Field(description="Completion checklist items")
    resources: list[str] = Field(description="Recommended resources")


class DecompositionResultOutput(BaseModel):
    """Decomposition result output schema."""
    original_task: str = Field(description="Original task title")
    subtasks: list[SubTaskOutput] = Field(description="List of subtasks")
    total_estimated_minutes: int = Field(description="Total estimated minutes")
    critical_path: list[str] = Field(description="Critical path task IDs")
    parallel_groups: list[list[str]] = Field(description="Parallel execution groups")
    risk_factors: list[str] = Field(description="Risk factors")


class ComplexityAssessmentOutput(BaseModel):
    """Complexity assessment output schema."""
    task_title: str = Field(description="Task title")
    complexity: str = Field(description="Assessed complexity")
    needs_decomposition: bool = Field(description="Whether decomposition is needed")
    estimated_subtask_count: int = Field(description="Estimated number of subtasks")
    skill_requirements: list[str] = Field(description="Required skills")
    risk_factors: list[str] = Field(description="Identified risks")
    recommendation: str = Field(description="Recommendation text")


def create_complexity_assessment_task(
    agent: Agent,
    task_title: str,
    task_description: str,
    estimated_hours: float,
) -> Task:
    """
    Create a task for assessing task complexity.
    
    This task evaluates whether a task needs decomposition
    and estimates the effort involved.
    
    Args:
        agent: The agent to assign this task to
        task_title: Title of the task to assess
        task_description: Description of the task
        estimated_hours: Initial time estimate in hours
        
    Returns:
        Configured Task instance
    """
    description = f"""
评估以下任务的复杂度，判断是否需要拆解。

## 任务信息
- 标题：{task_title}
- 描述：{task_description}
- 初步估时：{estimated_hours}小时

## 评估标准
1. **简单任务**（< 2小时）
   - 单一技能点
   - 明确的完成标准
   - 无外部依赖

2. **中等任务**（2-8小时）
   - 多个相关技能点
   - 需要一定的实践
   - 可能有少量依赖

3. **复杂任务**（> 8小时）
   - 跨多个领域
   - 需要深入学习
   - 有多个依赖和阶段

## 输出要求
- 复杂度等级（simple/medium/complex）
- 是否需要拆解
- 预估子任务数量
- 所需技能列表
- 风险因素
- 处理建议
"""
    
    task = Task(
        description=description,
        expected_output="复杂度评估结果（JSON格式）",
        agent=agent,
        output_json=ComplexityAssessmentOutput,
    )
    
    logger.info(
        "complexity_assessment_task.created",
        task_title=task_title,
        estimated_hours=estimated_hours,
    )
    
    return task


def create_decomposition_task(
    agent: Agent,
    task_title: str,
    task_description: str,
    estimated_hours: float,
    complexity: str = "complex",
    context: Optional[str] = None,
) -> Task:
    """
    Create a task for decomposing a complex task.
    
    This task breaks down a complex task into manageable subtasks
    with dependency analysis.
    
    Args:
        agent: The agent to assign this task to
        task_title: Title of the task to decompose
        task_description: Description of the task
        estimated_hours: Estimated total hours
        complexity: Complexity level
        context: Additional context information
        
    Returns:
        Configured Task instance
    """
    context_section = f"## 上下文\n{context}\n" if context else ""
    
    description = f"""
将以下复杂任务拆解为可执行的子任务。

## 原始任务
- 标题：{task_title}
- 描述：{task_description}
- 预估总时间：{estimated_hours}小时
- 复杂度：{complexity}

{context_section}

## 拆解要求
1. **子任务粒度**
   - 每个子任务在30分钟到4小时之间
   - 有明确的开始和结束点
   - 可独立评估完成状态

2. **依赖关系**
   - 明确标注必须的先后顺序
   - 识别可并行的任务
   - 避免循环依赖

3. **完成标准**
   - 每个子任务包含2-4个检查项
   - 检查项应可客观验证

4. **资源推荐**
   - 提供学习资源链接或书籍
   - 标注资源类型（视频/文档/练习）

## 分析输出
1. 子任务列表（按推荐执行顺序）
2. 依赖关系图
3. 关键路径（最长依赖链）
4. 可并行任务组
5. 风险因素

## 输出格式
请输出完整的JSON格式拆解结果。
"""
    
    task = Task(
        description=description,
        expected_output="任务拆解结果（JSON格式）",
        agent=agent,
        output_json=DecompositionResultOutput,
    )
    
    logger.info(
        "decomposition_task.created",
        task_title=task_title,
        complexity=complexity,
    )
    
    return task


def create_dependency_analysis_task(
    agent: Agent,
    subtasks_data: str,
) -> Task:
    """
    Create a task for analyzing dependencies between subtasks.
    
    This task analyzes existing subtasks and optimizes execution order.
    
    Args:
        agent: The agent to assign this task to
        subtasks_data: JSON string of subtask data
        
    Returns:
        Configured Task instance
    """
    description = f"""
分析以下子任务列表的依赖关系，优化执行顺序。

## 子任务数据
{subtasks_data}

## 分析要求
1. **依赖识别**
   - 找出硬依赖（必须先完成）
   - 找出软依赖（建议先完成）
   - 标记无依赖任务

2. **关键路径计算**
   - 计算最长依赖路径
   - 识别关键节点

3. **并行优化**
   - 分组可并行任务
   - 估算优化后总时长

4. **风险评估**
   - 识别单点故障任务
   - 评估延误影响

## 输出
- 优化后的执行顺序
- 关键路径任务列表
- 并行执行组
- 预估总时长（串行 vs 优化后）
- 风险提示
"""
    
    task = Task(
        description=description,
        expected_output="依赖分析结果（JSON格式）",
        agent=agent,
    )
    
    logger.info("dependency_analysis_task.created")
    
    return task
