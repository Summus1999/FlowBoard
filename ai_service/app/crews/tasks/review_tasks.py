"""
Review Tasks for CrewAI

This module defines tasks related to progress review and analysis.
"""

from typing import Any, Optional

from crewai import Task, Agent
from pydantic import BaseModel, Field

from app.core.logging import get_logger

logger = get_logger(__name__)


# Pydantic models for structured output
class ProgressMetricsOutput(BaseModel):
    """Progress metrics output schema."""
    total_tasks: int = Field(description="Total number of tasks")
    completed_tasks: int = Field(description="Completed tasks count")
    completion_rate: float = Field(description="Completion rate percentage")
    total_hours: float = Field(description="Total learning hours")
    avg_daily_hours: float = Field(description="Average daily hours")
    streak_days: int = Field(description="Consecutive learning days")
    consistency_score: float = Field(description="Consistency score 0-100")


class ReviewOutput(BaseModel):
    """Review output schema."""
    period: str = Field(description="Review period: daily/weekly/monthly")
    summary: str = Field(description="Review summary")
    achievements: list[str] = Field(description="List of achievements")
    challenges: list[str] = Field(description="List of challenges")
    insights: list[str] = Field(description="Learning insights")
    progress_assessment: str = Field(description="ahead/on_track/behind")
    suggestions: list[str] = Field(description="Improvement suggestions")
    next_goals: list[str] = Field(description="Next period goals")


def create_metrics_analysis_task(
    agent: Agent,
    tasks_data: str,
    start_date: str,
    end_date: str,
) -> Task:
    """
    Create a task for analyzing learning metrics.
    
    This task calculates various progress metrics from task data.
    
    Args:
        agent: The agent to assign this task to
        tasks_data: JSON string of task completion data
        start_date: Period start date (ISO format)
        end_date: Period end date (ISO format)
        
    Returns:
        Configured Task instance
    """
    description = f"""
分析以下时间段的学习数据，计算进度指标。

## 时间范围
- 开始日期：{start_date}
- 结束日期：{end_date}

## 任务数据
{tasks_data}

## 计算指标
使用 metrics_calculator 工具计算以下指标：

1. **任务完成情况**
   - 总任务数
   - 已完成数
   - 完成率

2. **学习时长**
   - 总学习时长
   - 日均学习时长

3. **学习连续性**
   - 连续学习天数
   - 一致性评分

4. **效率分析**
   - 任务完成效率趋势
   - 高效时段识别

## 输出
请输出完整的指标分析结果（JSON格式）。
"""
    
    task = Task(
        description=description,
        expected_output="学习指标分析结果（JSON格式）",
        agent=agent,
        output_json=ProgressMetricsOutput,
    )
    
    logger.info(
        "metrics_analysis_task.created",
        start_date=start_date,
        end_date=end_date,
    )
    
    return task


def create_review_generation_task(
    agent: Agent,
    period: str,
    metrics_data: str,
    tasks_data: str,
    start_date: str,
    end_date: str,
) -> Task:
    """
    Create a task for generating a progress review.
    
    This task generates a comprehensive progress review report.
    
    Args:
        agent: The agent to assign this task to
        period: Review period (daily/weekly/monthly/milestone)
        metrics_data: JSON string of calculated metrics
        tasks_data: JSON string of task data
        start_date: Period start date
        end_date: Period end date
        
    Returns:
        Configured Task instance
    """
    period_names = {
        "daily": "日复盘",
        "weekly": "周复盘",
        "monthly": "月复盘",
        "milestone": "里程碑复盘",
    }
    period_name = period_names.get(period, "进度复盘")
    
    description = f"""
生成{period_name}报告。

## 复盘周期
- 类型：{period}
- 开始日期：{start_date}
- 结束日期：{end_date}

## 学习指标
{metrics_data}

## 任务完成情况
{tasks_data}

## 报告要求

### 1. 总结概述（200字以内）
- 整体进度评价
- 关键数据亮点
- 情感基调：鼓励但客观

### 2. 成就识别（2-5项）
- 完成的重要任务
- 突破性进展
- 值得表扬的坚持

### 3. 挑战分析（1-3项）
- 未完成任务及原因
- 遇到的困难
- 时间管理问题

### 4. 洞察发现（2-4项）
- 学习模式观察
- 效率变化趋势
- 优势和不足

### 5. 进度评估
- 与计划对比
- 评级：ahead（超前）/ on_track（正常）/ behind（落后）
- 偏差分析

### 6. 改进建议（3-5条）
- 具体可执行
- 按优先级排序
- 附带预期效果

### 7. 下阶段目标（3-5个）
- SMART原则
- 优先级排序

## 输出格式
请输出完整的JSON格式复盘报告。
"""
    
    task = Task(
        description=description,
        expected_output=f"{period_name}报告（JSON格式）",
        agent=agent,
        output_json=ReviewOutput,
    )
    
    logger.info(
        "review_generation_task.created",
        period=period,
    )
    
    return task


def create_achievement_detection_task(
    agent: Agent,
    tasks_data: str,
    historical_data: Optional[str] = None,
) -> Task:
    """
    Create a task for detecting achievements.
    
    This task identifies notable achievements from learning data.
    
    Args:
        agent: The agent to assign this task to
        tasks_data: JSON string of completed tasks
        historical_data: Optional historical data for comparison
        
    Returns:
        Configured Task instance
    """
    history_section = f"## 历史数据\n{historical_data}\n" if historical_data else ""
    
    description = f"""
从学习数据中识别值得表扬的成就。

## 本期完成任务
{tasks_data}

{history_section}

## 成就类型
1. **首次突破**
   - 第一次完成某类任务
   - 首次接触新领域

2. **连续坚持**
   - 连续多天学习
   - 保持稳定节奏

3. **效率提升**
   - 完成速度加快
   - 质量提高

4. **挑战攻克**
   - 完成困难任务
   - 克服学习障碍

5. **里程碑达成**
   - 完成阶段目标
   - 积累性成果

## 输出要求
识别3-5个最值得表扬的成就：
- 成就类型
- 成就标题（简短有力）
- 成就描述（具体情况）
- 成就意义（为什么值得表扬）

请以JSON数组格式输出。
"""
    
    task = Task(
        description=description,
        expected_output="成就列表（JSON格式）",
        agent=agent,
    )
    
    logger.info("achievement_detection_task.created")
    
    return task


def create_suggestions_task(
    agent: Agent,
    progress_assessment: str,
    challenges: str,
    metrics_data: str,
) -> Task:
    """
    Create a task for generating improvement suggestions.
    
    This task provides actionable improvement suggestions.
    
    Args:
        agent: The agent to assign this task to
        progress_assessment: Current progress assessment
        challenges: Identified challenges
        metrics_data: Current metrics data
        
    Returns:
        Configured Task instance
    """
    description = f"""
基于当前学习状况，提供具体的改进建议。

## 当前状况
### 进度评估
{progress_assessment}

### 面临挑战
{challenges}

### 学习指标
{metrics_data}

## 建议要求
1. **针对性**：直接解决当前问题
2. **可执行**：具体明确，容易实施
3. **优先级**：按重要紧急排序
4. **平衡性**：既有短期调整，也有长期改进

## 建议分类
1. **时间管理**
   - 学习时间安排优化
   - 专注度提升方法

2. **学习方法**
   - 技巧改进
   - 资源利用优化

3. **习惯养成**
   - 坚持策略
   - 激励机制

4. **内容调整**
   - 难度调节
   - 学习顺序优化

## 输出格式
输出3-5条建议，每条包含：
- 建议内容
- 优先级（1-5）
- 预期效果
- 实施难度（low/medium/high）
"""
    
    task = Task(
        description=description,
        expected_output="改进建议列表（JSON格式）",
        agent=agent,
    )
    
    logger.info("suggestions_task.created")
    
    return task
