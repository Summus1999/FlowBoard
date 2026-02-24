"""
记忆API路由
处理三层记忆体系相关功能
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.api.deps import get_db, get_trace_id, get_request_id
from app.services.memory_service import get_memory_service, MemoryLevel
from app.models.memory import ShortTermMemory, LongTermMemory

logger = get_logger(__name__)
router = APIRouter()


@router.get("/context")
async def get_memory_context(
    user_id: str,
    session_id: str,
    query: str,
    include_levels: List[str] = Query(["short_term", "long_term"]),
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    获取相关记忆上下文
    
    根据查询获取与用户和会话相关的记忆
    
    - query: 查询内容
    - include_levels: 包含的记忆层级 [short_term, long_term, task]
    """
    memory_service = get_memory_service()
    
    context = await memory_service.get_relevant_context(
        user_id=user_id,
        session_id=session_id,
        query=query,
        db=db,
    )
    
    logger.info(
        "memory.context.retrieved",
        user_id=user_id,
        session_id=session_id,
        query=query[:50],
    )
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "context": context,
    }


@router.get("/short-term/{session_id}")
async def get_short_term_memory(
    session_id: str,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    获取短期记忆
    
    获取指定会话的短期记忆内容
    """
    memory_service = get_memory_service()
    
    memory = await memory_service.short_term.get_memory(session_id, db)
    
    if not memory:
        raise HTTPException(status_code=404, detail="短期记忆不存在")
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "memory": {
            "id": memory.id,
            "session_id": memory.session_id,
            "conversation_summary": memory.conversation_summary,
            "key_constraints": memory.key_constraints,
            "expires_at": memory.expires_at.isoformat() if memory.expires_at else None,
            "created_at": memory.created_at.isoformat() if memory.created_at else None,
        },
    }


@router.get("/long-term/{user_id}")
async def get_long_term_memory(
    user_id: str,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    获取长期记忆
    
    获取用户的长期偏好和画像
    """
    memory_service = get_memory_service()
    
    memory = await memory_service.long_term.get_memory(user_id, db)
    
    if not memory:
        return {
            "trace_id": trace_id,
            "request_id": request_id,
            "memory": None,
            "message": "长期记忆不存在，将在对话中自动建立",
        }
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "memory": {
            "id": memory.id,
            "user_id": memory.user_id,
            "goal_preferences": memory.goal_preferences,
            "language_style": memory.language_style,
            "learning_pace": memory.learning_pace,
            "topic_interests": memory.topic_interests,
            "user_profile": memory.user_profile,
            "updated_at": memory.updated_at.isoformat() if memory.updated_at else None,
        },
    }


@router.get("/user-profile/{user_id}")
async def get_user_profile(
    user_id: str,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    获取用户画像
    
    从长期记忆中提取的用户偏好信息
    """
    memory_service = get_memory_service()
    
    profile = await memory_service.long_term.get_user_profile(user_id, db)
    
    logger.info("user_profile.retrieved", user_id=user_id)
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "profile": profile,
    }


@router.post("/clear-expired")
async def clear_expired_memories(
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    清理过期的短期记忆
    
    手动触发过期记忆清理
    """
    memory_service = get_memory_service()
    
    await memory_service.short_term.clear_expired(db)
    
    logger.info("memory.expired_cleared")
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "message": "过期记忆已清理",
    }


@router.post("/update-long-term")
async def update_long_term_memory(
    user_id: str,
    session_summary: str,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    更新长期记忆
    
    从会话摘要中提取并更新用户偏好
    """
    memory_service = get_memory_service()
    
    await memory_service.long_term.update_from_session(
        user_id=user_id,
        session_summary=session_summary,
        db=db,
    )
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "message": "长期记忆已更新",
    }
