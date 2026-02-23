"""
工具集成服务
实现与Calendar、Todo等外部工具的集成
"""

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from enum import Enum

from app.core.logging import get_logger
from app.core.exceptions import ToolExecutionException

logger = get_logger(__name__)


class ToolType(str, Enum):
    """工具类型"""
    CALENDAR = "calendar"
    TODO = "todo"
    NOTE = "note"
    REMINDER = "reminder"


class ToolAction(str, Enum):
    """工具动作"""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    QUERY = "query"


@dataclass
class ToolResult:
    """工具执行结果"""
    success: bool
    tool_type: ToolType
    action: ToolAction
    external_id: Optional[str]  # 外部系统的ID
    message: str
    data: Optional[Dict[str, Any]] = None


@dataclass
class CalendarEvent:
    """日历事件"""
    title: str
    start_time: datetime
    end_time: datetime
    description: str = ""
    location: str = ""
    recurrence: Optional[str] = None  # RRULE格式
    reminders: List[int] = None  # 提前提醒分钟数
    external_id: Optional[str] = None


@dataclass
class TodoItem:
    """待办事项"""
    title: str
    description: str = ""
    due_date: Optional[datetime] = None
    priority: int = 1  # 1-5
    tags: List[str] = None
    external_id: Optional[str] = None


class BaseToolAdapter(ABC):
    """工具适配器基类"""
    
    tool_type: ToolType
    
    @abstractmethod
    async def create_event(self, event: CalendarEvent) -> ToolResult:
        """创建日历事件"""
        pass
    
    @abstractmethod
    async def create_todo(self, todo: TodoItem) -> ToolResult:
        """创建待办事项"""
        pass
    
    @abstractmethod
    async def update_event(self, external_id: str, updates: Dict) -> ToolResult:
        """更新事件"""
        pass
    
    @abstractmethod
    async def delete_event(self, external_id: str) -> ToolResult:
        """删除事件"""
        pass
    
    @abstractmethod
    async def health_check(self) -> bool:
        """健康检查"""
        pass


class MockCalendarAdapter(BaseToolAdapter):
    """
    Mock日历适配器
    
    用于开发和测试，实际项目中应替换为真实的日历API
    """
    
    tool_type = ToolType.CALENDAR
    
    def __init__(self):
        self._events: Dict[str, CalendarEvent] = {}
        self._todos: Dict[str, TodoItem] = {}
        self._id_counter = 0
    
    def _generate_id(self) -> str:
        """生成模拟ID"""
        self._id_counter += 1
        return f"mock_{self.tool_type.value}_{self._id_counter}"
    
    async def create_event(self, event: CalendarEvent) -> ToolResult:
        """创建日历事件（Mock）"""
        try:
            event_id = self._generate_id()
            event.external_id = event_id
            self._events[event_id] = event
            
            logger.info("mock_calendar.event_created", event_id=event_id, title=event.title)
            
            return ToolResult(
                success=True,
                tool_type=self.tool_type,
                action=ToolAction.CREATE,
                external_id=event_id,
                message=f"日历事件已创建: {event.title}",
                data={
                    "event_id": event_id,
                    "start_time": event.start_time.isoformat(),
                    "end_time": event.end_time.isoformat(),
                },
            )
        except Exception as e:
            logger.error("mock_calendar.create_failed", error=str(e))
            return ToolResult(
                success=False,
                tool_type=self.tool_type,
                action=ToolAction.CREATE,
                external_id=None,
                message=f"创建失败: {str(e)}",
            )
    
    async def create_todo(self, todo: TodoItem) -> ToolResult:
        """创建待办事项（Mock）"""
        try:
            todo_id = self._generate_id()
            todo.external_id = todo_id
            self._todos[todo_id] = todo
            
            logger.info("mock_calendar.todo_created", todo_id=todo_id, title=todo.title)
            
            return ToolResult(
                success=True,
                tool_type=ToolType.TODO,
                action=ToolAction.CREATE,
                external_id=todo_id,
                message=f"待办事项已创建: {todo.title}",
                data={
                    "todo_id": todo_id,
                    "due_date": todo.due_date.isoformat() if todo.due_date else None,
                },
            )
        except Exception as e:
            logger.error("mock_calendar.todo_failed", error=str(e))
            return ToolResult(
                success=False,
                tool_type=ToolType.TODO,
                action=ToolAction.CREATE,
                external_id=None,
                message=f"创建失败: {str(e)}",
            )
    
    async def update_event(self, external_id: str, updates: Dict) -> ToolResult:
        """更新事件"""
        if external_id not in self._events:
            return ToolResult(
                success=False,
                tool_type=self.tool_type,
                action=ToolAction.UPDATE,
                external_id=external_id,
                message="事件不存在",
            )
        
        event = self._events[external_id]
        for key, value in updates.items():
            if hasattr(event, key):
                setattr(event, key, value)
        
        return ToolResult(
            success=True,
            tool_type=self.tool_type,
            action=ToolAction.UPDATE,
            external_id=external_id,
            message="事件已更新",
        )
    
    async def delete_event(self, external_id: str) -> ToolResult:
        """删除事件"""
        if external_id in self._events:
            del self._events[external_id]
            return ToolResult(
                success=True,
                tool_type=self.tool_type,
                action=ToolAction.DELETE,
                external_id=external_id,
                message="事件已删除",
            )
        
        return ToolResult(
            success=False,
            tool_type=self.tool_type,
            action=ToolAction.DELETE,
            external_id=external_id,
            message="事件不存在",
        )
    
    async def health_check(self) -> bool:
        """健康检查"""
        return True


class ToolIntegrationService:
    """
    工具集成服务
    
    统一管理和协调各种外部工具
    """
    
    def __init__(self):
        self._adapters: Dict[ToolType, BaseToolAdapter] = {}
        self._register_default_adapters()
    
    def _register_default_adapters(self):
        """注册默认适配器"""
        self.register_adapter(ToolType.CALENDAR, MockCalendarAdapter())
        self.register_adapter(ToolType.TODO, MockCalendarAdapter())
    
    def register_adapter(self, tool_type: ToolType, adapter: BaseToolAdapter):
        """注册工具适配器"""
        self._adapters[tool_type] = adapter
        logger.info("tool.adapter_registered", tool_type=tool_type.value)
    
    def get_adapter(self, tool_type: ToolType) -> Optional[BaseToolAdapter]:
        """获取工具适配器"""
        return self._adapters.get(tool_type)
    
    async def create_calendar_event(
        self,
        title: str,
        start_time: datetime,
        end_time: datetime,
        description: str = "",
        reminders: List[int] = None,
    ) -> ToolResult:
        """创建日历事件"""
        adapter = self.get_adapter(ToolType.CALENDAR)
        if not adapter:
            raise ToolExecutionException("日历适配器未配置")
        
        event = CalendarEvent(
            title=title,
            start_time=start_time,
            end_time=end_time,
            description=description,
            reminders=reminders or [15],  # 默认提前15分钟提醒
        )
        
        return await adapter.create_event(event)
    
    async def create_todo(
        self,
        title: str,
        description: str = "",
        due_date: Optional[datetime] = None,
        priority: int = 1,
    ) -> ToolResult:
        """创建待办事项"""
        adapter = self.get_adapter(ToolType.TODO)
        if not adapter:
            raise ToolExecutionException("待办适配器未配置")
        
        todo = TodoItem(
            title=title,
            description=description,
            due_date=due_date,
            priority=priority,
        )
        
        return await adapter.create_todo(todo)
    
    async def batch_create_from_plan(
        self,
        plan_data: Dict[str, Any],
    ) -> List[ToolResult]:
        """
        根据计划批量创建日历事件和待办
        
        Args:
            plan_data: 计划数据，包含milestones和tasks
        
        Returns:
            工具执行结果列表
        """
        results = []
        
        milestones = plan_data.get("milestones", [])
        tasks = plan_data.get("tasks", [])
        
        # 为每个里程碑创建日历事件
        current_date = datetime.now()
        
        for i, milestone in enumerate(milestones):
            # 里程碑截止提醒
            milestone_date = current_date + timedelta(days=milestone.get("duration_days", 7) * (i + 1))
            
            result = await self.create_calendar_event(
                title=f"里程碑: {milestone.get('title', '')}",
                start_time=milestone_date,
                end_time=milestone_date + timedelta(hours=1),
                description=milestone.get('description', ''),
                reminders=[1440, 60],  # 提前1天和1小时提醒
            )
            results.append(result)
        
        # 为每个任务创建待办
        for task in tasks:
            result = await self.create_todo(
                title=task.get('title', ''),
                description=task.get('description', ''),
                priority=task.get('priority', 1),
            )
            results.append(result)
        
        logger.info(
            "tool.batch_create_complete",
            milestones=len(milestones),
            tasks=len(tasks),
            success_count=sum(1 for r in results if r.success),
        )
        
        return results
    
    async def health_check_all(self) -> Dict[ToolType, bool]:
        """检查所有工具的健康状态"""
        results = {}
        for tool_type, adapter in self._adapters.items():
            try:
                healthy = await adapter.health_check()
                results[tool_type] = healthy
            except Exception as e:
                logger.error("tool.health_check_failed", tool_type=tool_type.value, error=str(e))
                results[tool_type] = False
        return results


class SchedulerAgent:
    """
    调度器Agent
    
    协调计划执行和工具调用
    """
    
    def __init__(self):
        self.tool_service = ToolIntegrationService()
    
    async def execute_plan(
        self,
        plan_id: str,
        plan_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        执行计划
        
        创建日历事件和待办事项
        """
        logger.info("scheduler.execute_plan_start", plan_id=plan_id)
        
        # 批量创建
        results = await self.tool_service.batch_create_from_plan(plan_data)
        
        # 统计结果
        success_count = sum(1 for r in results if r.success)
        failed_count = len(results) - success_count
        
        # 收集外部ID
        calendar_ids = [
            r.external_id for r in results
            if r.success and r.tool_type == ToolType.CALENDAR
        ]
        todo_ids = [
            r.external_id for r in results
            if r.success and r.tool_type == ToolType.TODO
        ]
        
        logger.info(
            "scheduler.execute_plan_complete",
            plan_id=plan_id,
            success=success_count,
            failed=failed_count,
        )
        
        return {
            "plan_id": plan_id,
            "executed": True,
            "success_count": success_count,
            "failed_count": failed_count,
            "calendar_event_ids": calendar_ids,
            "todo_ids": todo_ids,
            "errors": [r.message for r in results if not r.success],
        }
    
    async def update_task_schedule(
        self,
        task_id: str,
        new_due_date: datetime,
    ) -> ToolResult:
        """更新任务日程"""
        # 更新待办事项的截止日期
        return await self.tool_service.create_todo(
            title=f"更新任务: {task_id}",
            due_date=new_due_date,
        )
    
    async def postpone_milestone(
        self,
        milestone_id: str,
        days: int,
    ) -> List[ToolResult]:
        """推迟里程碑"""
        # 更新相关日历事件
        results = []
        # 实际实现需要查询并更新相关事件
        return results


# 全局服务实例
_tool_service: Optional[ToolIntegrationService] = None
_scheduler_agent: Optional[SchedulerAgent] = None


def get_tool_service() -> ToolIntegrationService:
    """获取工具集成服务单例"""
    global _tool_service
    if _tool_service is None:
        _tool_service = ToolIntegrationService()
    return _tool_service


def get_scheduler_agent() -> SchedulerAgent:
    """获取调度器Agent单例"""
    global _scheduler_agent
    if _scheduler_agent is None:
        _scheduler_agent = SchedulerAgent()
    return _scheduler_agent
