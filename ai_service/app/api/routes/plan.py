"""
Plan API路由
处理学习计划管理
"""

from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
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
from app.models.plan import Plan, PlanVersion, PlanStatus

logger = get_logger(__name__)
router = APIRouter()


@router.post("/propose", response_model=PlanProposeResponse)
async def propose_plan(
    request: PlanProposeRequest,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    生成学习计划提案
    
    不直接执行，返回提案等待用户确认
    """
    # 创建计划草稿
    plan = Plan(
        id=str(uuid4()),
        user_id="default_user",  # TODO: 从认证获取
        title=f"学习计划：{request.goal[:30]}...",
        goal=request.goal,
        target_date=request.target_date,
        status=PlanStatus.PROPOSED.value,
    )
    
    db.add(plan)
    await db.flush()
    
    # 创建初始版本
    version = PlanVersion(
        id=str(uuid4()),
        plan_id=plan.id,
        version_no=1,
        content_md=f"# {plan.title}\n\n目标：{request.goal}\n\n（详细内容待AI生成）",
        created_by_agent="planner_agent",
    )
    
    db.add(version)
    await db.commit()
    await db.refresh(plan)
    
    logger.info(
        "plan.proposed",
        plan_id=plan.id,
        goal=request.goal[:50],
    )
    
    return PlanProposeResponse(
        trace_id=trace_id,
        request_id=request_id,
        plan_id=plan.id,
        proposal={
            "plan_id": plan.id,
            "title": plan.title,
            "goal": request.goal,
            "target_date": request.target_date.isoformat() if request.target_date else None,
            "version": 1,
            "requires_confirmation": True,
        },
        requires_confirmation=True,
    )


@router.post("/{plan_id}/confirm", response_model=PlanConfirmResponse)
async def confirm_plan(
    plan_id: str,
    request: PlanConfirmRequest,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    确认或拒绝计划提案
    """
    result = await db.execute(
        select(Plan).where(Plan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(status_code=404, detail="计划不存在")
    
    if plan.status != PlanStatus.PROPOSED.value:
        raise HTTPException(status_code=400, detail="计划状态不允许确认")
    
    if request.confirm:
        # 确认计划
        plan.status = PlanStatus.CONFIRMED.value
        
        # 更新版本确认状态
        result = await db.execute(
            select(PlanVersion)
            .where(PlanVersion.plan_id == plan_id)
            .where(PlanVersion.version_no == plan.current_version)
        )
        version = result.scalar_one_or_none()
        if version:
            version.confirmed_by_user = True
            version.confirmed_at = datetime.now()
        
        await db.commit()
        
        logger.info("plan.confirmed", plan_id=plan_id)
        
        return PlanConfirmResponse(
            trace_id=trace_id,
            request_id=request_id,
            plan_id=plan_id,
            status=PlanStatus.CONFIRMED.value,
            executed=True,
        )
    else:
        # 拒绝计划
        plan.status = PlanStatus.CANCELLED.value
        await db.commit()
        
        logger.info("plan.rejected", plan_id=plan_id, feedback=request.feedback)
        
        return PlanConfirmResponse(
            trace_id=trace_id,
            request_id=request_id,
            plan_id=plan_id,
            status=PlanStatus.CANCELLED.value,
            executed=False,
        )


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
    result = await db.execute(
        select(Plan).where(Plan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(status_code=404, detail="计划不存在")
    
    # 检查目标版本是否存在
    result = await db.execute(
        select(PlanVersion)
        .where(PlanVersion.plan_id == plan_id)
        .where(PlanVersion.version_no == request.target_version)
    )
    target_version = result.scalar_one_or_none()
    
    if not target_version:
        raise HTTPException(status_code=404, detail="目标版本不存在")
    
    # 执行回滚
    plan.current_version = request.target_version
    plan.status = PlanStatus.DRAFT.value  # 回滚后变为草稿状态
    await db.commit()
    
    logger.info(
        "plan.rollback",
        plan_id=plan_id,
        target_version=request.target_version,
        reason=request.reason,
    )
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "plan_id": plan_id,
        "current_version": request.target_version,
        "status": PlanStatus.DRAFT.value,
    }


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
    result = await db.execute(
        select(PlanVersion)
        .where(PlanVersion.plan_id == plan_id)
        .where(PlanVersion.version_no == plan.current_version)
    )
    version = result.scalar_one_or_none()
    
    return PlanResponse(
        trace_id=trace_id,
        request_id=request_id,
        plan_id=plan.id,
        title=plan.title,
        status=plan.status,
        current_version=plan.current_version,
        content=version.content_md if version else None,
    )
