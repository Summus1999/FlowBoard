"""
API依赖注入
FastAPI依赖定义
"""

from typing import AsyncGenerator, Optional

from fastapi import Header, Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_db_session
from app.core.logging import get_logger
from app.core.request_context import normalize_request_id, normalize_trace_id

logger = get_logger(__name__)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """获取数据库会话依赖"""
    async with get_async_db_session() as session:
        yield session


async def get_trace_id(
    request: Request,
    x_trace_id: Optional[str] = Header(None, alias="X-Trace-Id"),
) -> str:
    """
    获取或生成trace_id
    
    优先从请求头获取，否则生成新的UUID
    """
    trace_id = getattr(request.state, "trace_id", None)
    if trace_id:
        return trace_id
    return normalize_trace_id(x_trace_id)


async def get_request_id(
    request: Request,
    x_request_id: Optional[str] = Header(None, alias="X-Request-Id"),
) -> str:
    """
    获取或生成request_id
    """
    request_id = getattr(request.state, "request_id", None)
    if request_id:
        return request_id
    return normalize_request_id(x_request_id)


async def get_idempotency_key(
    request: Request,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
) -> Optional[str]:
    """获取幂等性键"""
    return idempotency_key or getattr(request.state, "idempotency_key", None)


class CommonHeaders:
    """通用请求头封装"""
    
    def __init__(
        self,
        trace_id: str,
        request_id: str,
        idempotency_key: Optional[str] = None,
    ):
        self.trace_id = trace_id
        self.request_id = request_id
        self.idempotency_key = idempotency_key


async def get_common_headers(
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    idempotency_key: Optional[str] = Depends(get_idempotency_key),
) -> CommonHeaders:
    """获取通用请求头"""
    return CommonHeaders(
        trace_id=trace_id,
        request_id=request_id,
        idempotency_key=idempotency_key,
    )
