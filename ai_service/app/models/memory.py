"""
记忆模型 - 短期记忆和长期记忆
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, ForeignKey, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB

from app.models.base import Base


class ShortTermMemory(Base):
    """短期记忆模型 - 会话级"""
    
    __tablename__ = "memory_short_term"
    
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    
    # 最近N轮对话摘要
    conversation_summary: Mapped[str] = mapped_column(Text, nullable=True)
    
    # 关键约束和上下文
    key_constraints: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    
    # 窗口大小（轮数）
    window_size: Mapped[int] = mapped_column(default=10)
    
    # 过期时间
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    __table_args__ = (
        Index("idx_st_memory_session", "session_id"),
        Index("idx_st_memory_expires", "expires_at"),
    )


class LongTermMemory(Base):
    """长期记忆模型 - 用户级偏好"""
    
    __tablename__ = "memory_long_term"
    
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, unique=True)
    
    # 用户目标偏好
    goal_preferences: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    
    # 语言风格偏好
    language_style: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    
    # 学习节奏偏好
    learning_pace: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    
    # 领域兴趣
    topic_interests: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    
    # 其他用户画像
    user_profile: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    
    # 最后更新来源会话
    last_updated_from_session: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    
    __table_args__ = (
        Index("idx_lt_memory_user", "user_id"),
    )
