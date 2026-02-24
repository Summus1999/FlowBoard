"""API路由模块"""

from fastapi import APIRouter

from app.api.routes import (
    chat,
    session,
    plan,
    task,
    rag,
    health,
    evaluation,
    decomposer,
    review,
    memory,
    calendar,
    notifications,
)

api_router = APIRouter()

api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(session.router, prefix="/sessions", tags=["sessions"])
api_router.include_router(plan.router, prefix="/plans", tags=["plans"])
api_router.include_router(task.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(rag.router, prefix="/rag", tags=["rag"])
api_router.include_router(evaluation.router, prefix="/eval", tags=["evaluation"])
api_router.include_router(health.router, prefix="", tags=["health"])
api_router.include_router(decomposer.router, prefix="/decomposer", tags=["decomposer"])
api_router.include_router(review.router, prefix="/review", tags=["review"])
api_router.include_router(memory.router, prefix="/memory", tags=["memory"])
api_router.include_router(calendar.router, prefix="/calendar", tags=["calendar"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
