"""
Decomposer Agent for CrewAI

This module defines the Decomposer Agent that maps to FlowBoard's
DecomposerAgent service, responsible for breaking down complex tasks.
"""

from typing import Optional

from crewai import Agent

from app.crews.llm_adapter import FlowBoardLLM, FlowBoardLLMBalanced
from app.crews.tools.goal_analysis_tool import GoalAnalysisTool
from app.core.logging import get_logger

logger = get_logger(__name__)


# Agent role and configuration
DECOMPOSER_ROLE = "任务拆解专家"

DECOMPOSER_GOAL = """将复杂的学习任务拆分为可执行的子任务，
分析任务间的依赖关系，识别关键路径，并安排可并行执行的任务组。"""

DECOMPOSER_BACKSTORY = """你是一位资深的项目管理和任务分解专家，
拥有丰富的敏捷开发和教育课程设计经验。

你的专长包括：
1. 评估任务复杂度（简单/中等/复杂）
2. 将大任务拆分为30分钟到4小时的可执行单元
3. 识别任务间的依赖关系和阻塞点
4. 计算关键路径，优化执行顺序
5. 识别可并行执行的任务，提高学习效率

你遵循的原则：
- 每个子任务都应该有明确的完成标准
- 任务粒度要适中，不过细也不过粗
- 依赖关系要清晰，避免循环依赖
- 时间估算要留有适当余量"""


def create_decomposer_agent(
    llm: Optional[FlowBoardLLM] = None,
    verbose: bool = True,
    memory: bool = True,
    allow_delegation: bool = True,
    max_iter: int = 15,
) -> Agent:
    """
    Create a Decomposer Agent instance.
    
    The Decomposer Agent is responsible for breaking down complex
    learning tasks into manageable subtasks with clear dependencies.
    
    Args:
        llm: Custom LLM instance (defaults to FlowBoardLLMBalanced)
        verbose: Enable verbose output
        memory: Enable agent memory
        allow_delegation: Allow delegating tasks to other agents
        max_iter: Maximum iterations for task completion
        
    Returns:
        Configured Decomposer Agent
        
    Example:
        ```python
        from app.crews.agents.decomposer_agent import create_decomposer_agent
        
        decomposer = create_decomposer_agent()
        # Use in a Crew
        ```
    """
    logger.info("decomposer_agent.creating", verbose=verbose, memory=memory)
    
    # Use balanced LLM for decomposition tasks
    if llm is None:
        llm = FlowBoardLLMBalanced()
    
    # Initialize tools
    tools = [
        GoalAnalysisTool(),  # Can analyze sub-goals too
    ]
    
    agent = Agent(
        role=DECOMPOSER_ROLE,
        goal=DECOMPOSER_GOAL,
        backstory=DECOMPOSER_BACKSTORY,
        llm=llm,
        tools=tools,
        verbose=verbose,
        memory=memory,
        allow_delegation=allow_delegation,
        max_iter=max_iter,
        # Additional configuration
        max_rpm=15,  # Higher rate limit for iterative decomposition
        respect_context_window=True,
    )
    
    logger.info("decomposer_agent.created")
    
    return agent


def create_decomposer_agent_for_simple_tasks(
    llm: Optional[FlowBoardLLM] = None,
) -> Agent:
    """
    Create a lightweight Decomposer Agent for simple decomposition.
    
    This version is optimized for quick decomposition of
    straightforward tasks.
    
    Args:
        llm: Custom LLM instance
        
    Returns:
        Lightweight Decomposer Agent
    """
    return create_decomposer_agent(
        llm=llm,
        verbose=False,
        memory=False,
        allow_delegation=False,
        max_iter=5,
    )


# Task complexity thresholds (in minutes)
COMPLEXITY_THRESHOLDS = {
    "simple": 120,     # < 2 hours
    "medium": 480,     # 2-8 hours
    "complex": 480,    # > 8 hours (needs decomposition)
}

# Prompt templates for decomposition scenarios
TASK_DECOMPOSITION_PROMPT = """
请将以下任务拆解为可执行的子任务：

## 任务信息
- 标题：{task_title}
- 描述：{task_description}
- 预估总时间：{estimated_hours}小时
- 复杂度评估：{complexity}

## 拆解要求
1. 每个子任务应在30分钟到4小时之间
2. 明确标注任务间的依赖关系
3. 为每个子任务提供完成检查项
4. 推荐相关学习资源

## 输出格式（JSON）
```json
[
    {{
        "id": "subtask_1",
        "title": "子任务标题",
        "description": "详细描述",
        "estimated_minutes": 60,
        "dependencies": [],
        "checklist": ["检查项1", "检查项2"],
        "resources": ["推荐资源"]
    }}
]
```
"""

DEPENDENCY_ANALYSIS_PROMPT = """
分析以下子任务列表的依赖关系：

## 子任务列表
{subtasks}

## 分析要求
1. 识别必须顺序执行的任务
2. 找出可以并行执行的任务组
3. 计算关键路径（总耗时最长的路径）
4. 标记潜在的阻塞点

## 输出格式
```json
{{
    "critical_path": ["task_id_1", "task_id_2"],
    "parallel_groups": [["task_a", "task_b"], ["task_c"]],
    "blocking_points": ["task_x"],
    "total_duration_minutes": 480,
    "optimized_duration_minutes": 360
}}
```
"""

COMPLEXITY_ASSESSMENT_PROMPT = """
评估以下任务的复杂度：

## 任务信息
- 标题：{task_title}
- 描述：{task_description}
- 初步时间估算：{estimated_hours}小时

## 评估维度
1. 技能要求复杂度
2. 知识广度
3. 实践操作难度
4. 前置知识需求

## 输出
```json
{{
    "complexity": "simple|medium|complex",
    "needs_decomposition": true|false,
    "estimated_subtask_count": 3,
    "risk_factors": ["风险1", "风险2"],
    "recommendation": "建议说明"
}}
```
"""
