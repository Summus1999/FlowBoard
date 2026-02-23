"""
Plan API路由
处理学习计划管理
"""

from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.api.schemas import (
    PlanProposeRequest,
    PlanProposeResponse,
    PlanConfirmRequest,
    PlanConfirmResponse,
    PlanRollbackRequest,
    PlanResponse,
)
from app.api.deps import get_db, get_trace_id, get_request_id
from app.models.plan import Plan, PlanVersion, Task, PlanStatus
from app.services.planner_service import get_planner_agent, get_plan_persistence
from app.services.plan_confirmation import (
    get_confirmation_service,
    ProposalConfirmationBuilder,
    ConfirmationType,
)
from app.services.plan_version_manager import get_plan_version_manager
from app.services.tool_integration import get_scheduler_agent

logger = get_logger(__name__)
router = APIRouter()


@router.post("/propose", response_model=PlanProposeResponse)
async def propose_plan(
    request: PlanProposeRequest,
    background_tasks: BackgroundTasks,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    生成学习计划提案
    
    完整的Planner Agent流程：
    1. 分析目标
    2. 检测模板
    3. 生成里程碑
    4. 生成任务
    5. 创建确认请求
    """
    # 1. 创建计划提案
    planner = get_planner_agent()
    
    proposal = await planner.create_plan_proposal(
        goal_description=request.goal,
        target_date=request.target_date,
        constraints=request.constraints,
    )
    
    # 2. 保存到数据库
    persistence = get_plan_persistence()
    plan = await persistence.save_proposal(
        user_id="default_user",  # TODO: 从认证获取
        proposal=proposal,
        db=db,
    )
    
    # 3. 创建确认请求
    confirmation_builder = ProposalConfirmationBuilder()
    confirmation_data = confirmation_builder.build_for_plan_creation(
        plan_id=plan.id,
        plan_title=proposal.title,
        milestones_count=len(proposal.milestones),
        tasks_count=len(proposal.tasks),
        estimated_duration=f"{proposal.total_duration_days}天",
        will_create_calendar_events=True,
        will_create_todos=True,
    )
    
    confirmation_service = get_confirmation_service()
    confirmation = await confirmation_service.create_confirmation(
        **confirmation_data,
        metadata={
            "proposal_data": {
                "milestones": [m.title for m in proposal.milestones],
                "tasks_count": len(proposal.tasks),
            }
        },
    )
    
    logger.info(
        "plan.proposed",
        plan_id=plan.id,
        confirmation_id=confirmation.confirmation_id,
    )
    
    return PlanProposeResponse(
        trace_id=trace_id,
        request_id=request_id,
        plan_id=plan.id,
        confirmation_id=confirmation.confirmation_id,
        proposal={
            "plan_id": plan.id,
            "title": proposal.title,
            "overview": proposal.overview,
            "milestones": [
                {
                    "title": m.title,
                    "duration_days": m.duration_days,
                    "deliverables": m.deliverables,
                }
                for m in proposal.milestones
            ],
            "total_duration": f"{proposal.total_duration_days}天",
            "total_hours": proposal.total_hours,
            "risk_assessment": proposal.risk_assessment,
        },
        requires_confirmation=True,
    )


@router.post("/{plan_id}/confirm", response_model=PlanConfirmResponse)
async def confirm_plan(
    plan_id: str,
    request: PlanConfirmRequest,
    background_tasks: BackgroundTasks,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    确认或拒绝计划提案
    
    确认后：
    1. 更新计划状态
    2. 创建日历事件
    3. 创建待办事项
    """
    if not request.confirmation_id:
        raise HTTPException(status_code=400, detail="缺少confirmation_id")
    
    confirmation_service = get_confirmation_service()
    
    if request.confirm:
        # 确认
        confirmation = await confirmation_service.confirm(
            confirmation_id=request.confirmation_id,
            user_id="default_user",
            feedback=request.feedback,
            db=db,
        )
        
        # 获取计划数据
        result = await db.execute(
            select(PlanVersion)
            .where(PlanVersion.plan_id == plan_id)
            .order_by(desc(PlanVersion.version_no))
        )
        version = result.scalar_one_or_none()
        
        if version and version.content_json:
            # 异步执行计划（创建日历和待办）
            background_tasks.add_task(
                execute_plan_async,
                plan_id=plan_id,
                plan_data=version.content_json,
            )
        
        logger.info("plan.confirmed", plan_id=plan_id)
        
        return PlanConfirmResponse(
            trace_id=trace_id,
            request_id=request_id,
            plan_id=plan_id,
            status=PlanStatus.CONFIRMED.value,
            executed=True,
            message="计划已确认，正在创建日程和待办...",
        )
    else:
        # 拒绝
        confirmation = await confirmation_service.reject(
            confirmation_id=request.confirmation_id,
            feedback=request.feedback,
        )
        
        # 更新计划状态为取消
        result = await db.execute(
            select(Plan).where(Plan.id == plan_id)
        )
        plan = result.scalar_one_or_none()
        
        if plan:
            plan.status = PlanStatus.CANCELLED.value
            await db.commit()
        
        logger.info("plan.rejected", plan_id=plan_id)
        
        return PlanConfirmResponse(
            trace_id=trace_id,
            request_id=request.request_id,
            plan_id=plan_id,
            status=PlanStatus.CANCELLED.value,
            executed=False,
            message="计划已取消",
        )


async def execute_plan_async(plan_id: str, plan_data: dict):
    """异步执行计划"""
    try:
        scheduler = get_scheduler_agent()
        result = await scheduler.execute_plan(plan_id, plan_data)
        
        logger.info(
            "plan.execution_complete",
            plan_id=plan_id,
            success=result.get("success_count", 0),
        )
    except Exception as e:
        logger.error("plan.execution_failed", plan_id=plan_id, error=str(e))


@router.get("/{plan_id}/versions")
async def get_plan_versions(
    plan_id: str,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    获取计划版本历史
    """
    version_manager = get_plan_version_manager()
    history = await version_manager.get_version_history(plan_id, db)
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "plan_id": plan_id,
        "versions": [
            {
                "version_no": h.version_no,
                "created_at": h.created_at.isoformat() if h.created_at else None,
                "confirmed_by_user": h.confirmed_by_user,
                "confirmed_at": h.confirmed_at.isoformat() if h.confirmed_at else None,
                "change_summary": h.change_summary,
                "task_count": h.task_count,
                "is_active": h.is_active,
            }
            for h in history
        ],
    }


@router.post("/{plan_id}/rollback")
async def rollback_plan(
    plan_id: str,
    request: PlanRollbackRequest,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    回滚计划到指定版本
    """
    version_manager = get_plan_version_manager()
    
    try:
        new_version = await version_manager.rollback_to_version(
            plan_id=plan_id,
            target_version=request.target_version,
            reason=request.reason,
            db=db,
        )
        
        return {
            "trace_id": trace_id,
            "request_id": request_id,
            "plan_id": plan_id,
            "new_version": new_version.version_no,
            "target_version": request.target_version,
            "message": f"计划已回滚到版本 {request.target_version}",
        }
        
    except Exception as e:
        logger.error("plan.rollback_failed", plan_id=plan_id, error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{plan_id}/versions/{version_no}/compare")
async def compare_plan_versions(
    plan_id: str,
    version_no: int,
    compare_to: int,  # 查询参数
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    比较两个版本
    """
    version_manager = get_plan_version_manager()
    
    try:
        comparison = await version_manager.compare_versions(
            plan_id=plan_id,
            version_a=version_no,
            version_b=compare_to,
            db=db,
        )
        
        return {
            "trace_id": trace_id,
            "request_id": request_id,
            "plan_id": plan_id,
            "comparison": {
                "version_a": comparison.version_a,
                "version_b": comparison.version_b,
                "summary": comparison.summary,
                "added_tasks": comparison.added_tasks,
                "removed_tasks": comparison.removed_tasks,
                "modified_tasks": comparison.modified_tasks,
            },
        }
        
    except Exception as e:
        logger.error("plan.compare_failed", plan_id=plan_id, error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{plan_id}", response_model=PlanResponse)
async def get_plan(
    plan_id: str,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    获取计划详情
    """
    result = await db.execute(
        select(Plan).where(Plan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(status_code=404, detail="计划不存在")
    
    # 获取当前版本内容
    version_manager = get_plan_version_manager()
    version_details = await version_manager.get_version_details(
        plan_id=plan_id,
        version_no=plan.current_version,
        db=db,
    )
    
    return PlanResponse(
        trace_id=trace_id,
        request_id=request_id,
        plan_id=plan.id,
        title=plan.title,
        status=plan.status,
        current_version=plan.current_version,
        content=version_details.get("content_md") if version_details else None,
    )


@router.get("")
async def list_plans(
    status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    获取计划列表
    """
    query = select(Plan).order_by(Plan.created_at.desc())
    
    if status:
        query = query.where(Plan.status == status)
    
    query = query.limit(limit).offset(offset)
    
    result = await db.execute(query)
    plans = result.scalars().all()
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "plans": [
            {
                "id": p.id,
                "title": p.title,
                "status": p.status,
                "current_version": p.current_version,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in plans
        ],
    }
