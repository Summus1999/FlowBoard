"""
健康检查和监控路由
"""

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.api.deps import get_db, get_trace_id, get_request_id
from app.api.schemas import HealthResponse
from app.services.model_gateway import get_model_gateway

logger = get_logger(__name__)
router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    健康检查端点
    """
    return HealthResponse(
        status="healthy",
        version=settings.APP_VERSION,
        timestamp=datetime.now().isoformat(),
    )


@router.get("/ready")
async def readiness_check(
    db: AsyncSession = Depends(get_db),
):
    """
    就绪检查
    
    检查数据库连接等依赖
    """
    try:
        # 检查数据库连接
        await db.execute(text("SELECT 1"))
        
        return {
            "status": "ready",
            "checks": {
                "database": "ok",
            },
        }
    except Exception as e:
        logger.error("readiness_check.failed", error=str(e))
        return {
            "status": "not_ready",
            "checks": {
                "database": "failed",
            },
        }


@router.get("/cost")
async def get_cost_metrics(
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
):
    """
    获取成本指标
    
    包括模型调用成本统计、预算使用情况等
    """
    gateway = get_model_gateway()
    cost_stats = gateway.get_cost_stats()
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "metrics": {
            "cost": cost_stats,
            "budget_limit": settings.MONTHLY_BUDGET_RMB,
            "budget_usage_percent": (
                cost_stats.get("monthly_total", 0) / settings.MONTHLY_BUDGET_RMB * 100
            ),
        },
        "timestamp": datetime.now().isoformat(),
    }
