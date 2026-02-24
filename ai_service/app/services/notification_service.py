"""
通知服务
处理通知的管理和发送
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from enum import Enum

from sqlalchemy import select, and_, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger

logger = get_logger(__name__)


class NotificationType(str, Enum):
    """通知类型"""
    TASK_REMINDER = "task_reminder"        # 任务提醒
    PLAN_UPDATE = "plan_update"            # 计划更新
    REVIEW_READY = "review_ready"          # 复盘就绪
    CONFIRMATION_REQUIRED = "confirmation_required"  # 需要确认
    SYSTEM = "system"                      # 系统通知
    ACHIEVEMENT = "achievement"            # 成就通知


class NotificationPriority(str, Enum):
    """通知优先级"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class NotificationChannel(str, Enum):
    """通知渠道"""
    IN_APP = "in_app"          # 应用内
    EMAIL = "email"            # 邮件
    PUSH = "push"              # 推送
    SMS = "sms"                # 短信


@dataclass
class Notification:
    """通知"""
    id: str
    user_id: str
    notification_type: NotificationType
    title: str
    content: str
    priority: NotificationPriority
    is_read: bool = False
    created_at: Optional[datetime] = None
    action_url: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class NotificationService:
    """
    通知服务
    
    功能：
    1. 管理通知的创建、读取、删除
    2. 支持多种通知类型和优先级
    3. 多渠道通知发送
    4. 通知偏好管理
    """
    
    def __init__(self):
        self._notifications: Dict[str, List[Notification]] = {}  # 内存存储
        self._preferences: Dict[str, Dict] = {}
    
    async def send_notification(
        self,
        user_id: str,
        notification_type: NotificationType,
        title: str,
        content: str,
        priority: NotificationPriority = NotificationPriority.MEDIUM,
        channels: List[NotificationChannel] = None,
        action_url: Optional[str] = None,
        db: AsyncSession = None,
    ) -> Notification:
        """
        发送通知
        
        Args:
            user_id: 用户ID
            notification_type: 通知类型
            title: 标题
            content: 内容
            priority: 优先级
            channels: 通知渠道
            action_url: 操作链接
        
        Returns:
            Notification: 创建的通知
        """
        if channels is None:
            channels = [NotificationChannel.IN_APP]
        
        from uuid import uuid4
        
        notification = Notification(
            id=str(uuid4()),
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            content=content,
            priority=priority,
            created_at=datetime.now(),
            action_url=action_url,
        )
        
        if user_id not in self._notifications:
            self._notifications[user_id] = []
        
        self._notifications[user_id].append(notification)
        
        # 根据渠道发送
        for channel in channels:
            await self._send_by_channel(notification, channel)
        
        logger.info(
            "notification.sent",
            user_id=user_id,
            notification_id=notification.id,
            type=notification_type.value,
        )
        
        return notification
    
    async def _send_by_channel(
        self,
        notification: Notification,
        channel: NotificationChannel,
    ):
        """通过指定渠道发送通知"""
        if channel == NotificationChannel.IN_APP:
            # 应用内通知，已存储
            pass
        elif channel == NotificationChannel.EMAIL:
            # TODO: 实现邮件发送
            logger.info("notification.email.sent", notification_id=notification.id)
        elif channel == NotificationChannel.PUSH:
            # TODO: 实现推送发送
            logger.info("notification.push.sent", notification_id=notification.id)
        elif channel == NotificationChannel.SMS:
            # TODO: 实现短信发送
            logger.info("notification.sms.sent", notification_id=notification.id)
    
    async def get_notifications(
        self,
        user_id: str,
        unread_only: bool = False,
        notification_type: Optional[NotificationType] = None,
        limit: int = 20,
        offset: int = 0,
        db: AsyncSession = None,
    ) -> List[Notification]:
        """
        获取通知列表
        
        Args:
            user_id: 用户ID
            unread_only: 仅未读
            notification_type: 类型筛选
            limit: 数量限制
            offset: 偏移量
        
        Returns:
            List[Notification]: 通知列表
        """
        notifications = self._notifications.get(user_id, [])
        
        # 筛选
        if unread_only:
            notifications = [n for n in notifications if not n.is_read]
        
        if notification_type:
            notifications = [n for n in notifications if n.notification_type == notification_type]
        
        # 排序（最新的在前）
        notifications.sort(key=lambda n: n.created_at or datetime.min, reverse=True)
        
        # 分页
        return notifications[offset:offset + limit]
    
    async def mark_as_read(
        self,
        notification_id: str,
        user_id: str,
        db: AsyncSession = None,
    ) -> bool:
        """
        标记通知为已读
        
        Args:
            notification_id: 通知ID
            user_id: 用户ID
        
        Returns:
            bool: 是否成功
        """
        notifications = self._notifications.get(user_id, [])
        
        for notification in notifications:
            if notification.id == notification_id:
                notification.is_read = True
                logger.info("notification.marked_read", notification_id=notification_id)
                return True
        
        return False
    
    async def mark_all_as_read(
        self,
        user_id: str,
        notification_type: Optional[NotificationType] = None,
        db: AsyncSession = None,
    ) -> int:
        """
        标记所有通知为已读
        
        Args:
            user_id: 用户ID
            notification_type: 可选的类型筛选
        
        Returns:
            int: 标记的数量
        """
        notifications = self._notifications.get(user_id, [])
        
        count = 0
        for notification in notifications:
            if notification_type and notification.notification_type != notification_type:
                continue
            if not notification.is_read:
                notification.is_read = True
                count += 1
        
        logger.info("notification.all_marked_read", user_id=user_id, count=count)
        
        return count
    
    async def dismiss_notification(
        self,
        notification_id: str,
        user_id: str,
        db: AsyncSession = None,
    ) -> bool:
        """
        关闭/删除通知
        
        Args:
            notification_id: 通知ID
            user_id: 用户ID
        
        Returns:
            bool: 是否成功
        """
        notifications = self._notifications.get(user_id, [])
        
        for i, notification in enumerate(notifications):
            if notification.id == notification_id:
                del notifications[i]
                logger.info("notification.dismissed", notification_id=notification_id)
                return True
        
        return False
    
    async def get_unread_count(
        self,
        user_id: str,
        db: AsyncSession = None,
    ) -> int:
        """
        获取未读通知数量
        
        Args:
            user_id: 用户ID
        
        Returns:
            int: 未读数量
        """
        notifications = self._notifications.get(user_id, [])
        return sum(1 for n in notifications if not n.is_read)
    
    async def get_preferences(self, user_id: str, db: AsyncSession = None) -> Dict[str, Any]:
        """
        获取通知偏好
        
        Args:
            user_id: 用户ID
        
        Returns:
            Dict[str, Any]: 偏好设置
        """
        return self._preferences.get(user_id, self._get_default_preferences())
    
    async def update_preferences(
        self,
        user_id: str,
        preferences: Dict[str, Any],
        db: AsyncSession = None,
    ) -> Dict[str, Any]:
        """
        更新通知偏好
        
        Args:
            user_id: 用户ID
            preferences: 偏好设置
        
        Returns:
            Dict[str, Any]: 更新后的偏好
        """
        self._preferences[user_id] = preferences
        logger.info("notification.preferences.updated", user_id=user_id)
        return preferences
    
    def _get_default_preferences(self) -> Dict[str, Any]:
        """获取默认偏好设置"""
        return {
            "task_reminder": {
                "enabled": True,
                "channels": ["in_app", "push"],
                "advance_minutes": 15,
            },
            "plan_update": {
                "enabled": True,
                "channels": ["in_app"],
            },
            "review_ready": {
                "enabled": True,
                "channels": ["in_app", "email"],
            },
            "confirmation_required": {
                "enabled": True,
                "channels": ["in_app", "push", "email"],
            },
            "system": {
                "enabled": True,
                "channels": ["in_app"],
            },
            "achievement": {
                "enabled": True,
                "channels": ["in_app", "push"],
            },
        }
    
    async def create_task_reminder(
        self,
        user_id: str,
        task_id: str,
        task_title: str,
        reminder_time: datetime,
    ) -> Notification:
        """
        创建任务提醒通知
        
        Args:
            user_id: 用户ID
            task_id: 任务ID
            task_title: 任务标题
            reminder_time: 提醒时间
        
        Returns:
            Notification: 创建的通知
        """
        return await self.send_notification(
            user_id=user_id,
            notification_type=NotificationType.TASK_REMINDER,
            title=f"任务提醒: {task_title}",
            content=f"您有一个任务即将开始: {task_title}",
            priority=NotificationPriority.MEDIUM,
            action_url=f"/tasks/{task_id}",
        )
    
    async def create_review_notification(
        self,
        user_id: str,
        review_id: str,
        period: str,
    ) -> Notification:
        """
        创建复盘就绪通知
        
        Args:
            user_id: 用户ID
            review_id: 复盘ID
            period: 复盘周期
        
        Returns:
            Notification: 创建的通知
        """
        return await self.send_notification(
            user_id=user_id,
            notification_type=NotificationType.REVIEW_READY,
            title=f"您的{period}复盘已生成",
            content=f"点击查看您的学习进度复盘报告",
            priority=NotificationPriority.MEDIUM,
            action_url=f"/review/{review_id}",
        )


# 全局服务实例
_notification_service: Optional[NotificationService] = None


def get_notification_service() -> NotificationService:
    """获取通知服务单例"""
    global _notification_service
    if _notification_service is None:
        _notification_service = NotificationService()
    return _notification_service
