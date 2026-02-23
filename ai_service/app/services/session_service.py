"""
会话服务
处理会话和消息的CRUD操作
"""

from typing import List, Optional
from datetime import datetime

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.session import Session, Message, SessionStatus, MessageRole

logger = get_logger(__name__)


class SessionService:
    """会话服务"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_session(
        self,
        user_id: str,
        title: Optional[str] = None,
        context: Optional[dict] = None,
    ) -> Session:
        """创建新会话"""
        from uuid import uuid4
        
        session = Session(
            id=str(uuid4()),
            user_id=user_id,
            title=title or "新会话",
            status=SessionStatus.ACTIVE.value,
            context=context,
        )
        
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        
        logger.info("session_service.created", session_id=session.id)
        return session
    
    async def get_session(self, session_id: str) -> Optional[Session]:
        """获取会话"""
        result = await self.db.execute(
            select(Session).where(Session.id == session_id)
        )
        return result.scalar_one_or_none()
    
    async def get_user_sessions(
        self,
        user_id: str,
        status: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> List[Session]:
        """获取用户的会话列表"""
        query = select(Session).where(Session.user_id == user_id)
        
        if status:
            query = query.where(Session.status == status)
        
        query = query.order_by(desc(Session.updated_at)).limit(limit).offset(offset)
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def add_message(
        self,
        session_id: str,
        role: MessageRole,
        content: str,
        metadata: Optional[dict] = None,
    ) -> Message:
        """添加消息"""
        from uuid import uuid4
        
        message = Message(
            id=str(uuid4()),
            session_id=session_id,
            role=role.value,
            content=content,
            metadata=metadata,
        )
        
        self.db.add(message)
        await self.db.commit()
        await self.db.refresh(message)
        
        return message
    
    async def get_messages(
        self,
        session_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Message]:
        """获取会话消息"""
        result = await self.db.execute(
            select(Message)
            .where(Message.session_id == session_id)
            .order_by(desc(Message.created_at))
            .limit(limit)
            .offset(offset)
        )
        return result.scalars().all()
    
    async def archive_session(self, session_id: str) -> bool:
        """归档会话"""
        session = await self.get_session(session_id)
        if not session:
            return False
        
        session.status = SessionStatus.ARCHIVED.value
        await self.db.commit()
        
        logger.info("session_service.archived", session_id=session_id)
        return True
