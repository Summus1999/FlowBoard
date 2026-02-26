"""
API 路由模块
"""

from fastapi import APIRouter

from app.api.routes import (
    health,
    chat,
    task,
    plan,
    memory,
    rag,
    session,
    notifications,
    calendar,
    decomposer,
    review,
    evaluation,
    metrics,
    config,
)

main_router = APIRouter()

# 健康检查
main_router.include_router(health.router, prefix="/health", tags=["health"])

# 业务路由
main_router.include_router(chat.router, prefix="/chat", tags=["chat"])
main_router.include_router(task.router, prefix="/tasks", tags=["tasks"])
main_router.include_router(plan.router, prefix="/plans", tags=["plans"])
main_router.include_router(memory.router, prefix="/memory", tags=["memory"])
main_router.include_router(rag.router, prefix="/rag", tags=["rag"])
main_router.include_router(session.router, prefix="/sessions", tags=["sessions"])
main_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
main_router.include_router(calendar.router, prefix="/calendar", tags=["calendar"])
main_router.include_router(decomposer.router, prefix="/decompose", tags=["decomposer"])
main_router.include_router(review.router, prefix="/review", tags=["review"])
main_router.include_router(evaluation.router, prefix="/eval", tags=["evaluation"])
main_router.include_router(metrics.router, prefix="/metrics", tags=["metrics"])
main_router.include_router(config.router, prefix="/config", tags=["config"])

__all__ = ["main_router"]
