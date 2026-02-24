"""
记忆服务
实现三层记忆体系的统一管理
"""

import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from enum import Enum

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.core.database import get_async_db_session
from app.models.memory import ShortTermMemory, LongTermMemory
from app.models.session import Message
from app.services.model_gateway import get_model_gateway, ModelProfile

logger = get_logger(__name__)


class MemoryLevel(str, Enum):
    """记忆层级"""
    SHORT_TERM = "short_term"    # 短期记忆（会话级）
    LONG_TERM = "long_term"      # 长期记忆（用户偏好）
    TASK = "task"                # 任务记忆


@dataclass
class MemoryEntry:
    """记忆条目"""
    key: str
    value: Any
    level: MemoryLevel
    timestamp: datetime
    importance: float  # 0-1
    context: Optional[Dict] = None


@dataclass
class ConversationSummary:
    """对话摘要"""
    session_id: str
    summary: str
    key_points: List[str]
    user_intents: List[str]
    extracted_facts: List[str]
    created_at: datetime


class ShortTermMemoryManager:
    """
    短期记忆管理器
    
    管理会话级的短期记忆
    - 最近N轮对话摘要
    - 关键约束和上下文
    """
    
    def __init__(self, max_rounds: int = 10):
        self.max_rounds = max_rounds
        self.model_gateway = get_model_gateway()
    
    async def get_memory(
        self,
        session_id: str,
        db: AsyncSession,
    ) -> Optional[ShortTermMemory]:
        """获取短期记忆"""
        result = await db.execute(
            select(ShortTermMemory)
            .where(ShortTermMemory.session_id == session_id)
        )
        return result.scalar_one_or_none()
    
    async def update_memory(
        self,
        session_id: str,
        messages: List[Message],
        db: AsyncSession,
    ) -> ShortTermMemory:
        """
        更新短期记忆
        
        基于最近的对话生成摘要
        """
        # 获取或创建记忆
        memory = await self.get_memory(session_id, db)
        if not memory:
            from uuid import uuid4
            memory = ShortTermMemory(
                id=str(uuid4()),
                session_id=session_id,
                conversation_summary="",
                key_constraints=[],
                window_size=self.max_rounds,
            )
            db.add(memory)
        
        # 生成新的摘要
        if messages:
            summary = await self._summarize_conversation(messages[-self.max_rounds:])
            memory.conversation_summary = summary
            
            # 提取关键约束
            constraints = await self._extract_constraints(messages[-self.max_rounds:])
            memory.key_constraints = constraints
        
        memory.expires_at = datetime.now() + timedelta(hours=24)
        
        await db.commit()
        await db.refresh(memory)
        
        return memory
    
    async def _summarize_conversation(self, messages: List[Message]) -> str:
        """生成对话摘要"""
        # 构建对话文本
        conversation = "\n".join([
            f"{msg.role}: {msg.content[:200]}..."
            for msg in messages[-5:]  # 最近5条
        ])
        
        prompt = f"""请简要总结以下对话的核心内容（100字以内）：

{conversation}

摘要："""
        
        try:
            response = await self.model_gateway.generate(
                messages=[{"role": "user", "content": prompt}],
                model_profile=ModelProfile.COST_EFFECTIVE,
                temperature=0.3,
            )
            return response.content[:200]
        except Exception as e:
            logger.error("conversation_summarization.failed", error=str(e))
            return "对话摘要生成失败"
    
    async def _extract_constraints(self, messages: List[Message]) -> List[str]:
        """提取关键约束"""
        # 从用户消息中提取约束条件
        constraints = []
        
        for msg in messages:
            if msg.role == "user":
                # 简单的关键词匹配
                content = msg.content.lower()
                
                if "必须" in content or "一定要" in content:
                    # 提取包含"必须"的句子
                    import re
                    matches = re.findall(r'[^。]*必须[^。]*。?', content)
                    constraints.extend(matches[:2])
        
        return constraints[:5]  # 最多5个约束
    
    async def clear_expired(self, db: AsyncSession):
        """清理过期的短期记忆"""
        result = await db.execute(
            select(ShortTermMemory)
            .where(ShortTermMemory.expires_at < datetime.now())
        )
        expired = result.scalars().all()
        
        for memory in expired:
            await db.delete(memory)
        
        await db.commit()
        
        logger.info("short_term_memory.cleared_expired", count=len(expired))


class LongTermMemoryManager:
    """
    长期记忆管理器
    
    管理用户级的长期偏好和画像
    - 学习目标偏好
    - 语言风格
    - 学习节奏
    - 领域兴趣
    """
    
    def __init__(self):
        self.model_gateway = get_model_gateway()
    
    async def get_memory(
        self,
        user_id: str,
        db: AsyncSession,
    ) -> Optional[LongTermMemory]:
        """获取长期记忆"""
        result = await db.execute(
            select(LongTermMemory)
            .where(LongTermMemory.user_id == user_id)
        )
        return result.scalar_one_or_none()
    
    async def update_from_session(
        self,
        user_id: str,
        session_summary: str,
        db: AsyncSession,
    ):
        """
        从会话摘要更新长期记忆
        
        异步提炼用户偏好
        """
        memory = await self.get_memory(user_id, db)
        
        if not memory:
            from uuid import uuid4
            memory = LongTermMemory(
                id=str(uuid4()),
                user_id=user_id,
                goal_preferences={},
                language_style=None,
                learning_pace=None,
                topic_interests=[],
                user_profile={},
            )
            db.add(memory)
        
        # 分析会话摘要，提取偏好
        preferences = await self._extract_preferences(session_summary)
        
        # 合并偏好（冲突解决策略）
        self._merge_preferences(memory, preferences)
        
        await db.commit()
        await db.refresh(memory)
        
        logger.info("long_term_memory.updated", user_id=user_id)
    
    async def _extract_preferences(self, summary: str) -> Dict[str, Any]:
        """从摘要中提取偏好"""
        prompt = f"""从以下对话摘要中提取用户偏好：

{summary}

请输出JSON格式：
{{
    "learning_pace": "fast/moderate/slow",
    "topic_interests": ["感兴趣的主题"],
    "language_style": "formal/casual/technical",
    "goal_preferences": {{
        "preferred_duration": "short/medium/long",
        "preferred_difficulty": "beginner/intermediate/advanced"
    }}
}}"""
        
        try:
            response = await self.model_gateway.generate(
                messages=[{"role": "user", "content": prompt}],
                model_profile=ModelProfile.COST_EFFECTIVE,
                temperature=0.3,
            )
            
            import re
            json_match = re.search(r'\{[^}]+\}', response.content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            
        except Exception as e:
            logger.error("preference_extraction.failed", error=str(e))
        
        return {}
    
    def _merge_preferences(
        self,
        memory: LongTermMemory,
        new_preferences: Dict[str, Any],
    ):
        """合并偏好（带冲突解决）"""
        # 学习节奏 - 取最新
        if "learning_pace" in new_preferences:
            memory.learning_pace = new_preferences["learning_pace"]
        
        # 主题兴趣 - 合并去重
        if "topic_interests" in new_preferences:
            existing = set(memory.topic_interests or [])
            new_topics = set(new_preferences["topic_interests"])
            memory.topic_interests = list(existing | new_topics)[:10]  # 最多10个
        
        # 语言风格 - 取最新
        if "language_style" in new_preferences:
            memory.language_style = new_preferences["language_style"]
        
        # 目标偏好 - 深度合并
        if "goal_preferences" in new_preferences:
            if not memory.goal_preferences:
                memory.goal_preferences = {}
            memory.goal_preferences.update(new_preferences["goal_preferences"])
    
    async def get_user_profile(self, user_id: str, db: AsyncSession) -> Dict[str, Any]:
        """获取用户画像"""
        memory = await self.get_memory(user_id, db)
        
        if not memory:
            return {}
        
        return {
            "learning_pace": memory.learning_pace,
            "topic_interests": memory.topic_interests,
            "language_style": memory.language_style,
            "goal_preferences": memory.goal_preferences,
        }


class TaskMemoryManager:
    """
    任务记忆管理器
    
    管理任务执行过程中的记忆
    - 任务状态历史
    - 执行日志
    - 遇到的问题和解决方案
    """
    
    def __init__(self):
        self._task_logs: Dict[str, List[Dict]] = {}  # 内存存储，生产环境应使用数据库
    
    async def log_task_event(
        self,
        task_id: str,
        event_type: str,
        data: Dict[str, Any],
    ):
        """记录任务事件"""
        if task_id not in self._task_logs:
            self._task_logs[task_id] = []
        
        self._task_logs[task_id].append({
            "timestamp": datetime.now().isoformat(),
            "event_type": event_type,
            "data": data,
        })
        
        logger.debug("task_memory.logged", task_id=task_id, event=event_type)
    
    async def get_task_history(self, task_id: str) -> List[Dict]:
        """获取任务历史"""
        return self._task_logs.get(task_id, [])
    
    async def get_task_lessons(self, task_id: str) -> List[str]:
        """获取任务经验教训"""
        logs = self._task_logs.get(task_id, [])
        
        # 从日志中提取问题和解决方案
        lessons = []
        
        for log in logs:
            if log["event_type"] == "problem_solved":
                problem = log["data"].get("problem", "")
                solution = log["data"].get("solution", "")
                if problem and solution:
                    lessons.append(f"{problem} -> {solution}")
        
        return lessons


class UnifiedMemoryService:
    """
    统一记忆服务
    
    协调三层记忆的管理和检索
    """
    
    def __init__(self):
        self.short_term = ShortTermMemoryManager()
        self.long_term = LongTermMemoryManager()
        self.task_memory = TaskMemoryManager()
    
    async def get_relevant_context(
        self,
        user_id: str,
        session_id: str,
        query: str,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        """
        获取相关记忆上下文
        
        根据查询整合三层记忆
        """
        context = {
            "short_term": None,
            "long_term": None,
            "task_memories": [],
        }
        
        # 1. 获取短期记忆
        st_memory = await self.short_term.get_memory(session_id, db)
        if st_memory:
            context["short_term"] = {
                "summary": st_memory.conversation_summary,
                "constraints": st_memory.key_constraints,
            }
        
        # 2. 获取长期记忆
        lt_memory = await self.long_term.get_memory(user_id, db)
        if lt_memory:
            context["long_term"] = {
                "learning_pace": lt_memory.learning_pace,
                "topic_interests": lt_memory.topic_interests,
                "language_style": lt_memory.language_style,
            }
        
        return context
    
    async def update_memories(
        self,
        user_id: str,
        session_id: str,
        messages: List[Message],
        db: AsyncSession,
    ):
        """
        更新所有相关记忆
        
        在对话结束后调用
        """
        # 1. 更新短期记忆
        await self.short_term.update_memory(session_id, messages, db)
        
        # 2. 异步更新长期记忆（可以放入后台任务）
        # 简化实现：直接更新
        st_memory = await self.short_term.get_memory(session_id, db)
        if st_memory:
            await self.long_term.update_from_session(
                user_id,
                st_memory.conversation_summary,
                db,
            )
        
        logger.info("memories.updated", user_id=user_id, session_id=session_id)
    
    async def format_context_for_prompt(
        self,
        context: Dict[str, Any],
    ) -> str:
        """将记忆格式化为Prompt上下文"""
        parts = []
        
        # 长期记忆
        if context.get("long_term"):
            lt = context["long_term"]
            if lt.get("learning_pace"):
                parts.append(f"用户学习节奏: {lt['learning_pace']}")
            if lt.get("topic_interests"):
                parts.append(f"感兴趣的主题: {', '.join(lt['topic_interests'][:3])}")
        
        # 短期记忆
        if context.get("short_term"):
            st = context["short_term"]
            if st.get("summary"):
                parts.append(f"近期对话摘要: {st['summary']}")
            if st.get("constraints"):
                parts.append(f"关键约束: {'; '.join(st['constraints'])}")
        
        return "\n".join(parts) if parts else ""


# 全局服务实例
_unified_memory: Optional[UnifiedMemoryService] = None


def get_memory_service() -> UnifiedMemoryService:
    """获取统一记忆服务单例"""
    global _unified_memory
    if _unified_memory is None:
        _unified_memory = UnifiedMemoryService()
    return _unified_memory
