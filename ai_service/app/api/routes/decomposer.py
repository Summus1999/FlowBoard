"""
任务分解API路由
处理任务分解相关功能
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.api.deps import get_db, get_trace_id, get_request_id
from app.services.decomposer_service import (
    get_decomposer_service,
    TaskComplexity,
    BatchResult,
)

logger = get_logger(__name__)
router = APIRouter()


@router.post("/analyze")
async def analyze_task_complexity(
    task_description: str,
    context: Optional[Dict[str, Any]] = None,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
):
    """
    分析任务复杂度
    
    分析单个任务的复杂度并给出建议的分解策略
    """
    service = get_decomposer_service()
    
    try:
        analysis = await service.analyze_complexity(task_description, context or {})
        
        logger.info(
            "task.complexity_analyzed",
            trace_id=trace_id,
            complexity=analysis.complexity.value,
        )
        
        return {
            "trace_id": trace_id,
            "request_id": request_id,
            "analysis": {
                "complexity": analysis.complexity.value,
                "estimated_hours": analysis.estimated_hours,
                "skill_requirements": analysis.skill_requirements,
                "uncertainty_factors": analysis.uncertainty_factors,
                "recommended_strategy": analysis.recommended_strategy,
                "reason": analysis.reason,
            },
        }
    except Exception as e:
        logger.error("task.analysis_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"任务分析失败: {str(e)}")


@router.post("/decompose")
async def decompose_task(
    task_id: str,
    task_description: str,
    complexity: TaskComplexity = TaskComplexity.MEDIUM,
    context: Optional[Dict[str, Any]] = None,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
):
    """
    分解任务
    
    将复杂任务分解为可执行的子任务
    """
    service = get_decomposer_service()
    
    try:
        result = await service.decompose_task(
            task_id=task_id,
            task_description=task_description,
            complexity=complexity,
            context=context or {},
        )
        
        logger.info(
            "task.decomposed",
            trace_id=trace_id,
            task_id=task_id,
            subtasks_count=len(result.subtasks),
        )
        
        return {
            "trace_id": trace_id,
            "request_id": request_id,
            "result": {
                "task_id": result.task_id,
                "subtasks": [
                    {
                        "id": st.id,
                        "title": st.title,
                        "description": st.description,
                        "estimated_minutes": st.estimated_minutes,
                        "order": st.order,
                        "dependencies": st.dependencies,
                    }
                    for st in result.subtasks
                ],
                "total_estimated_minutes": result.total_estimated_minutes,
                "complexity": result.complexity.value,
            },
        }
    except Exception as e:
        logger.error("task.decomposition_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"任务分解失败: {str(e)}")


@router.post("/batch")
async def batch_decompose(
    tasks: List[Dict[str, Any]],
    confirmation_threshold: int = Query(5, ge=1, le=20),
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
):
    """
    批量分解任务
    
    批量处理多个任务分解请求
    
    - confirmation_threshold: 需要二次确认的任务数量阈值
    """
    service = get_decomposer_service()
    
    try:
        result = await service.batch_decompose(
            tasks=tasks,
            confirmation_threshold=confirmation_threshold,
        )
        
        logger.info(
            "tasks.batch_decomposed",
            trace_id=trace_id,
            total=result.total_count,
            needs_confirmation=result.needs_confirmation,
        )
        
        return {
            "trace_id": trace_id,
            "request_id": request_id,
            "result": {
                "total_count": result.total_count,
                "processed_count": result.processed_count,
                "needs_confirmation": result.needs_confirmation,
                "estimated_total_minutes": result.estimated_total_minutes,
                "results": [
                    {
                        "task_id": r.task_id,
                        "status": r.status,
                        "subtasks_count": len(r.subtasks) if r.subtasks else 0,
                        "message": r.message,
                    }
                    for r in result.results
                ],
            },
        }
    except Exception as e:
        logger.error("tasks.batch_decomposition_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"批量分解失败: {str(e)}")


@router.post("/visualize")
async def visualize_tasks(
    task_ids: List[str],
    view_type: str = Query("dependency", enum=["gantt", "kanban", "dependency"]),
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    任务可视化
    
    生成任务的可视化视图
    
    - view_type: 视图类型 (gantt/kanban/dependency)
    """
    service = get_decomposer_service()
    
    # 获取任务数据
    from app.models.plan import Task
    
    result = await db.execute(
        select(Task).where(Task.id.in_(task_ids))
    )
    tasks = result.scalars().all()
    
    if not tasks:
        raise HTTPException(status_code=404, detail="未找到任务")
    
    try:
        visualization = await service.visualize_tasks(
            tasks=[
                {
                    "id": t.id,
                    "title": t.title,
                    "status": t.status,
                    "start_time": t.start_time,
                    "due_date": t.due_date,
                    "estimated_minutes": t.estimated_minutes,
                    "priority": t.priority,
                    "dependencies": t.dependencies or [],
                }
                for t in tasks
            ],
            view_type=view_type,
        )
        
        logger.info(
            "tasks.visualized",
            trace_id=trace_id,
            view_type=view_type,
            task_count=len(tasks),
        )
        
        return {
            "trace_id": trace_id,
            "request_id": request_id,
            "visualization": visualization,
        }
    except Exception as e:
        logger.error("tasks.visualization_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"任务可视化失败: {str(e)}")


@router.get("/strategies")
async def get_decomposition_strategies(
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
):
    """
    获取分解策略
    
    获取可用的任务分解策略列表
    """
    strategies = [
        {
            "id": "simple",
            "name": "简单任务",
            "description": "无需分解，直接执行",
            "max_hours": 2,
            "max_subtasks": 1,
        },
        {
            "id": "sequential",
            "name": "顺序分解",
            "description": "按时间顺序分解为连续步骤",
            "max_hours": 16,
            "max_subtasks": 10,
        },
        {
            "id": "parallel",
            "name": "并行分解",
            "description": "分解为可并行执行的子任务",
            "max_hours": 40,
            "max_subtasks": 20,
        },
        {
            "id": "complex",
            "name": "复杂分解",
            "description": "需要深入分析的大型任务",
            "max_hours": 160,
            "max_subtasks": 50,
        },
    ]
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "strategies": strategies,
    }
