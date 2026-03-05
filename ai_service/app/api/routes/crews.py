"""
crewAI 多智能体路由
提供学习计划生成、任务拆解、进度复盘三个 crewAI Crew 端点
"""

import asyncio
import json
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.logging import get_logger
from app.api.deps import get_trace_id, get_request_id
from app.crews.learning_crew import get_crew_executor

logger = get_logger(__name__)
router = APIRouter()


# ─── 请求/响应模型 ─────────────────────────────────────────────

class CrewPlanRequest(BaseModel):
    """crewAI 学习计划生成请求"""
    goal: str = Field(..., min_length=2, max_length=2000, description="学习目标")
    target_date: Optional[str] = Field(None, description="目标完成日期 (ISO 格式)")
    weekly_hours: int = Field(10, ge=1, le=80, description="每周可用学习时长（小时）")
    constraints: Optional[List[str]] = Field(None, description="约束条件列表")


class CrewDecomposeRequest(BaseModel):
    """crewAI 任务拆解请求"""
    task_title: str = Field(..., min_length=1, max_length=200, description="任务标题")
    task_description: str = Field(..., min_length=1, max_length=5000, description="任务描述")
    estimated_hours: float = Field(..., ge=0.5, le=1000, description="预计总时长（小时）")
    context: Optional[str] = Field(None, description="额外背景信息")


class CrewReviewRequest(BaseModel):
    """crewAI 进度复盘请求"""
    period: str = Field("weekly", description="复盘周期: daily/weekly/monthly")
    tasks_data: str = Field(..., description="任务完成数据（JSON 字符串）")
    start_date: Optional[str] = Field(None, description="开始日期 (ISO 格式)")
    end_date: Optional[str] = Field(None, description="结束日期 (ISO 格式)")


class CrewResultResponse(BaseModel):
    """crewAI 执行结果响应"""
    trace_id: str
    request_id: str
    success: bool
    crew_type: str
    result: str
    json_output: Optional[dict] = None
    duration_seconds: Optional[float] = None


# ─── 路由端点 ──────────────────────────────────────────────────

@router.post("/plan", response_model=CrewResultResponse)
async def crew_generate_plan(
    request: CrewPlanRequest,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
):
    """
    使用 crewAI（Planner + Decomposer 双 Agent）生成学习计划
    
    与 /plans/propose 区别：
    - 本接口由多 Agent 协作完成，分析更深入
    - Planner Agent 负责整体框架，Decomposer Agent 负责细化拆解
    - 支持更复杂的约束条件处理
    """
    logger.info(
        "crews.plan.start",
        trace_id=trace_id,
        goal_len=len(request.goal),
        weekly_hours=request.weekly_hours,
    )

    executor = get_crew_executor()
    start_time = datetime.now()

    try:
        # crew.kickoff() 是同步阻塞调用，放到线程池避免阻塞事件循环
        result = await asyncio.to_thread(
            _run_planning_crew,
            executor=executor,
            goal=request.goal,
            target_date=request.target_date,
            weekly_hours=request.weekly_hours,
            constraints=request.constraints,
        )

        duration = (datetime.now() - start_time).total_seconds()

        logger.info(
            "crews.plan.complete",
            trace_id=trace_id,
            duration=duration,
        )

        return CrewResultResponse(
            trace_id=trace_id,
            request_id=request_id,
            success=result["success"],
            crew_type="planning",
            result=result["result"],
            json_output=result.get("json_output"),
            duration_seconds=round(duration, 2),
        )

    except Exception as e:
        logger.error("crews.plan.failed", trace_id=trace_id, error=str(e))
        raise HTTPException(status_code=500, detail=f"crewAI 学习计划生成失败: {str(e)}")


@router.post("/decompose", response_model=CrewResultResponse)
async def crew_decompose_task(
    request: CrewDecomposeRequest,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
):
    """
    使用 crewAI（Decomposer Agent）拆解复杂任务为子任务

    与 /decompose/analyze 区别：
    - 本接口由 Agent 自主决策拆解策略，结果更灵活
    - 包含依赖关系分析和优先级建议
    """
    logger.info(
        "crews.decompose.start",
        trace_id=trace_id,
        task_title=request.task_title[:50],
        estimated_hours=request.estimated_hours,
    )

    executor = get_crew_executor()
    start_time = datetime.now()

    try:
        result = await asyncio.to_thread(
            _run_decomposition_crew,
            executor=executor,
            task_title=request.task_title,
            task_description=request.task_description,
            estimated_hours=request.estimated_hours,
            context=request.context,
        )

        duration = (datetime.now() - start_time).total_seconds()

        logger.info(
            "crews.decompose.complete",
            trace_id=trace_id,
            duration=duration,
        )

        return CrewResultResponse(
            trace_id=trace_id,
            request_id=request_id,
            success=result["success"],
            crew_type="decomposition",
            result=result["result"],
            json_output=result.get("json_output"),
            duration_seconds=round(duration, 2),
        )

    except Exception as e:
        logger.error("crews.decompose.failed", trace_id=trace_id, error=str(e))
        raise HTTPException(status_code=500, detail=f"crewAI 任务拆解失败: {str(e)}")


@router.post("/review", response_model=CrewResultResponse)
async def crew_generate_review(
    request: CrewReviewRequest,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
):
    """
    使用 crewAI（Reviewer Agent）生成学习进度复盘报告

    与 /review/generate 区别：
    - 本接口由 Agent 自主分析指标并生成洞察
    - 包含趋势判断和下一步行动建议
    """
    # 自动补全日期范围
    end_date = request.end_date or datetime.now().isoformat()
    if not request.start_date:
        period_days = {"daily": 1, "weekly": 7, "monthly": 30}.get(request.period, 7)
        start_date = (datetime.now() - timedelta(days=period_days)).isoformat()
    else:
        start_date = request.start_date

    logger.info(
        "crews.review.start",
        trace_id=trace_id,
        period=request.period,
        start_date=start_date,
        end_date=end_date,
    )

    executor = get_crew_executor()
    start_time = datetime.now()

    try:
        result = await asyncio.to_thread(
            _run_review_crew,
            executor=executor,
            period=request.period,
            tasks_data=request.tasks_data,
            start_date=start_date,
            end_date=end_date,
        )

        duration = (datetime.now() - start_time).total_seconds()

        logger.info(
            "crews.review.complete",
            trace_id=trace_id,
            duration=duration,
        )

        return CrewResultResponse(
            trace_id=trace_id,
            request_id=request_id,
            success=result["success"],
            crew_type="review",
            result=result["result"],
            json_output=result.get("json_output"),
            duration_seconds=round(duration, 2),
        )

    except Exception as e:
        logger.error("crews.review.failed", trace_id=trace_id, error=str(e))
        raise HTTPException(status_code=500, detail=f"crewAI 进度复盘失败: {str(e)}")


@router.get("/status")
async def crew_status(
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
):
    """检查 crewAI 框架可用状态"""
    try:
        from crewai import Crew
        crew_available = True
        crew_version = "available"
    except ImportError:
        crew_available = False
        crew_version = "not installed"

    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "crew_available": crew_available,
        "crew_version": crew_version,
        "endpoints": [
            "POST /crews/plan      - 多Agent学习计划生成",
            "POST /crews/decompose - Agent任务拆解",
            "POST /crews/review    - Agent进度复盘",
        ],
    }


# ─── 同步执行函数（在线程池中运行）─────────────────────────────

def _run_planning_crew(executor, goal, target_date, weekly_hours, constraints):
    """同步包装，供 asyncio.to_thread 调用"""
    import asyncio
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(
            executor.execute_planning(
                goal_description=goal,
                target_date=target_date,
                weekly_hours=weekly_hours,
                constraints=constraints,
            )
        )
    finally:
        loop.close()


def _run_decomposition_crew(executor, task_title, task_description, estimated_hours, context):
    """同步包装，供 asyncio.to_thread 调用"""
    import asyncio
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(
            executor.execute_decomposition(
                task_title=task_title,
                task_description=task_description,
                estimated_hours=estimated_hours,
                context=context,
            )
        )
    finally:
        loop.close()


def _run_review_crew(executor, period, tasks_data, start_date, end_date):
    """同步包装，供 asyncio.to_thread 调用"""
    import asyncio
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(
            executor.execute_review(
                period=period,
                tasks_data=tasks_data,
                start_date=start_date,
                end_date=end_date,
            )
        )
    finally:
        loop.close()
