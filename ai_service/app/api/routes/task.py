"""
Task API路由（增强版）
处理任务管理、拆解、可视化等
"""

from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.api.deps import get_db, get_trace_id, get_request_id
from app.models.plan import Task, TaskStatus, Plan
from app.services.decomposer_service import (
    get_decomposer_agent,
    get_resumable_task_manager,
    get_task_batch_service,
    TaskStateMachine,
)
from app.services.task_visualization import (
    get_task_visualization_service,
    TaskViewType,
)
from app.services.plan_confirmation import (
    get_confirmation_service,
    ProposalConfirmationBuilder,
)

logger = get_logger(__name__)
router = APIRouter()


@router.post("/{task_id}/decompose")
async def decompose_task(
    task_id: str,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    拆解任务为子任务
    
    使用Decomposer Agent智能拆解
    """
    # 获取任务
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    # 拆解任务
    decomposer = get_decomposer_agent()
    
    # 估算时间（如果没有则使用默认值4小时）
    estimated_hours = 4.0
    
    decomposed = await decomposer.analyze_and_decompose(
        task_title=task.title,
        task_description=task.description or "",
        estimated_hours=estimated_hours,
    )
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "task_id": task_id,
        "original_task": decomposed.original_task,
        "complexity": "complex" if len(decomposed.subtasks) > 3 else "medium",
        "subtasks": [
            {
                "id": st.id,
                "title": st.title,
                "description": st.description,
                "estimated_minutes": st.estimated_minutes,
                "complexity": st.complexity.value,
                "dependencies": st.dependencies,
                "resources": st.resources,
                "checklist": st.checklist,
            }
            for st in decomposed.subtasks
        ],
        "total_estimated_minutes": decomposed.total_estimated_minutes,
        "critical_path": decomposed.critical_path,
        "parallel_groups": decomposed.parallel_groups,
        "risk_factors": decomposed.risk_factors,
    }


@router.post("/{task_id}/status")
async def update_task_status(
    task_id: str,
    new_status: str,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    更新任务状态
    
    使用状态机验证状态转换
    """
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    try:
        old_status = TaskStatus(task.status)
        target_status = TaskStatus(new_status)
    except ValueError:
        raise HTTPException(status_code=400, detail="无效的状态值")
    
    # 验证状态转换
    state_machine = TaskStateMachine()
    if not state_machine.can_transition(old_status, target_status):
        raise HTTPException(
            status_code=400,
            detail=f"无法从 {old_status.value} 转换到 {target_status.value}"
        )
    
    # 更新状态
    task.status = new_status
    
    # 如果完成，记录完成时间
    if new_status == TaskStatus.COMPLETED.value:
        task.completed_at = datetime.now()
    
    await db.commit()
    
    logger.info("task.status_updated", task_id=task_id, old=old_status.value, new=new_status)
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "task_id": task_id,
        "old_status": old_status.value,
        "new_status": new_status,
        "valid_transitions": [t.value for t in state_machine.get_valid_transitions(target_status)],
    }


@router.post("/{task_id}/checkpoint")
async def create_checkpoint(
    task_id: str,
    progress_percent: float,
    state: dict,
    notes: str = None,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    创建任务检查点
    
    用于任务恢复
    """
    manager = get_resumable_task_manager()
    
    checkpoint = await manager.create_checkpoint(
        task_id=task_id,
        state=state,
        progress_percent=progress_percent,
        notes=notes,
    )
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "checkpoint_id": checkpoint.checkpoint_id,
        "task_id": task_id,
        "progress_percent": progress_percent,
        "created_at": checkpoint.created_at.isoformat(),
    }


@router.get("/{task_id}/checkpoints")
async def get_task_checkpoints(
    task_id: str,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """获取任务检查点历史"""
    manager = get_resumable_task_manager()
    
    checkpoints = await manager.get_checkpoint_history(task_id)
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "task_id": task_id,
        "checkpoint_count": len(checkpoints),
        "checkpoints": [
            {
                "checkpoint_id": cp.checkpoint_id,
                "progress_percent": cp.progress_percent,
                "created_at": cp.created_at.isoformat(),
                "notes": cp.notes,
            }
            for cp in checkpoints
        ],
    }


@router.post("/{task_id}/resume")
async def resume_task(
    task_id: str,
    checkpoint_id: str = None,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    从检查点恢复任务
    """
    manager = get_resumable_task_manager()
    
    checkpoint = await manager.resume_from_checkpoint(task_id, checkpoint_id)
    
    if not checkpoint:
        raise HTTPException(status_code=404, detail="检查点不存在")
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "task_id": task_id,
        "checkpoint_id": checkpoint.checkpoint_id,
        "progress_percent": checkpoint.progress_percent,
        "state": checkpoint.state,
        "message": "任务已恢复，请继续执行",
    }


@router.post("/batch-update")
async def batch_update_tasks(
    task_ids: List[str],
    new_status: str,
    confirm_token: str = None,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    批量更新任务状态
    
    需要二次确认（如果未提供confirm_token）
    """
    batch_service = get_task_batch_service()
    
    try:
        target_status = TaskStatus(new_status)
    except ValueError:
        raise HTTPException(status_code=400, detail="无效的状态值")
    
    # 检查是否需要确认
    if not confirm_token:
        # 创建确认请求
        confirmation_service = get_confirmation_service()
        
        # 获取任务信息用于显示
        result = await db.execute(
            select(Task).where(Task.id.in_(task_ids))
        )
        tasks = result.scalars().all()
        
        confirmation = await confirmation_service.create_confirmation(
            plan_id=tasks[0].plan_id if tasks else "unknown",
            confirmation_type="batch_task_update",
            title=f"批量更新{len(task_ids)}个任务状态",
            description=f"将{len(task_ids)}个任务的状态更新为：{new_status}",
            impact_summary=f"同时修改{len(task_ids)}个任务的状态",
            affected_items=[{"type": "任务", "name": t.title} for t in tasks[:5]],
            undo_window_minutes=10,
            metadata={
                "task_ids": task_ids,
                "new_status": new_status,
            },
        )
        
        return {
            "trace_id": trace_id,
            "request_id": request_id,
            "requires_confirmation": True,
            "confirmation_id": confirmation.confirmation_id,
            "message": "请确认批量更新操作",
        }
    
    # 执行更新
    result = await batch_service.batch_update_status(
        task_ids=task_ids,
        new_status=target_status,
        db=db,
        confirmed=True,
    )
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        **result,
    }


@router.post("/batch-delete")
async def batch_delete_tasks(
    task_ids: List[str],
    confirm_token: str = None,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    批量删除任务
    
    需要二次确认（不可逆操作）
    """
    batch_service = get_task_batch_service()
    
    # 检查是否需要确认
    if not confirm_token:
        # 获取任务信息
        result = await db.execute(
            select(Task).where(Task.id.in_(task_ids))
        )
        tasks = result.scalars().all()
        
        confirmation_service = get_confirmation_service()
        confirmation = await confirmation_service.create_confirmation(
            plan_id=tasks[0].plan_id if tasks else "unknown",
            confirmation_type="task_delete",
            title=f"批量删除{len(task_ids)}个任务",
            description="此操作将永久删除这些任务，相关进度数据也将被清除。",
            impact_summary=f"将永久删除{len(task_ids)}个任务",
            affected_items=[{"type": "任务", "name": t.title} for t in tasks[:5]],
            undo_window_minutes=5,
            metadata={"task_ids": task_ids},
        )
        
        return {
            "trace_id": trace_id,
            "request_id": request_id,
            "requires_confirmation": True,
            "confirmation_id": confirmation.confirmation_id,
            "warning": "删除操作不可逆，请谨慎确认",
        }
    
    # 执行删除
    result = await batch_service.batch_delete(
        task_ids=task_ids,
        db=db,
        confirmed=True,
    )
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        **result,
    }


@router.get("/visualization/{plan_id}")
async def get_task_visualization(
    plan_id: str,
    view_type: TaskViewType = TaskViewType.KANBAN,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    获取任务可视化数据
    
    支持：甘特图、看板、依赖图
    """
    # 获取任务
    result = await db.execute(
        select(Task).where(Task.plan_id == plan_id)
    )
    tasks = result.scalars().all()
    
    if not tasks:
        raise HTTPException(status_code=404, detail="该计划下没有任务")
    
    # 转换为字典
    task_dicts = [
        {
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "status": t.status,
            "priority": t.priority,
            "due_date": t.scheduled_end.isoformat() if t.scheduled_end else None,
            "dependencies": [],  # 需要从metadata解析
        }
        for t in tasks
    ]
    
    # 生成可视化
    viz_service = get_task_visualization_service()
    visualization = await viz_service.generate_view(view_type, task_dicts)
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "plan_id": plan_id,
        "view_type": view_type.value,
        "data": visualization.data,
        "metadata": visualization.metadata,
    }


@router.get("/dashboard/{plan_id}")
async def get_task_dashboard(
    plan_id: str,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    获取任务仪表板
    
    包含统计、进度、预警等
    """
    # 获取任务
    result = await db.execute(
        select(Task).where(Task.plan_id == plan_id)
    )
    tasks = result.scalars().all()
    
    # 获取里程碑
    result = await db.execute(
        select(Plan).where(Plan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    
    task_dicts = [
        {
            "id": t.id,
            "title": t.title,
            "status": t.status,
            "priority": t.priority,
            "due_date": t.scheduled_end.isoformat() if t.scheduled_end else None,
            "milestone_id": None,  # 需要关联
        }
        for t in tasks
    ]
    
    # 生成仪表板
    viz_service = get_task_visualization_service()
    dashboard = await viz_service.generate_dashboard(task_dicts)
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "plan_id": plan_id,
        **dashboard,
    }


@router.get("/{task_id}/valid-transitions")
async def get_valid_transitions(
    task_id: str,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """获取任务的有效状态转换"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    try:
        current_status = TaskStatus(task.status)
    except ValueError:
        current_status = TaskStatus.PENDING
    
    state_machine = TaskStateMachine()
    valid_transitions = state_machine.get_valid_transitions(current_status)
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "task_id": task_id,
        "current_status": current_status.value,
        "valid_transitions": [t.value for t in valid_transitions],
    }
