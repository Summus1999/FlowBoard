"""
Reviewer Agent for CrewAI

This module defines the Reviewer Agent that maps to FlowBoard's
ReviewAgent service, responsible for generating progress reviews.
"""

from typing import Optional

from crewai import Agent

from app.crews.llm_adapter import FlowBoardLLM, FlowBoardLLMBalanced
from app.crews.tools.metrics_tool import MetricsCalculatorTool
from app.crews.tools.database_tool import DatabaseQueryTool
from app.core.logging import get_logger

logger = get_logger(__name__)


# Agent role and configuration
REVIEWER_ROLE = "学习进度复盘师"

REVIEWER_GOAL = """分析用户的学习进度数据，识别成就和挑战，
生成有价值的复盘报告，并提供具体可行的改进建议。"""

REVIEWER_BACKSTORY = """你是一位资深的学习教练和数据分析师，
专注于帮助学习者优化学习效率和保持学习动力。

你的专长包括：
1. 从学习数据中发现有意义的模式和趋势
2. 识别学习者的成就并给予积极反馈
3. 洞察学习过程中的挑战和瓶颈
4. 提供个性化的改进建议
5. 设定合理的下阶段目标

你的复盘风格：
- 客观但鼓励：既指出问题，也肯定进步
- 数据驱动：用数字说话，避免空泛评价
- 可执行：建议具体明确，易于落地
- 正向引导：关注成长而非比较"""


def create_reviewer_agent(
    llm: Optional[FlowBoardLLM] = None,
    verbose: bool = True,
    memory: bool = True,
    allow_delegation: bool = False,
    max_iter: int = 10,
) -> Agent:
    """
    Create a Reviewer Agent instance.
    
    The Reviewer Agent is responsible for analyzing learning progress
    and generating insightful review reports.
    
    Args:
        llm: Custom LLM instance (defaults to FlowBoardLLMBalanced)
        verbose: Enable verbose output
        memory: Enable agent memory
        allow_delegation: Allow delegating tasks to other agents
        max_iter: Maximum iterations for task completion
        
    Returns:
        Configured Reviewer Agent
        
    Example:
        ```python
        from app.crews.agents.reviewer_agent import create_reviewer_agent
        
        reviewer = create_reviewer_agent()
        # Use in a Crew
        ```
    """
    logger.info("reviewer_agent.creating", verbose=verbose, memory=memory)
    
    # Use balanced LLM for review tasks
    if llm is None:
        llm = FlowBoardLLMBalanced()
    
    # Initialize tools
    tools = [
        MetricsCalculatorTool(),
        DatabaseQueryTool(),
    ]
    
    agent = Agent(
        role=REVIEWER_ROLE,
        goal=REVIEWER_GOAL,
        backstory=REVIEWER_BACKSTORY,
        llm=llm,
        tools=tools,
        verbose=verbose,
        memory=memory,
        allow_delegation=allow_delegation,
        max_iter=max_iter,
        # Additional configuration
        max_rpm=10,
        respect_context_window=True,
    )
    
    logger.info("reviewer_agent.created")
    
    return agent


def create_reviewer_agent_for_daily_review(
    llm: Optional[FlowBoardLLM] = None,
) -> Agent:
    """
    Create a lightweight Reviewer Agent for daily quick reviews.
    
    Optimized for generating brief daily summaries.
    
    Args:
        llm: Custom LLM instance
        
    Returns:
        Lightweight Reviewer Agent
    """
    return create_reviewer_agent(
        llm=llm,
        verbose=False,
        memory=False,
        max_iter=5,
    )


# Review period types
REVIEW_PERIODS = {
    "daily": {"days": 1, "name": "日复盘"},
    "weekly": {"days": 7, "name": "周复盘"},
    "monthly": {"days": 30, "name": "月复盘"},
    "milestone": {"days": None, "name": "里程碑复盘"},
}

# Prompt templates for review scenarios
PROGRESS_REVIEW_PROMPT = """
请为以下学习数据生成{period_name}：

## 时间范围
- 开始日期：{start_date}
- 结束日期：{end_date}

## 学习数据
### 任务完成情况
{tasks_summary}

### 学习指标
- 总任务数：{total_tasks}
- 已完成：{completed_tasks}
- 完成率：{completion_rate}%
- 总学习时长：{total_hours}小时
- 日均学习：{avg_daily_hours}小时
- 连续学习天数：{streak_days}天
- 一致性评分：{consistency_score}/100

## 复盘要求
请生成包含以下内容的复盘报告：

1. **总结概述**（200字以内）
   - 整体进度评估
   - 关键数据亮点

2. **成就识别**
   - 列出本期完成的重要任务
   - 突破和进步点

3. **挑战分析**
   - 未完成任务及原因分析
   - 遇到的困难

4. **洞察发现**
   - 学习模式分析
   - 效率变化趋势

5. **进度评估**
   - ahead（超前）/ on_track（正常）/ behind（落后）
   - 与计划对比分析

6. **改进建议**
   - 具体可执行的优化措施
   - 下周重点

7. **下阶段目标**
   - 3-5个具体目标
   - 优先级排序

请以JSON格式输出。
"""

ACHIEVEMENT_DETECTION_PROMPT = """
分析以下学习数据，识别值得表扬的成就：

## 任务完成情况
{tasks_data}

## 成就类型
1. 首次完成类（第一次完成某类任务）
2. 连续坚持类（连续多天学习）
3. 效率提升类（完成速度加快）
4. 突破困难类（完成挑战性任务）
5. 里程碑达成类（完成重要节点）

请识别并描述最多5个成就：
```json
[
    {{
        "type": "成就类型",
        "title": "成就标题",
        "description": "成就描述",
        "impact": "影响说明"
    }}
]
```
"""

CHALLENGE_ANALYSIS_PROMPT = """
分析以下学习数据中的挑战和困难：

## 数据情况
- 未完成任务：{incomplete_tasks}
- 学习中断天数：{gap_days}
- 效率下降趋势：{efficiency_trend}

## 分析要求
1. 识别主要挑战（2-4个）
2. 分析可能原因
3. 评估影响程度
4. 提出应对建议

## 输出格式
```json
[
    {{
        "challenge": "挑战描述",
        "possible_causes": ["原因1", "原因2"],
        "impact_level": "high|medium|low",
        "suggestions": ["建议1", "建议2"]
    }}
]
```
"""

SUGGESTIONS_PROMPT = """
基于以下学习状况，提供具体的改进建议：

## 当前状况
- 进度评估：{progress_assessment}
- 主要挑战：{challenges}
- 学习指标：{metrics}

## 建议要求
1. 针对性强：直接解决当前问题
2. 可执行：具体明确，容易落地
3. 优先级：按重要程度排序
4. 数量适中：3-5条

请输出建议列表：
```json
[
    {{
        "suggestion": "建议内容",
        "priority": 1,
        "expected_impact": "预期效果",
        "effort": "low|medium|high"
    }}
]
```
"""
