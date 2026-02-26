"""
FlowBoard AI Service - Main Application
"""

import os
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone

# 添加项目根目录到Python路径
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.core.database import create_tables_async, init_db
from app.core.exceptions import AIErrorCode, AIException
from app.core.request_context import normalize_request_id, normalize_trace_id
from app.api.middleware import RequestContextMiddleware, IdempotencyMiddleware

# 设置日志
setup_logging(debug=settings.DEBUG)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时
    logger.info("application.starting")
    
    # Initialize database and create tables
    init_db()
    await create_tables_async()
    logger.info("database.initialized")
    
    # 初始化模型网关
    from app.services.model_gateway import get_model_gateway
    model_gateway = get_model_gateway()
    
    # Skip warmup — model API keys may be configured later via /config/providers
    active = [p.value for p in model_gateway._clients.keys()]
    if active:
        logger.info("model_gateway.ready", active_providers=active)
    else:
        logger.info("model_gateway.no_providers_configured")
    
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

# Middleware order: request context must be available before idempotency.
app.add_middleware(IdempotencyMiddleware)
app.add_middleware(RequestContextMiddleware)


def _error_payload(request: Request, code: str, message: str, request_id: str, trace_id: str) -> dict:
    return {
        "code": code,
        "message": message,
        "trace_id": trace_id,
        "request_id": request_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "path": request.url.path,
    }


def _request_identifiers(request: Request) -> tuple[str, str]:
    trace_id = getattr(request.state, "trace_id", None) or normalize_trace_id(
        request.headers.get("X-Trace-Id")
    )
    request_id = getattr(request.state, "request_id", None) or normalize_request_id(
        request.headers.get("X-Request-Id")
    )
    return trace_id, request_id


@app.exception_handler(AIException)
async def handle_ai_exception(request: Request, exc: AIException):
    trace_id, request_id = _request_identifiers(request)
    payload = _error_payload(
        request=request,
        code=exc.code,
        message=exc.message,
        request_id=request_id,
        trace_id=trace_id,
    )
    if exc.details:
        payload["details"] = exc.details
    return JSONResponse(
        status_code=exc.status_code,
        content=payload,
        headers={
            "X-Trace-Id": trace_id,
            "X-Request-Id": request_id,
            "X-Idempotent-Replay": "false",
        },
    )


@app.exception_handler(RequestValidationError)
async def handle_validation_error(request: Request, exc: RequestValidationError):
    trace_id, request_id = _request_identifiers(request)
    return JSONResponse(
        status_code=400,
        content={
            **_error_payload(
                request=request,
                code=AIErrorCode.INVALID_PARAMS,
                message="validation failed",
                request_id=request_id,
                trace_id=trace_id,
            ),
            "details": exc.errors(),
        },
        headers={
            "X-Trace-Id": trace_id,
            "X-Request-Id": request_id,
            "X-Idempotent-Replay": "false",
        },
    )


@app.exception_handler(HTTPException)
async def handle_http_exception(request: Request, exc: HTTPException):
    trace_id, request_id = _request_identifiers(request)
    code_map = {
        400: AIErrorCode.INVALID_PARAMS,
        401: AIErrorCode.UNAUTHORIZED,
        403: AIErrorCode.FORBIDDEN,
        404: AIErrorCode.RESOURCE_NOT_FOUND,
        409: AIErrorCode.VERSION_CONFLICT,
        429: AIErrorCode.BUDGET_EXCEEDED,
        500: AIErrorCode.INTERNAL_ERROR,
        502: AIErrorCode.MODEL_ERROR,
        504: AIErrorCode.RETRIEVAL_TIMEOUT,
    }
    message = str(exc.detail) if exc.detail else "request failed"
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_payload(
            request=request,
            code=code_map.get(exc.status_code, AIErrorCode.INTERNAL_ERROR),
            message=message,
            request_id=request_id,
            trace_id=trace_id,
        ),
        headers={
            "X-Trace-Id": trace_id,
            "X-Request-Id": request_id,
            "X-Idempotent-Replay": "false",
        },
    )


@app.exception_handler(Exception)
async def handle_unexpected_exception(request: Request, exc: Exception):
    trace_id, request_id = _request_identifiers(request)
    logger.error("api.unhandled_exception", error=str(exc), path=request.url.path)
    return JSONResponse(
        status_code=500,
        content=_error_payload(
            request=request,
            code=AIErrorCode.INTERNAL_ERROR,
            message="internal server error",
            request_id=request_id,
            trace_id=trace_id,
        ),
        headers={
            "X-Trace-Id": trace_id,
            "X-Request-Id": request_id,
            "X-Idempotent-Replay": "false",
        },
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
    metrics,
    config,
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
    metrics.router,
    prefix=f"{settings.API_V1_STR}/metrics",
    tags=["metrics"],
)

app.include_router(
    health.router,
    prefix=f"{settings.API_V1_STR}",
    tags=["health"],
)

app.include_router(
    config.router,
    prefix=f"{settings.API_V1_STR}/config",
    tags=["config"],
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
