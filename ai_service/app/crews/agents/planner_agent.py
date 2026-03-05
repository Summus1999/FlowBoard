"""
Planner Agent for CrewAI

This module defines the Planner Agent that maps to FlowBoard's
PlannerAgent service, responsible for creating learning plans.
"""

from typing import Optional

from crewai import Agent

from app.crews.llm_adapter import FlowBoardLLM, FlowBoardLLMHighQuality
from app.crews.tools.goal_analysis_tool import GoalAnalysisTool
from app.crews.tools.template_tool import TemplateMatchingTool
from app.services.model_gateway import ModelProfile
from app.core.logging import get_logger

logger = get_logger(__name__)


# Agent role and configuration
PLANNER_ROLE = "学习计划规划师"

PLANNER_GOAL = """根据用户的学习目标，制定结构化、可执行的学习计划。
计划应包含清晰的里程碑、具体的任务、合理的时间安排，以及风险评估。"""

PLANNER_BACKSTORY = """你是一位经验丰富的学习规划专家，拥有10年以上的教育咨询和课程设计经验。
你擅长：
1. 分析用户的学习目标，识别核心技能需求
2. 将长期目标拆分为可管理的里程碑
3. 设计循序渐进的学习路径
4. 考虑用户的时间约束和学习风格
5. 识别潜在风险并提供应对策略

你的计划总是具体、可执行，并附有清晰的成功标准。"""


def create_planner_agent(
    llm: Optional[FlowBoardLLM] = None,
    verbose: bool = True,
    memory: bool = True,
    allow_delegation: bool = False,
    max_iter: int = 15,
) -> Agent:
    """
    Create a Planner Agent instance.
    
    The Planner Agent is responsible for analyzing learning goals
    and generating comprehensive learning plans with milestones
    and tasks.
    
    Args:
        llm: Custom LLM instance (defaults to FlowBoardLLMHighQuality)
        verbose: Enable verbose output
        memory: Enable agent memory
        allow_delegation: Allow delegating tasks to other agents
        max_iter: Maximum iterations for task completion
        
    Returns:
        Configured Planner Agent
        
    Example:
        ```python
        from app.crews.agents.planner_agent import create_planner_agent
        
        planner = create_planner_agent()
        # Use in a Crew
        ```
    """
    logger.info("planner_agent.creating", verbose=verbose, memory=memory)
    
    # Use high-quality LLM for planning tasks
    if llm is None:
        llm = FlowBoardLLMHighQuality()
    
    # Initialize tools
    tools = [
        GoalAnalysisTool(),
        TemplateMatchingTool(),
    ]
    
    agent = Agent(
        role=PLANNER_ROLE,
        goal=PLANNER_GOAL,
        backstory=PLANNER_BACKSTORY,
        llm=llm,
        tools=tools,
        verbose=verbose,
        memory=memory,
        allow_delegation=allow_delegation,
        max_iter=max_iter,
        # Additional configuration
        max_rpm=10,  # Rate limit for API calls
        respect_context_window=True,
    )
    
    logger.info("planner_agent.created")
    
    return agent


def create_planner_agent_for_quick_planning(
    llm: Optional[FlowBoardLLM] = None,
) -> Agent:
    """
    Create a lightweight Planner Agent for quick planning tasks.
    
    This version uses fewer iterations and no memory for faster
    execution on simple planning requests.
    
    Args:
        llm: Custom LLM instance
        
    Returns:
        Lightweight Planner Agent
    """
    return create_planner_agent(
        llm=llm,
        verbose=False,
        memory=False,
        max_iter=5,
    )


# Prompt templates for common planning scenarios
PLAN_GENERATION_PROMPT = """
请为以下学习目标创建详细的学习计划：

## 用户目标
{goal_description}

## 约束条件
- 目标完成日期：{target_date}
- 每周可用学习时间：{weekly_hours}小时
- 其他约束：{constraints}

## 输出要求
请生成包含以下内容的学习计划：

1. **计划概述**：简要描述学习目标和预期成果

2. **里程碑设置**（3-5个）：
   - 里程碑名称
   - 持续时间（天）
   - 关键交付物
   - 成功标准

3. **任务列表**：
   每个里程碑下的具体任务，包括：
   - 任务名称和描述
   - 预估时间（小时）
   - 优先级（1-5）
   - 推荐学习资源

4. **风险评估**：
   - 潜在挑战
   - 应对策略

5. **时间安排建议**：
   - 每周学习安排
   - 复习节点

请以JSON格式输出。
"""

MILESTONE_ANALYSIS_PROMPT = """
分析以下里程碑的可行性和完整性：

## 里程碑信息
{milestone_data}

## 分析维度
1. 时间估算是否合理？
2. 交付物是否明确可测量？
3. 与前后里程碑的衔接是否顺畅？
4. 是否有遗漏的关键技能点？

请提供分析结果和改进建议。
"""
