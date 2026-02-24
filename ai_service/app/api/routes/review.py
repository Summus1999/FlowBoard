"""
复盘API路由
处理学习进度复盘相关功能
"""

from datetime import datetime, timedelta
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.api.deps import get_db, get_trace_id, get_request_id
from app.services.review_agent import (
    get_review_agent,
    get_review_scheduler,
    ReviewPeriod,
    LearningActivity,
)

logger = get_logger(__name__)
router = APIRouter()


@router.post("/generate")
async def generate_review(
    user_id: str,
    plan_id: str,
    period: ReviewPeriod = ReviewPeriod.WEEKLY,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    生成学习进度复盘
    
    - period: 复盘周期 (daily/weekly/monthly/milestone)
    - start_date: 开始日期（可选，默认根据周期自动计算）
    - end_date: 结束日期（可选，默认为当前时间）
    """
    scheduler = get_review_scheduler()
    
    # 自动计算日期范围
    if not end_date:
        end_date = datetime.now()
    if not start_date:
        start_date, _ = scheduler.get_review_period_dates(period)
    
    # 获取任务数据（从数据库）
    from app.models.plan import Task
    result = await db.execute(
        select(Task)
        .where(
            and_(
                Task.plan_id == plan_id,
                Task.created_at >= start_date,
                Task.created_at <= end_date,
            )
        )
    )
    tasks = result.scalars().all()
    
    tasks_data = [
        {
            "id": task.id,
            "title": task.title,
            "status": task.status,
            "priority": task.priority,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        }
        for task in tasks
    ]
    
    # 构建学习活动记录
    activities = []
    for task in tasks:
        if task.completed_at:
            activities.append(LearningActivity(
                activity_id=f"task_{task.id}",
                activity_type="task_completed",
                title=task.title,
                timestamp=task.completed_at,
                duration_minutes=task.estimated_minutes or 30,
                metadata={"priority": task.priority},
            ))
    
    # 生成复盘
    agent = get_review_agent()
    review = await agent.generate_review(
        user_id=user_id,
        plan_id=plan_id,
        period=period,
        start_date=start_date,
        end_date=end_date,
        tasks_data=tasks_data,
        activities=activities,
    )
    
    logger.info(
        "review.generated",
        user_id=user_id,
        plan_id=plan_id,
        period=period.value,
        review_id=review.review_id,
    )
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "review": {
            "id": review.review_id,
            "period": review.period.value,
            "start_date": review.start_date.isoformat(),
            "end_date": review.end_date.isoformat(),
            "summary": review.summary,
            "metrics": {
                "total_tasks": review.metrics.total_tasks,
                "completed_tasks": review.metrics.completed_tasks,
                "completion_rate": review.metrics.completion_rate,
                "total_learning_hours": review.metrics.total_learning_hours,
                "avg_daily_hours": review.metrics.avg_daily_hours,
                "streak_days": review.metrics.streak_days,
                "consistency_score": review.metrics.consistency_score,
            },
            "achievements": review.achievements,
            "challenges": review.challenges,
            "insights": review.insights,
            "progress_assessment": review.progress_assessment,
            "suggestions": review.suggestions,
            "next_week_goals": review.next_week_goals,
            "time_distribution": review.time_distribution,
            "productivity_analysis": review.productivity_analysis,
        },
    }


@router.get("/history")
async def get_review_history(
    user_id: str,
    plan_id: Optional[str] = None,
    period: Optional[ReviewPeriod] = None,
    limit: int = Query(10, ge=1, le=50),
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
):
    """
    获取复盘历史
    
    获取用户的历史复盘记录
    """
    # TODO: 实现复盘历史存储和查询
    # 简化实现，返回空列表
    logger.info("review.history.query", user_id=user_id)
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "reviews": [],
        "total": 0,
    }


@router.get("/should-review")
async def should_generate_review(
    user_id: str,
    plan_id: str,
    period: ReviewPeriod = ReviewPeriod.WEEKLY,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
):
    """
    检查是否应该生成复盘
    
    基于上一次复盘时间和活动情况判断
    """
    scheduler = get_review_scheduler()
    
    # TODO: 从数据库获取上一次复盘时间
    last_review_date = None
    
    should_review = await scheduler.should_generate_review(
        user_id=user_id,
        plan_id=plan_id,
        period=period,
        last_review_date=last_review_date,
    )
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "should_review": should_review,
        "period": period.value,
        "last_review_date": last_review_date.isoformat() if last_review_date else None,
    }


@router.get("/metrics")
async def get_progress_metrics(
    user_id: str,
    plan_id: str,
    days: int = Query(7, ge=1, le=90),
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    获取进度指标
    
    获取指定时间范围内的学习进度指标
    """
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    from app.models.plan import Task
    result = await db.execute(
        select(Task)
        .where(
            and_(
                Task.plan_id == plan_id,
                Task.created_at >= start_date,
                Task.created_at <= end_date,
            )
        )
    )
    tasks = result.scalars().all()
    
    total = len(tasks)
    completed = sum(1 for t in tasks if t.status == "completed")
    in_progress = sum(1 for t in tasks if t.status == "in_progress")
    pending = sum(1 for t in tasks if t.status == "pending")
    
    completion_rate = (completed / total * 100) if total > 0 else 0
    
    logger.info(
        "metrics.retrieved",
        user_id=user_id,
        total=total,
        completed=completed,
    )
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "metrics": {
            "total_tasks": total,
            "completed_tasks": completed,
            "in_progress_tasks": in_progress,
            "pending_tasks": pending,
            "completion_rate": round(completion_rate, 1),
            "time_range": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
            },
        },
    }
