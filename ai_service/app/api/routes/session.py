"""
Session API路由
处理会话管理
"""

from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.api.schemas import (
    SessionCreateRequest,
    SessionResponse,
    MessageResponse,
)
from app.api.deps import get_db, get_trace_id, get_request_id
from app.models.session import Session as SessionModel, Message as MessageModel, SessionStatus

logger = get_logger(__name__)
router = APIRouter()


@router.post("", response_model=SessionResponse)
async def create_session(
    request: SessionCreateRequest,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    创建新会话
    """
    session = SessionModel(
        id=str(uuid4()),
        user_id=request.user_id,
        title=request.title or "新会话",
        status=SessionStatus.ACTIVE.value,
        context=request.context,
    )
    
    db.add(session)
    await db.commit()
    await db.refresh(session)
    
    logger.info(
        "session.created",
        session_id=session.id,
        user_id=request.user_id,
    )
    
    return SessionResponse(
        trace_id=trace_id,
        request_id=request_id,
        session_id=session.id,
        user_id=session.user_id,
        title=session.title,
        status=session.status,
        created_at=session.created_at.isoformat(),
    )


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    获取会话信息
    """
    result = await db.execute(
        select(SessionModel).where(SessionModel.id == session_id)
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    return SessionResponse(
        trace_id=trace_id,
        request_id=request_id,
        session_id=session.id,
        user_id=session.user_id,
        title=session.title,
        status=session.status,
        created_at=session.created_at.isoformat(),
    )


@router.get("/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    limit: int = 50,
    offset: int = 0,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    获取会话消息列表
    """
    result = await db.execute(
        select(MessageModel)
        .where(MessageModel.session_id == session_id)
        .order_by(MessageModel.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    messages = result.scalars().all()
    
    return [
        MessageResponse(
            id=msg.id,
            role=msg.role,
            content=msg.content,
            created_at=msg.created_at.isoformat(),
        )
        for msg in messages
    ]


@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    删除会话
    """
    result = await db.execute(
        select(SessionModel).where(SessionModel.id == session_id)
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    session.status = SessionStatus.DELETED.value
    await db.commit()
    
    logger.info("session.deleted", session_id=session_id)
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "deleted": True,
    }
