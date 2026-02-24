"""
FlowBoard AI Service - Main Application
"""

import os
import sys
from contextlib import asynccontextmanager

# 添加项目根目录到Python路径
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.core.database import engine, Base

# 设置日志
setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时
    logger.info("application.starting")
    
    # 创建数据库表
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    logger.info("database.initialized")
    
    # 初始化模型网关
    from app.services.model_gateway import get_model_gateway
    model_gateway = get_model_gateway()
    
    # 启动时预热
    try:
        # 测试模型网关
        await model_gateway.generate(
            messages=[{"role": "user", "content": "Hello"}],
            temperature=0.1,
            max_tokens=5,
        )
        logger.info("model_gateway.warmed_up")
    except Exception as e:
        logger.warning("model_gateway.warmup_failed", error=str(e))
    
    yield
    
    # 关闭时
    logger.info("application.shutting_down")


# 创建FastAPI应用
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="AI驱动的智能计划与任务管理平台",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 注册路由
from app.api.routes import (
    session,
    chat,
    rag,
    plan,
    task,
    decomposer,
    review,
    memory,
    calendar,
    notifications,
    health,
    evaluation,
)

# API路由注册
app.include_router(
    session.router,
    prefix=f"{settings.API_V1_STR}/sessions",
    tags=["sessions"],
)

app.include_router(
    chat.router,
    prefix=f"{settings.API_V1_STR}/chat",
    tags=["chat"],
)

app.include_router(
    rag.router,
    prefix=f"{settings.API_V1_STR}/rag",
    tags=["rag"],
)

app.include_router(
    plan.router,
    prefix=f"{settings.API_V1_STR}/planning",
    tags=["planning"],
)

app.include_router(
    task.router,
    prefix=f"{settings.API_V1_STR}/tasks",
    tags=["tasks"],
)

app.include_router(
    decomposer.router,
    prefix=f"{settings.API_V1_STR}/decomposer",
    tags=["decomposer"],
)

app.include_router(
    review.router,
    prefix=f"{settings.API_V1_STR}/review",
    tags=["review"],
)

app.include_router(
    memory.router,
    prefix=f"{settings.API_V1_STR}/memory",
    tags=["memory"],
)

app.include_router(
    calendar.router,
    prefix=f"{settings.API_V1_STR}/calendar",
    tags=["calendar"],
)

app.include_router(
    notifications.router,
    prefix=f"{settings.API_V1_STR}/notifications",
    tags=["notifications"],
)

app.include_router(
    evaluation.router,
    prefix=f"{settings.API_V1_STR}/eval",
    tags=["evaluation"],
)

app.include_router(
    health.router,
    prefix=f"{settings.API_V1_STR}",
    tags=["health"],
)


# 启动事件
@app.on_event("startup")
async def startup_event():
    """启动事件"""
    logger.info(
        "application.started",
        version=settings.VERSION,
        debug=settings.DEBUG,
    )


@app.on_event("shutdown")
async def shutdown_event():
    """关闭事件"""
    logger.info("application.stopped")


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info",
    )
