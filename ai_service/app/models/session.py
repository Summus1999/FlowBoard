"""
会话和消息模型
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional

from sqlalchemy import String, Text, ForeignKey, Integer, Boolean, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.models.base import Base


class SessionStatus(str, Enum):
    """会话状态"""
    ACTIVE = "active"
    ARCHIVED = "archived"
    DELETED = "deleted"


class MessageRole(str, Enum):
    """消息角色"""
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


class Session(Base):
    """会话模型"""
    
    __tablename__ = "sessions"
    
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(
        String(32),
        default=SessionStatus.ACTIVE.value,
        nullable=False,
    )
    context: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    
    # 关系
    messages: Mapped[List["Message"]] = relationship(
        "Message",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )
    
    def __repr__(self) -> str:
        return f"<Session(id={self.id}, user_id={self.user_id}, title={self.title})>"


class Message(Base):
    """消息模型"""
    
    __tablename__ = "messages"
    
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    
    # 工具调用相关
    tool_calls: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    tool_call_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    
    # Token统计
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    
    # 元数据
    metadata: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    
    # 关系
    session: Mapped["Session"] = relationship("Session", back_populates="messages")
    
    # 索引
    __table_args__ = (
        Index("idx_messages_session_created", "session_id", "created_at"),
    )
    
    def __repr__(self) -> str:
        return f"<Message(id={self.id}, session_id={self.session_id}, role={self.role})>"
