"""API路由模块"""

from fastapi import APIRouter

from app.api.routes import chat, session, plan, rag, health, evaluation

api_router = APIRouter()

api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(session.router, prefix="/sessions", tags=["sessions"])
api_router.include_router(plan.router, prefix="/plans", tags=["plans"])
api_router.include_router(rag.router, prefix="/rag", tags=["rag"])
api_router.include_router(evaluation.router, prefix="/eval", tags=["evaluation"])
api_router.include_router(health.router, prefix="", tags=["health"])
