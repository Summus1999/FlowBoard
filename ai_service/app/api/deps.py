"""
API依赖注入
FastAPI依赖定义
"""

import re
from datetime import datetime
from typing import AsyncGenerator, Optional
from uuid import uuid4

from fastapi import Header, HTTPException, Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_db_session
from app.core.logging import get_logger

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
    if x_trace_id:
        # 验证格式
        if re.match(r'^[0-9a-f-]{36}$', x_trace_id):
            return x_trace_id
        logger.warning("api.invalid_trace_id_format", trace_id=x_trace_id)
    
    # 生成新的trace_id
    new_trace_id = str(uuid4())
    logger.info("api.generated_trace_id", trace_id=new_trace_id)
    return new_trace_id


async def get_request_id(
    request: Request,
    x_request_id: Optional[str] = Header(None, alias="X-Request-Id"),
) -> str:
    """
    获取或生成request_id
    """
    if x_request_id:
        return x_request_id
    
    # 生成基于时间戳的request_id
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    new_request_id = f"req-{timestamp}-{uuid4().hex[:8]}"
    return new_request_id


async def get_idempotency_key(
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
) -> Optional[str]:
    """获取幂等性键"""
    return idempotency_key


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
