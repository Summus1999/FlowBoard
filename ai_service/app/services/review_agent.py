"""
进度复盘Agent
实现学习进度复盘和反思
"""

import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from enum import Enum

from app.core.config import settings
from app.core.logging import get_logger
from app.services.model_gateway import get_model_gateway, ModelProfile

logger = get_logger(__name__)


class ReviewPeriod(str, Enum):
    """复盘周期"""
    DAILY = "daily"       # 日复盘
    WEEKLY = "weekly"     # 周复盘
    MONTHLY = "monthly"   # 月复盘
    MILESTONE = "milestone"  # 里程碑复盘


@dataclass
class LearningActivity:
    """学习活动记录"""
    activity_id: str
    activity_type: str  # task_completed, note_added, resource_viewed
    title: str
    timestamp: datetime
    duration_minutes: int
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ProgressMetrics:
    """进度指标"""
    total_tasks: int
    completed_tasks: int
    completion_rate: float
    total_learning_hours: float
    avg_daily_hours: float
    streak_days: int  # 连续学习天数
    consistency_score: float  # 一致性评分 (0-100)


@dataclass
class ProgressReview:
    """进度复盘结果"""
    review_id: str
    period: ReviewPeriod
    start_date: datetime
    end_date: datetime
    
    # 数据汇总
    metrics: ProgressMetrics
    activities: List[LearningActivity]
    
    # 复盘分析
    summary: str
    achievements: List[str]
    challenges: List[str]
    insights: List[str]
    
    # 评估和建议
    progress_assessment: str  # ahead/on_track/behind
    suggestions: List[str]
    next_week_goals: List[str]
    
    # 时间分布分析
    time_distribution: Dict[str, float]  # 按类别的时间分布
    productivity_analysis: Dict[str, Any]


class ReviewAgent:
    """
    进度复盘Agent
    
    功能：
    1. 收集学习数据
    2. 分析进度和趋势
    3. 生成复盘报告
    4. 提供改进建议
    """
    
    def __init__(self):
        self.model_gateway = get_model_gateway()
    
    async def generate_review(
        self,
        user_id: str,
        plan_id: str,
        period: ReviewPeriod,
        start_date: datetime,
        end_date: datetime,
        tasks_data: List[Dict],
        activities: List[LearningActivity],
    ) -> ProgressReview:
        """
        生成进度复盘
        
        Args:
            user_id: 用户ID
            plan_id: 计划ID
            period: 复盘周期
            start_date: 开始日期
            end_date: 结束日期
            tasks_data: 任务数据
            activities: 学习活动记录
        
        Returns:
            ProgressReview: 复盘结果
        """
        logger.info("review.generate_start", user_id=user_id, period=period.value)
        
        # 1. 计算指标
        metrics = self._calculate_metrics(tasks_data, activities, start_date, end_date)
        
        # 2. 分析时间分布
        time_distribution = self._analyze_time_distribution(activities)
        
        # 3. 生成复盘内容（使用LLM）
        summary = await self._generate_summary(
            period, metrics, activities, tasks_data
        )
        
        achievements = await self._identify_achievements(
            tasks_data, activities
        )
        
        challenges = await self._identify_challenges(
            tasks_data, activities
        )
        
        insights = await self._generate_insights(
            period, metrics, activities
        )
        
        # 4. 评估进度
        progress_assessment = self._assess_progress(metrics, tasks_data)
        
        # 5. 生成建议
        suggestions = await self._generate_suggestions(
            metrics, challenges, progress_assessment
        )
        
        # 6. 生成下周目标
        next_week_goals = await self._generate_next_goals(
            tasks_data, progress_assessment
        )
        
        # 7. 生产力分析
        productivity = self._analyze_productivity(activities)
        
        review = ProgressReview(
            review_id=f"review_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            period=period,
            start_date=start_date,
            end_date=end_date,
            metrics=metrics,
            activities=activities,
            summary=summary,
            achievements=achievements,
            challenges=challenges,
            insights=insights,
            progress_assessment=progress_assessment,
            suggestions=suggestions,
            next_week_goals=next_week_goals,
            time_distribution=time_distribution,
            productivity_analysis=productivity,
        )
        
        logger.info("review.generate_complete", review_id=review.review_id)
        
        return review
    
    def _calculate_metrics(
        self,
        tasks_data: List[Dict],
        activities: List[LearningActivity],
        start_date: datetime,
        end_date: datetime,
    ) -> ProgressMetrics:
        """计算进度指标"""
        total_tasks = len(tasks_data)
        completed_tasks = sum(1 for t in tasks_data if t.get("status") == "completed")
        completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
        
        # 计算学习时长
        total_hours = sum(a.duration_minutes for a in activities) / 60
        days_diff = max(1, (end_date - start_date).days)
        avg_daily_hours = total_hours / days_diff
        
        # 计算连续学习天数（简化版）
        streak_days = self._calculate_streak(activities)
        
        # 一致性评分（基于每日学习时长的一致性）
        consistency = self._calculate_consistency(activities, days_diff)
        
        return ProgressMetrics(
            total_tasks=total_tasks,
            completed_tasks=completed_tasks,
            completion_rate=completion_rate,
            total_learning_hours=total_hours,
            avg_daily_hours=avg_daily_hours,
            streak_days=streak_days,
            consistency_score=consistency,
        )
    
    def _calculate_streak(self, activities: List[LearningActivity]) -> int:
        """计算连续学习天数"""
        if not activities:
            return 0
        
        # 按日期分组
        dates_with_activity = set()
        for activity in activities:
            date_key = activity.timestamp.date()
            dates_with_activity.add(date_key)
        
        # 计算连续天数
        sorted_dates = sorted(dates_with_activity, reverse=True)
        if not sorted_dates:
            return 0
        
        streak = 1
        today = datetime.now().date()
        
        # 检查今天或昨天是否有活动
        if sorted_dates[0] not in [today, today - timedelta(days=1)]:
            return 0
        
        for i in range(len(sorted_dates) - 1):
            if sorted_dates[i] - sorted_dates[i + 1] == timedelta(days=1):
                streak += 1
            else:
                break
        
        return streak
    
    def _calculate_consistency(
        self,
        activities: List[LearningActivity],
        days_diff: int,
    ) -> float:
        """计算学习一致性评分"""
        if not activities or days_diff == 0:
            return 0.0
        
        # 按天汇总学习时长
        daily_hours = {}
        for activity in activities:
            date_key = activity.timestamp.date()
            daily_hours[date_key] = daily_hours.get(date_key, 0) + activity.duration_minutes / 60
        
        if len(daily_hours) < 2:
            return 50.0
        
        # 计算方差（方差越小，一致性越高）
        hours_list = list(daily_hours.values())
        avg = sum(hours_list) / len(hours_list)
        variance = sum((h - avg) ** 2 for h in hours_list) / len(hours_list)
        
        # 转换为0-100分（方差越小，分数越高）
        max_variance = 16  # 假设最大方差为16（4小时的标准差）
        score = max(0, 100 - (variance / max_variance * 100))
        
        return round(score, 1)
    
    def _analyze_time_distribution(
        self,
        activities: List[LearningActivity],
    ) -> Dict[str, float]:
        """分析时间分布"""
        distribution = {}
        total_minutes = sum(a.duration_minutes for a in activities)
        
        if total_minutes == 0:
            return distribution
        
        for activity in activities:
            category = activity.activity_type
            distribution[category] = distribution.get(category, 0) + activity.duration_minutes
        
        # 转换为百分比
        for key in distribution:
            distribution[key] = round(distribution[key] / total_minutes * 100, 1)
        
        return distribution
    
    def _analyze_productivity(
        self,
        activities: List[LearningActivity],
    ) -> Dict[str, Any]:
        """分析生产力"""
        if not activities:
            return {"peak_hours": [], "avg_session_length": 0}
        
        # 按小时分组
        hour_distribution = {}
        for activity in activities:
            hour = activity.timestamp.hour
            hour_distribution[hour] = hour_distribution.get(hour, 0) + activity.duration_minutes
        
        # 找出高效时段（前3个）
        peak_hours = sorted(
            hour_distribution.items(),
            key=lambda x: x[1],
            reverse=True
        )[:3]
        
        # 平均单次学习时长
        avg_session = sum(a.duration_minutes for a in activities) / len(activities)
        
        return {
            "peak_hours": [h[0] for h in peak_hours],
            "avg_session_minutes": round(avg_session, 1),
        }
    
    async def _generate_summary(
        self,
        period: ReviewPeriod,
        metrics: ProgressMetrics,
        activities: List[LearningActivity],
        tasks_data: List[Dict],
    ) -> str:
        """生成复盘摘要"""
        period_name = {
            ReviewPeriod.DAILY: "今日",
            ReviewPeriod.WEEKLY: "本周",
            ReviewPeriod.MONTHLY: "本月",
            ReviewPeriod.MILESTONE: "本阶段",
        }.get(period, "本期")
        
        prompt = f"""请为以下学习数据生成{period_name}复盘摘要（200字以内）：

任务完成：{metrics.completed_tasks}/{metrics.total_tasks} ({metrics.completion_rate:.1f}%)
学习时长：{metrics.total_learning_hours:.1f}小时
平均每天：{metrics.avg_daily_hours:.1f}小时
连续学习：{metrics.streak_days}天

已完成任务：
"""
        for task in tasks_data[:5]:
            if task.get("status") == "completed":
                prompt += f"- {task.get('title', '')}\n"
        
        try:
            response = await self.model_gateway.generate(
                messages=[{"role": "user", "content": prompt}],
                model_profile=ModelProfile.BALANCED,
                temperature=0.3,
            )
            return response.content
        except Exception as e:
            logger.error("summary_generation.failed", error=str(e))
            return f"{period_name}学习{metrics.completed_tasks}个任务，共{metrics.total_learning_hours:.1f}小时"
    
    async def _identify_achievements(
        self,
        tasks_data: List[Dict],
        activities: List[LearningActivity],
    ) -> List[str]:
        """识别成就"""
        achievements = []
        
        # 基于任务完成
        completed = [t for t in tasks_data if t.get("status") == "completed"]
        if len(completed) >= 5:
            achievements.append(f"完成{len(completed)}个学习任务")
        
        # 基于连续学习
        if activities:
            streak = self._calculate_streak(activities)
            if streak >= 7:
                achievements.append(f"连续学习{streak}天")
        
        # 使用LLM识别更多成就
        prompt = f"""基于以下完成的任务，识别3-5个成就：

已完成任务：
"""
        for task in completed[:10]:
            prompt += f"- {task.get('title', '')}\n"
        
        try:
            response = await self.model_gateway.generate(
                messages=[{"role": "user", "content": prompt}],
                model_profile=ModelProfile.BALANCED,
                temperature=0.3,
            )
            
            # 解析成就
            lines = [
                line.strip().lstrip('-').strip()
                for line in response.content.split('\n')
                if line.strip().startswith('-')
            ]
            achievements.extend(lines[:5])
            
        except Exception as e:
            logger.error("achievements_identification.failed", error=str(e))
        
        return achievements[:5]
    
    async def _identify_challenges(
        self,
        tasks_data: List[Dict],
        activities: List[LearningActivity],
    ) -> List[str]:
        """识别挑战"""
        challenges = []
        
        # 基于未完成任务
        pending = [t for t in tasks_data if t.get("status") == "pending"]
        if len(pending) > len(tasks_data) * 0.5:
            challenges.append(f"有{len(pending)}个任务待完成，进度偏慢")
        
        # 基于学习时长
        total_hours = sum(a.duration_minutes for a in activities) / 60
        if total_hours < 5:
            challenges.append("本周学习时长较少，建议增加投入")
        
        return challenges[:3]
    
    async def _generate_insights(
        self,
        period: ReviewPeriod,
        metrics: ProgressMetrics,
        activities: List[LearningActivity],
    ) -> List[str]:
        """生成洞察"""
        insights = []
        
        # 基于数据的洞察
        if metrics.consistency_score > 80:
            insights.append("学习节奏非常稳定，是很好的习惯")
        elif metrics.consistency_score < 50:
            insights.append("学习时间波动较大，建议制定固定学习计划")
        
        if metrics.avg_daily_hours > 3:
            insights.append("日均学习时长充足，保持良好状态")
        
        return insights[:3]
    
    def _assess_progress(
        self,
        metrics: ProgressMetrics,
        tasks_data: List[Dict],
    ) -> str:
        """评估进度状态"""
        if metrics.completion_rate >= 90:
            return "ahead"
        elif metrics.completion_rate >= 70:
            return "on_track"
        else:
            return "behind"
    
    async def _generate_suggestions(
        self,
        metrics: ProgressMetrics,
        challenges: List[str],
        progress_assessment: str,
    ) -> List[str]:
        """生成改进建议"""
        suggestions = []
        
        if progress_assessment == "behind":
            suggestions.append("建议增加每日学习时长，追赶进度")
            suggestions.append("可以优先完成高优先级任务")
        
        if metrics.consistency_score < 60:
            suggestions.append("尝试在固定时间段学习，培养习惯")
        
        if not suggestions:
            suggestions.append("继续保持当前的学习节奏")
            suggestions.append("可以适当挑战更有难度的任务")
        
        return suggestions[:3]
    
    async def _generate_next_goals(
        self,
        tasks_data: List[Dict],
        progress_assessment: str,
    ) -> List[str]:
        """生成下周目标"""
        goals = []
        
        # 未完成的优先任务
        pending_priority = [
            t for t in tasks_data
            if t.get("status") == "pending" and t.get("priority", 1) >= 4
        ]
        
        for task in pending_priority[:2]:
            goals.append(f"完成高优先级任务：{task.get('title', '')}")
        
        # 基于进度的目标
        if progress_assessment == "behind":
            goals.append("追赶进度，完成至少3个待办任务")
        else:
            goals.append("按计划推进，保持当前进度")
        
        return goals[:3]


class ReviewScheduler:
    """
    复盘调度器
    
    管理复盘的自动生成
    """
    
    def __init__(self):
        self.review_agent = ReviewAgent()
    
    async def should_generate_review(
        self,
        user_id: str,
        plan_id: str,
        period: ReviewPeriod,
        last_review_date: Optional[datetime],
    ) -> bool:
        """
        判断是否应该生成复盘
        
        基于时间和活动判断
        """
        now = datetime.now()
        
        if not last_review_date:
            return True
        
        days_since_last = (now - last_review_date).days
        
        if period == ReviewPeriod.DAILY:
            return days_since_last >= 1
        elif period == ReviewPeriod.WEEKLY:
            return days_since_last >= 7
        elif period == ReviewPeriod.MONTHLY:
            return days_since_last >= 30
        else:
            return days_since_last >= 1
    
    def get_review_period_dates(
        self,
        period: ReviewPeriod,
    ) -> tuple:
        """获取复盘周期的日期范围"""
        end_date = datetime.now()
        
        if period == ReviewPeriod.DAILY:
            start_date = end_date - timedelta(days=1)
        elif period == ReviewPeriod.WEEKLY:
            start_date = end_date - timedelta(days=7)
        elif period == ReviewPeriod.MONTHLY:
            start_date = end_date - timedelta(days=30)
        else:
            start_date = end_date - timedelta(days=7)
        
        return start_date, end_date


# 全局服务实例
_review_agent: Optional[ReviewAgent] = None
_review_scheduler: Optional[ReviewScheduler] = None


def get_review_agent() -> ReviewAgent:
    """获取复盘Agent单例"""
    global _review_agent
    if _review_agent is None:
        _review_agent = ReviewAgent()
    return _review_agent


def get_review_scheduler() -> ReviewScheduler:
    """获取复盘调度器单例"""
    global _review_scheduler
    if _review_scheduler is None:
        _review_scheduler = ReviewScheduler()
    return _review_scheduler
