"""
学习计划模型
"""

from datetime import datetime
from enum import Enum
from typing import Optional, List

from sqlalchemy import String, Text, ForeignKey, Integer, Boolean, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB

from app.models.base import Base


class PlanStatus(str, Enum):
    """计划状态"""
    DRAFT = "draft"           # 草稿
    PROPOSED = "proposed"     # 已提案待确认
    CONFIRMED = "confirmed"   # 已确认
    EXECUTING = "executing"   # 执行中
    PAUSED = "paused"         # 暂停
    COMPLETED = "completed"   # 已完成
    CANCELLED = "cancelled"   # 已取消


class Plan(Base):
    """学习计划主表"""
    
    __tablename__ = "plans"
    
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # 状态
    status: Mapped[str] = mapped_column(
        String(32),
        default=PlanStatus.DRAFT.value,
        nullable=False,
    )
    
    # 当前版本
    current_version: Mapped[int] = mapped_column(Integer, default=1)
    
    # 目标信息
    goal: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    target_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # 关联领域/标签
    tags: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    
    # 关系
    versions: Mapped[List["PlanVersion"]] = relationship(
        "PlanVersion",
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="PlanVersion.version_no.desc()",
    )
    tasks: Mapped[List["Task"]] = relationship(
        "Task",
        back_populates="plan",
        cascade="all, delete-orphan",
    )
    
    __table_args__ = (
        Index("idx_plans_user_status", "user_id", "status"),
    )
    
    def __repr__(self) -> str:
        return f"<Plan(id={self.id}, title={self.title}, status={self.status})>"


class PlanVersion(Base):
    """计划版本表"""
    
    __tablename__ = "plan_versions"
    
    plan_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # 内容
    content_md: Mapped[str] = mapped_column(Text, nullable=False)
    content_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    
    # 变更摘要
    change_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # 确认状态
    confirmed_by_user: Mapped[bool] = mapped_column(Boolean, default=False)
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # 创建信息
    created_by_agent: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    
    # 关系
    plan: Mapped["Plan"] = relationship("Plan", back_populates="versions")
    
    __table_args__ = (
        Index("idx_plan_versions_plan_version", "plan_id", "version_no", unique=True),
    )


class TaskStatus(str, Enum):
    """任务状态"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Task(Base):
    """任务主表"""
    
    __tablename__ = "tasks"
    
    plan_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # 状态
    status: Mapped[str] = mapped_column(
        String(32),
        default=TaskStatus.PENDING.value,
        nullable=False,
    )
    
    # 优先级
    priority: Mapped[int] = mapped_column(Integer, default=1)
    
    # 时间安排
    scheduled_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    scheduled_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # 实际完成时间
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # 父任务（支持层级）
    parent_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
    )
    
    # 关联日历事件ID
    calendar_event_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    
    # 关联待办ID
    todo_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    
    # 额外元数据
    metadata: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    
    # 关系
    plan: Mapped["Plan"] = relationship("Plan", back_populates="tasks")
    
    __table_args__ = (
        Index("idx_tasks_plan_status", "plan_id", "status"),
        Index("idx_tasks_scheduled", "scheduled_start", "scheduled_end"),
    )
