"""
计划确认服务
实现人类在环确认流程
"""

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.exceptions import UnconfirmedRiskException
from app.models.plan import Plan, PlanVersion, PlanStatus

logger = get_logger(__name__)


class ConfirmationStatus(str, Enum):
    """确认状态"""
    PENDING = "pending"          # 待确认
    CONFIRMED = "confirmed"      # 已确认
    REJECTED = "rejected"        # 已拒绝
    EXPIRED = "expired"          # 已过期
    CANCELLED = "cancelled"      # 已取消


class ConfirmationType(str, Enum):
    """确认类型"""
    PLAN_CREATION = "plan_creation"      # 计划创建
    PLAN_UPDATE = "plan_update"          # 计划更新
    BATCH_TASK_UPDATE = "batch_task_update"  # 批量任务更新
    TASK_DELETE = "task_delete"          # 任务删除


@dataclass
class ConfirmationRequest:
    """确认请求"""
    confirmation_id: str
    plan_id: str
    confirmation_type: ConfirmationType
    title: str
    description: str
    impact_summary: str
    affected_items: List[Dict[str, Any]]
    undo_available: bool
    undo_window_minutes: int
    expires_at: datetime
    metadata: Dict[str, Any]


@dataclass
class ConfirmationResponse:
    """确认响应"""
    confirmation_id: str
    status: ConfirmationStatus
    plan_id: str
    confirmed_at: Optional[datetime]
    feedback: Optional[str]
    executed: bool


class ConfirmationService:
    """
    确认服务
    
    管理所有需要人类确认的高风险操作：
    1. 学习计划创建
    2. 计划覆盖更新
    3. 批量任务修改
    4. 删除操作
    """
    
    DEFAULT_UNDO_WINDOW = 30  # 默认30分钟可撤销
    DEFAULT_EXPIRY_MINUTES = 60  # 默认60分钟过期
    
    def __init__(self):
        self._pending_confirmations: Dict[str, ConfirmationRequest] = {}
    
    async def create_confirmation(
        self,
        plan_id: str,
        confirmation_type: ConfirmationType,
        title: str,
        description: str,
        impact_summary: str,
        affected_items: List[Dict[str, Any]],
        undo_window_minutes: int = None,
        metadata: Dict[str, Any] = None,
    ) -> ConfirmationRequest:
        """
        创建确认请求
        
        Args:
            plan_id: 计划ID
            confirmation_type: 确认类型
            title: 标题
            description: 描述
            impact_summary: 影响摘要
            affected_items: 影响的项目列表
            undo_window_minutes: 可撤销窗口（分钟）
            metadata: 元数据
        
        Returns:
            ConfirmationRequest: 确认请求
        """
        confirmation_id = str(uuid4())
        
        undo_window = undo_window_minutes or self.DEFAULT_UNDO_WINDOW
        expires_at = datetime.now() + timedelta(minutes=self.DEFAULT_EXPIRY_MINUTES)
        
        request = ConfirmationRequest(
            confirmation_id=confirmation_id,
            plan_id=plan_id,
            confirmation_type=confirmation_type,
            title=title,
            description=description,
            impact_summary=impact_summary,
            affected_items=affected_items,
            undo_available=True,
            undo_window_minutes=undo_window,
            expires_at=expires_at,
            metadata=metadata or {},
        )
        
        # 存储到内存（生产环境应使用Redis）
        self._pending_confirmations[confirmation_id] = request
        
        logger.info(
            "confirmation.created",
            confirmation_id=confirmation_id,
            plan_id=plan_id,
            type=confirmation_type.value,
        )
        
        return request
    
    async def confirm(
        self,
        confirmation_id: str,
        user_id: str,
        feedback: str = None,
        db: AsyncSession = None,
    ) -> ConfirmationResponse:
        """
        确认操作
        
        Args:
            confirmation_id: 确认ID
            user_id: 用户ID
            feedback: 反馈信息
            db: 数据库会话
        
        Returns:
            ConfirmationResponse: 确认响应
        """
        # 获取确认请求
        request = self._pending_confirmations.get(confirmation_id)
        
        if not request:
            raise UnconfirmedRiskException("确认请求不存在或已过期")
        
        # 检查是否过期
        if datetime.now() > request.expires_at:
            # 清理过期请求
            del self._pending_confirmations[confirmation_id]
            raise UnconfirmedRiskException("确认请求已过期")
        
        # 执行确认
        try:
            if db:
                await self._execute_confirmation(request, user_id, db)
            
            response = ConfirmationResponse(
                confirmation_id=confirmation_id,
                status=ConfirmationStatus.CONFIRMED,
                plan_id=request.plan_id,
                confirmed_at=datetime.now(),
                feedback=feedback,
                executed=True,
            )
            
            # 清理确认请求
            del self._pending_confirmations[confirmation_id]
            
            logger.info(
                "confirmation.confirmed",
                confirmation_id=confirmation_id,
                plan_id=request.plan_id,
            )
            
            return response
            
        except Exception as e:
            logger.error("confirmation.execution_failed", error=str(e))
            raise
    
    async def reject(
        self,
        confirmation_id: str,
        feedback: str = None,
    ) -> ConfirmationResponse:
        """
        拒绝操作
        
        Args:
            confirmation_id: 确认ID
            feedback: 拒绝原因
        
        Returns:
            ConfirmationResponse: 确认响应
        """
        request = self._pending_confirmations.get(confirmation_id)
        
        if not request:
            raise UnconfirmedRiskException("确认请求不存在或已过期")
        
        response = ConfirmationResponse(
            confirmation_id=confirmation_id,
            status=ConfirmationStatus.REJECTED,
            plan_id=request.plan_id,
            confirmed_at=None,
            feedback=feedback,
            executed=False,
        )
        
        # 清理确认请求
        del self._pending_confirmations[confirmation_id]
        
        logger.info(
            "confirmation.rejected",
            confirmation_id=confirmation_id,
            plan_id=request.plan_id,
            feedback=feedback,
        )
        
        return response
    
    async def undo(
        self,
        confirmation_id: str,
        db: AsyncSession,
    ) -> ConfirmationResponse:
        """
        撤销已确认的操作
        
        仅在undo_window内有效
        """
        # 这里应该从持久化存储中获取历史记录
        # 简化实现：暂时不支持撤销
        
        raise UnconfirmedRiskException(
            "撤销功能需要在数据库中维护操作历史",
            details={"confirmation_id": confirmation_id},
        )
    
    async def get_confirmation(
        self,
        confirmation_id: str,
    ) -> Optional[ConfirmationRequest]:
        """获取确认请求信息"""
        return self._pending_confirmations.get(confirmation_id)
    
    async def list_pending_confirmations(
        self,
        plan_id: str = None,
    ) -> List[ConfirmationRequest]:
        """获取待确认列表"""
        confirmations = list(self._pending_confirmations.values())
        
        if plan_id:
            confirmations = [c for c in confirmations if c.plan_id == plan_id]
        
        # 过滤过期的
        now = datetime.now()
        confirmations = [c for c in confirmations if c.expires_at > now]
        
        return confirmations
    
    async def _execute_confirmation(
        self,
        request: ConfirmationRequest,
        user_id: str,
        db: AsyncSession,
    ):
        """执行确认后的操作"""
        plan_id = request.plan_id
        
        if request.confirmation_type == ConfirmationType.PLAN_CREATION:
            # 更新计划状态为已确认
            result = await db.execute(
                select(Plan).where(Plan.id == plan_id)
            )
            plan = result.scalar_one_or_none()
            
            if plan:
                plan.status = PlanStatus.CONFIRMED.value
                
                # 更新版本确认状态
                result = await db.execute(
                    select(PlanVersion)
                    .where(PlanVersion.plan_id == plan_id)
                    .where(PlanVersion.version_no == plan.current_version)
                )
                version = result.scalar_one_or_none()
                if version:
                    version.confirmed_by_user = True
                    version.confirmed_at = datetime.now()
                
                await db.commit()
        
        elif request.confirmation_type == ConfirmationType.BATCH_TASK_UPDATE:
            # 执行批量任务更新
            pass
        
        elif request.confirmation_type == ConfirmationType.TASK_DELETE:
            # 执行删除
            pass
    
    def format_confirmation_prompt(
        self,
        request: ConfirmationRequest,
    ) -> str:
        """格式化确认提示"""
        lines = [
            f"## {request.title}",
            "",
            f"{request.description}",
            "",
            "### 影响范围",
            f"{request.impact_summary}",
            "",
            "### 涉及项目",
        ]
        
        for item in request.affected_items[:10]:  # 最多显示10项
            item_type = item.get("type", "项目")
            item_name = item.get("name", "未知")
            lines.append(f"- {item_type}: {item_name}")
        
        if len(request.affected_items) > 10:
            lines.append(f"- ... 还有 {len(request.affected_items) - 10} 项")
        
        lines.extend([
            "",
            f"⏰ 确认有效期: {request.expires_at.strftime('%Y-%m-%d %H:%M')}",
        ])
        
        if request.undo_available:
            lines.append(f"↩️ 撤销窗口: 确认后 {request.undo_window_minutes} 分钟内可撤销")
        
        lines.extend([
            "",
            "请输入 **yes** 确认执行，或 **no** 取消:",
        ])
        
        return "\n".join(lines)


class ProposalConfirmationBuilder:
    """提案确认构建器"""
    
    @staticmethod
    def build_for_plan_creation(
        plan_id: str,
        plan_title: str,
        milestones_count: int,
        tasks_count: int,
        estimated_duration: str,
        will_create_calendar_events: bool = False,
        will_create_todos: bool = False,
    ) -> Dict[str, Any]:
        """构建议划创建确认"""
        affected_items = [
            {"type": "里程碑", "name": f"共 {milestones_count} 个里程碑"},
            {"type": "任务", "name": f"共 {tasks_count} 个任务"},
        ]
        
        if will_create_calendar_events:
            affected_items.append({"type": "日历事件", "name": "将在日历中创建提醒"})
        
        if will_create_todos:
            affected_items.append({"type": "待办事项", "name": "将添加到待办列表"})
        
        return {
            "plan_id": plan_id,
            "confirmation_type": ConfirmationType.PLAN_CREATION,
            "title": f"确认创建学习计划: {plan_title}",
            "description": f"系统将为您创建一个完整的学习计划，预计周期为 {estimated_duration}。",
            "impact_summary": f"将创建 {milestones_count} 个里程碑和 {tasks_count} 个学习任务。",
            "affected_items": affected_items,
            "undo_window_minutes": 30,
        }
    
    @staticmethod
    def build_for_batch_task_update(
        plan_id: str,
        task_ids: List[str],
        update_type: str,  # "complete", "postpone", "priority"
    ) -> Dict[str, Any]:
        """构建批量任务更新确认"""
        affected_items = [
            {"type": "任务", "name": f"任务ID: {task_id}"}
            for task_id in task_ids[:5]
        ]
        
        if len(task_ids) > 5:
            affected_items.append({"type": "任务", "name": f"... 还有 {len(task_ids) - 5} 个任务"})
        
        update_desc = {
            "complete": "标记为已完成",
            "postpone": "推迟截止日期",
            "priority": "调整优先级",
        }.get(update_type, "更新")
        
        return {
            "plan_id": plan_id,
            "confirmation_type": ConfirmationType.BATCH_TASK_UPDATE,
            "title": f"确认批量{update_desc}任务",
            "description": f"您正在批量{update_desc} {len(task_ids)} 个任务。",
            "impact_summary": f"将同时修改 {len(task_ids)} 个任务的状态。",
            "affected_items": affected_items,
            "undo_window_minutes": 10,
        }
    
    @staticmethod
    def build_for_task_delete(
        plan_id: str,
        task_id: str,
        task_title: str,
    ) -> Dict[str, Any]:
        """构建任务删除确认"""
        return {
            "plan_id": plan_id,
            "confirmation_type": ConfirmationType.TASK_DELETE,
            "title": f"确认删除任务: {task_title}",
            "description": "此操作将永久删除该任务，相关进度数据也将被清除。",
            "impact_summary": "任务将被永久删除，不可恢复。",
            "affected_items": [{"type": "任务", "name": task_title}],
            "undo_window_minutes": 5,
        }


from datetime import timedelta

# 全局服务实例
_confirmation_service: Optional[ConfirmationService] = None


def get_confirmation_service() -> ConfirmationService:
    """获取确认服务单例"""
    global _confirmation_service
    if _confirmation_service is None:
        _confirmation_service = ConfirmationService()
    return _confirmation_service
