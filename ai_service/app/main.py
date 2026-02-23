"""
FastAPI主应用
"""

import time
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.core.database import init_db, close_db, create_tables_async
from app.core.redis import init_redis, close_redis
from app.core.exceptions import AIException
from app.api.routes import api_router

# 配置日志
setup_logging(debug=settings.DEBUG)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    应用生命周期管理
    """
    # 启动
    logger.info(
        "app.starting",
        app_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        env=settings.ENV,
    )
    
    # 初始化数据库
    init_db()
    try:
        await create_tables_async()
        logger.info("app.database_initialized")
    except Exception as e:
        logger.error("app.database_init_failed", error=str(e))
    
    # 初始化Redis
    try:
        await init_redis()
        logger.info("app.redis_initialized")
    except Exception as e:
        logger.warning("app.redis_init_failed", error=str(e))
    
    logger.info("app.startup_complete")
    
    yield
    
    # 关闭
    logger.info("app.shutting_down")
    
    close_db()
    await close_redis()
    
    logger.info("app.shutdown_complete")


def create_app() -> FastAPI:
    """
    创建FastAPI应用实例
    """
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="FlowBoard AI Service - RAG + Agent 企业级方案",
        docs_url=f"{settings.API_PREFIX}/docs",
        redoc_url=f"{settings.API_PREFIX}/redoc",
        openapi_url=f"{settings.API_PREFIX}/openapi.json",
        lifespan=lifespan,
    )
    
    # CORS中间件
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # 请求日志中间件
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start_time = time.time()
        
        # 记录请求
        logger.info(
            "request.start",
            method=request.method,
            path=request.url.path,
            client=request.client.host if request.client else None,
        )
        
        response = await call_next(request)
        
        # 记录响应
        duration = time.time() - start_time
        logger.info(
            "request.complete",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=round(duration * 1000, 2),
        )
        
        return response
    
    # 全局异常处理
    @app.exception_handler(AIException)
    async def ai_exception_handler(request: Request, exc: AIException):
        """处理AI自定义异常"""
        logger.error(
            "exception.ai",
            code=exc.code,
            message=exc.message,
            path=request.url.path,
        )
        
        # 获取trace_id和request_id
        trace_id = request.headers.get("X-Trace-Id", "unknown")
        request_id = request.headers.get("X-Request-Id", "unknown")
        
        return JSONResponse(
            status_code=exc.status_code,
            headers={
                "X-Trace-Id": trace_id,
                "X-Request-Id": request_id,
            },
            content={
                "code": exc.code,
                "message": exc.message,
                "trace_id": trace_id,
                "request_id": request_id,
                "timestamp": datetime.now().isoformat(),
            },
        )
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        """处理通用异常"""
        logger.error(
            "exception.general",
            error=str(exc),
            path=request.url.path,
        )
        
        trace_id = request.headers.get("X-Trace-Id", "unknown")
        request_id = request.headers.get("X-Request-Id", "unknown")
        
        return JSONResponse(
            status_code=500,
            headers={
                "X-Trace-Id": trace_id,
                "X-Request-Id": request_id,
            },
            content={
                "code": "AI-5000",
                "message": "内部服务器错误",
                "trace_id": trace_id,
                "request_id": request_id,
                "timestamp": datetime.now().isoformat(),
            },
        )
    
    # 注册路由
    app.include_router(api_router, prefix=settings.API_PREFIX)
    
    # 根路径
    @app.get("/")
    async def root():
        return {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "docs": f"{settings.API_PREFIX}/docs",
        }
    
    return app


# 创建应用实例
app = create_app()


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG,
        log_level="debug" if settings.DEBUG else "info",
    )
