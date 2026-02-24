"""
通知API路由
处理通知管理
"""

from datetime import datetime, timedelta
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.api.deps import get_db, get_trace_id, get_request_id
from app.services.notification_service import (
    get_notification_service,
    NotificationType,
    NotificationPriority,
    NotificationChannel,
)

logger = get_logger(__name__)
router = APIRouter()


@router.get("/list")
async def get_notifications(
    user_id: str,
    unread_only: bool = False,
    notification_type: Optional[NotificationType] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    获取通知列表
    
    获取用户的通知列表
    
    - unread_only: 仅显示未读通知
    - notification_type: 按类型筛选
    """
    notification_service = get_notification_service()
    
    notifications = await notification_service.get_notifications(
        user_id=user_id,
        unread_only=unread_only,
        notification_type=notification_type,
        limit=limit,
        offset=offset,
        db=db,
    )
    
    # 获取未读数量
    unread_count = await notification_service.get_unread_count(user_id, db)
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "notifications": [
            {
                "id": n.id,
                "type": n.notification_type.value,
                "title": n.title,
                "content": n.content,
                "priority": n.priority.value,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else None,
                "action_url": n.action_url,
            }
            for n in notifications
        ],
        "unread_count": unread_count,
        "total": len(notifications),
    }


@router.post("/mark-read")
async def mark_notification_read(
    notification_id: str,
    user_id: str,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    标记通知为已读
    """
    notification_service = get_notification_service()
    
    success = await notification_service.mark_as_read(
        notification_id=notification_id,
        user_id=user_id,
        db=db,
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="通知不存在")
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "marked_as_read": True,
    }


@router.post("/mark-all-read")
async def mark_all_notifications_read(
    user_id: str,
    notification_type: Optional[NotificationType] = None,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    标记所有通知为已读
    
    - notification_type: 可选，仅标记指定类型的通知
    """
    notification_service = get_notification_service()
    
    count = await notification_service.mark_all_as_read(
        user_id=user_id,
        notification_type=notification_type,
        db=db,
    )
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "marked_count": count,
    }


@router.post("/dismiss")
async def dismiss_notification(
    notification_id: str,
    user_id: str,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    关闭/删除通知
    """
    notification_service = get_notification_service()
    
    success = await notification_service.dismiss_notification(
        notification_id=notification_id,
        user_id=user_id,
        db=db,
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="通知不存在")
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "dismissed": True,
    }


@router.get("/preferences")
async def get_notification_preferences(
    user_id: str,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    获取通知偏好设置
    """
    notification_service = get_notification_service()
    
    preferences = await notification_service.get_preferences(user_id, db)
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "preferences": preferences,
    }


@router.post("/preferences")
async def update_notification_preferences(
    user_id: str,
    preferences: dict,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    更新通知偏好设置
    """
    notification_service = get_notification_service()
    
    updated = await notification_service.update_preferences(
        user_id=user_id,
        preferences=preferences,
        db=db,
    )
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "updated": updated,
    }


@router.post("/send")
async def send_notification(
    user_id: str,
    notification_type: NotificationType,
    title: str,
    content: str,
    priority: NotificationPriority = NotificationPriority.MEDIUM,
    channels: List[NotificationChannel] = None,
    action_url: Optional[str] = None,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    发送通知
    
    手动发送通知（主要用于测试）
    """
    if channels is None:
        channels = [NotificationChannel.IN_APP]
    
    notification_service = get_notification_service()
    
    try:
        notification = await notification_service.send_notification(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            content=content,
            priority=priority,
            channels=channels,
            action_url=action_url,
            db=db,
        )
        
        logger.info(
            "notification.sent",
            user_id=user_id,
            notification_id=notification.id,
            type=notification_type.value,
        )
        
        return {
            "trace_id": trace_id,
            "request_id": request_id,
            "notification": {
                "id": notification.id,
                "type": notification.notification_type.value,
                "title": notification.title,
                "sent_at": notification.created_at.isoformat() if notification.created_at else None,
            },
        }
    except Exception as e:
        logger.error("notification.send_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"发送通知失败: {str(e)}")


@router.get("/unread-count")
async def get_unread_count(
    user_id: str,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    获取未读通知数量
    """
    notification_service = get_notification_service()
    
    count = await notification_service.get_unread_count(user_id, db)
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "unread_count": count,
    }
