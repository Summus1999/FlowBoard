"""
日历服务
处理日历同步和事件管理
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from enum import Enum

from app.core.logging import get_logger

logger = get_logger(__name__)


class CalendarProvider(str, Enum):
    """日历提供商"""
    LOCAL = "local"
    GOOGLE = "google"
    OUTLOOK = "outlook"
    APPLE = "apple"


@dataclass
class CalendarEvent:
    """日历事件"""
    id: str
    title: str
    start_time: datetime
    end_time: datetime
    description: Optional[str] = None
    location: Optional[str] = None
    source: str = "flowboard"
    task_id: Optional[str] = None
    metadata: Dict[str, Any] = None


class CalendarService:
    """
    日历服务
    
    功能：
    1. 获取日历事件
    2. 创建日历事件
    3. 同步外部日历
    4. 时间冲突检测
    """
    
    def __init__(self):
        self._events: Dict[str, List[CalendarEvent]] = {}  # 内存存储，生产环境应使用数据库
    
    async def get_events(
        self,
        user_id: str,
        start_date: datetime,
        end_date: datetime,
    ) -> List[CalendarEvent]:
        """
        获取日历事件
        
        Args:
            user_id: 用户ID
            start_date: 开始日期
            end_date: 结束日期
        
        Returns:
            List[CalendarEvent]: 日历事件列表
        """
        user_events = self._events.get(user_id, [])
        
        # 过滤时间范围内的事件
        filtered = [
            event for event in user_events
            if event.start_time <= end_date and event.end_time >= start_date
        ]
        
        # 按时间排序
        filtered.sort(key=lambda e: e.start_time)
        
        logger.info(
            "calendar.events.retrieved",
            user_id=user_id,
            count=len(filtered),
        )
        
        return filtered
    
    async def create_event(
        self,
        user_id: str,
        event: CalendarEvent,
        provider: CalendarProvider = CalendarProvider.LOCAL,
    ) -> CalendarEvent:
        """
        创建日历事件
        
        Args:
            user_id: 用户ID
            event: 日历事件
            provider: 日历提供商
        
        Returns:
            CalendarEvent: 创建的事件
        """
        if user_id not in self._events:
            self._events[user_id] = []
        
        self._events[user_id].append(event)
        
        logger.info(
            "calendar.event.created",
            user_id=user_id,
            event_id=event.id,
            provider=provider.value,
        )
        
        return event
    
    async def update_event(
        self,
        user_id: str,
        event_id: str,
        updates: Dict[str, Any],
    ) -> Optional[CalendarEvent]:
        """
        更新日历事件
        
        Args:
            user_id: 用户ID
            event_id: 事件ID
            updates: 更新字段
        
        Returns:
            Optional[CalendarEvent]: 更新后的事件
        """
        user_events = self._events.get(user_id, [])
        
        for event in user_events:
            if event.id == event_id:
                if "title" in updates:
                    event.title = updates["title"]
                if "start_time" in updates:
                    event.start_time = updates["start_time"]
                if "end_time" in updates:
                    event.end_time = updates["end_time"]
                if "description" in updates:
                    event.description = updates["description"]
                if "location" in updates:
                    event.location = updates["location"]
                
                logger.info(
                    "calendar.event.updated",
                    user_id=user_id,
                    event_id=event_id,
                )
                
                return event
        
        return None
    
    async def delete_event(
        self,
        user_id: str,
        event_id: str,
    ) -> bool:
        """
        删除日历事件
        
        Args:
            user_id: 用户ID
            event_id: 事件ID
        
        Returns:
            bool: 是否删除成功
        """
        user_events = self._events.get(user_id, [])
        
        for i, event in enumerate(user_events):
            if event.id == event_id:
                del user_events[i]
                
                logger.info(
                    "calendar.event.deleted",
                    user_id=user_id,
                    event_id=event_id,
                )
                
                return True
        
        return False
    
    async def check_conflicts(
        self,
        user_id: str,
        start_time: datetime,
        end_time: datetime,
        exclude_event_id: Optional[str] = None,
    ) -> List[CalendarEvent]:
        """
        检查时间冲突
        
        Args:
            user_id: 用户ID
            start_time: 开始时间
            end_time: 结束时间
            exclude_event_id: 排除的事件ID
        
        Returns:
            List[CalendarEvent]: 冲突的事件列表
        """
        user_events = self._events.get(user_id, [])
        
        conflicts = []
        for event in user_events:
            if event.id == exclude_event_id:
                continue
            
            # 检查时间重叠
            if (event.start_time < end_time and event.end_time > start_time):
                conflicts.append(event)
        
        return conflicts
    
    async def sync_calendar(
        self,
        user_id: str,
        provider: CalendarProvider,
    ) -> bool:
        """
        同步外部日历
        
        Args:
            user_id: 用户ID
            provider: 日历提供商
        
        Returns:
            bool: 同步是否成功
        """
        # TODO: 实现实际的外部日历同步逻辑
        # 目前仅返回成功状态
        
        logger.info(
            "calendar.sync",
            user_id=user_id,
            provider=provider.value,
        )
        
        return True
    
    async def get_sync_status(self, user_id: str) -> Dict[str, Any]:
        """
        获取同步状态
        
        Args:
            user_id: 用户ID
        
        Returns:
            Dict[str, Any]: 同步状态
        """
        # TODO: 实现实际的同步状态查询
        
        return {
            "user_id": user_id,
            "providers": {
                "local": {"connected": True, "last_sync": datetime.now().isoformat()},
                "google": {"connected": False, "last_sync": None},
                "outlook": {"connected": False, "last_sync": None},
            },
        }
    
    async def create_event_from_task(
        self,
        user_id: str,
        task_id: str,
        task_title: str,
        suggested_time: datetime,
        duration_minutes: int = 60,
    ) -> CalendarEvent:
        """
        从任务创建日历事件
        
        Args:
            user_id: 用户ID
            task_id: 任务ID
            task_title: 任务标题
            suggested_time: 建议时间
            duration_minutes: 持续时间（分钟）
        
        Returns:
            CalendarEvent: 创建的事件
        """
        from uuid import uuid4
        
        end_time = suggested_time + timedelta(minutes=duration_minutes)
        
        event = CalendarEvent(
            id=str(uuid4()),
            title=f"[FlowBoard] {task_title}",
            start_time=suggested_time,
            end_time=end_time,
            description=f"FlowBoard任务: {task_title}",
            source="flowboard",
            task_id=task_id,
        )
        
        return await self.create_event(user_id, event)


# 全局服务实例
_calendar_service: Optional[CalendarService] = None


def get_calendar_service() -> CalendarService:
    """获取日历服务单例"""
    global _calendar_service
    if _calendar_service is None:
        _calendar_service = CalendarService()
    return _calendar_service
