"""
任务拆解服务
增强的Decomposer Agent，支持可执行任务生成和依赖管理
"""

import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import List, Optional, Dict, Any, Set
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from langchain_core.messages import SystemMessage, HumanMessage

from app.core.config import settings
from app.core.logging import get_logger
from app.services.model_gateway import get_model_gateway, ModelProfile
from app.models.plan import Task, TaskStatus

logger = get_logger(__name__)


class TaskComplexity(str, Enum):
    """任务复杂度"""
    SIMPLE = "simple"       # 简单任务（< 2小时）
    MEDIUM = "medium"       # 中等任务（2-8小时）
    COMPLEX = "complex"     # 复杂任务（> 8小时，需拆解）


@dataclass
class SubTask:
    """子任务"""
    id: str
    title: str
    description: str
    estimated_minutes: int
    complexity: TaskComplexity
    dependencies: List[str]  # 依赖的子任务ID
    resources: List[str]
    checklist: List[str]     # 完成检查项
    parent_task_id: Optional[str] = None


@dataclass
class DecomposedTask:
    """拆解后的任务"""
    original_task: str
    subtasks: List[SubTask]
    total_estimated_minutes: int
    critical_path: List[str]  # 关键路径上的任务ID
    parallel_groups: List[List[str]]  # 可并行执行的任务组
    risk_factors: List[str]


@dataclass
class TaskCheckpoint:
    """任务检查点"""
    checkpoint_id: str
    task_id: str
    state: Dict[str, Any]
    progress_percent: float
    created_at: datetime
    notes: Optional[str] = None


class TaskStateMachine:
    """
    任务状态机
    
    状态流转：
    PENDING -> IN_PROGRESS -> [COMPLETED | FAILED]
           -> BLOCKED -> IN_PROGRESS
           -> PAUSED -> IN_PROGRESS
    """
    
    VALID_TRANSITIONS = {
        TaskStatus.PENDING: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
        TaskStatus.IN_PROGRESS: [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.PAUSED, TaskStatus.BLOCKED],
        TaskStatus.BLOCKED: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
        TaskStatus.PAUSED: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
        TaskStatus.FAILED: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
        TaskStatus.COMPLETED: [],
        TaskStatus.CANCELLED: [],
    }
    
    @classmethod
    def can_transition(cls, from_status: TaskStatus, to_status: TaskStatus) -> bool:
        """检查状态转换是否有效"""
        return to_status in cls.VALID_TRANSITIONS.get(from_status, [])
    
    @classmethod
    def get_valid_transitions(cls, status: TaskStatus) -> List[TaskStatus]:
        """获取有效的状态转换"""
        return cls.VALID_TRANSITIONS.get(status, [])


class DecomposerAgent:
    """
    增强的任务拆解Agent
    
    功能：
    1. 智能任务复杂度评估
    2. 自动拆解复杂任务
    3. 依赖关系分析
    4. 关键路径计算
    5. 并行任务分组
    """
    
    def __init__(self):
        self.model_gateway = get_model_gateway()
        self.simple_threshold = 120    # 2小时
        self.medium_threshold = 480    # 8小时
    
    async def analyze_and_decompose(
        self,
        task_title: str,
        task_description: str,
        estimated_hours: float,
        context: Optional[Dict] = None,
    ) -> DecomposedTask:
        """
        分析并拆解任务
        
        Args:
            task_title: 任务标题
            task_description: 任务描述
            estimated_hours: 预估小时数
            context: 上下文信息
        
        Returns:
            DecomposedTask: 拆解后的任务结构
        """
        # 1. 评估复杂度
        complexity = self._assess_complexity(estimated_hours)
        
        if complexity == TaskComplexity.SIMPLE:
            # 简单任务，不需要拆解
            return self._create_simple_task(task_title, task_description, estimated_hours)
        
        # 2. 拆解任务
        logger.info("decomposer.start", task=task_title, complexity=complexity.value)
        
        subtasks = await self._decompose_with_llm(
            task_title, task_description, estimated_hours, complexity
        )
        
        # 3. 分析依赖关系
        subtasks = self._analyze_dependencies(subtasks)
        
        # 4. 计算关键路径
        critical_path = self._calculate_critical_path(subtasks)
        
        # 5. 分组并行任务
        parallel_groups = self._group_parallel_tasks(subtasks)
        
        # 6. 评估风险
        risk_factors = self._assess_risks(subtasks, estimated_hours)
        
        total_minutes = sum(st.estimated_minutes for st in subtasks)
        
        decomposed = DecomposedTask(
            original_task=task_title,
            subtasks=subtasks,
            total_estimated_minutes=total_minutes,
            critical_path=critical_path,
            parallel_groups=parallel_groups,
            risk_factors=risk_factors,
        )
        
        logger.info(
            "decomposer.complete",
            task=task_title,
            subtask_count=len(subtasks),
            critical_path_length=len(critical_path),
        )
        
        return decomposed
    
    def _assess_complexity(self, estimated_hours: float) -> TaskComplexity:
        """评估任务复杂度"""
        estimated_minutes = estimated_hours * 60
        
        if estimated_minutes <= self.simple_threshold:
            return TaskComplexity.SIMPLE
        elif estimated_minutes <= self.medium_threshold:
            return TaskComplexity.MEDIUM
        else:
            return TaskComplexity.COMPLEX
    
    def _create_simple_task(
        self,
        title: str,
        description: str,
        estimated_hours: float,
    ) -> DecomposedTask:
        """创建简单任务（无需拆解）"""
        subtask = SubTask(
            id=str(uuid4()),
            title=title,
            description=description,
            estimated_minutes=int(estimated_hours * 60),
            complexity=TaskComplexity.SIMPLE,
            dependencies=[],
            resources=[],
            checklist=["完成任务"],
        )
        
        return DecomposedTask(
            original_task=title,
            subtasks=[subtask],
            total_estimated_minutes=subtask.estimated_minutes,
            critical_path=[subtask.id],
            parallel_groups=[[subtask.id]],
            risk_factors=[],
        )
    
    async def _decompose_with_llm(
        self,
        task_title: str,
        task_description: str,
        estimated_hours: float,
        complexity: TaskComplexity,
    ) -> List[SubTask]:
        """使用LLM拆解任务"""
        prompt = f"""请将以下任务拆解为可执行的子任务。

任务：{task_title}
描述：{task_description}
预估总时间：{estimated_hours}小时
复杂度：{complexity.value}

要求：
1. 每个子任务应在30分钟到4小时之间
2. 子任务之间应有明确的依赖关系
3. 包含完成检查项
4. 推荐学习资源

请输出JSON格式：
[
    {{
        "title": "子任务标题",
        "description": "详细描述",
        "estimated_minutes": 60,
        "dependencies": [],  // 依赖的其他子任务标题
        "resources": ["推荐资源"],
        "checklist": ["检查项1", "检查项2"]
    }}
]"""
        
        try:
            response = await self.model_gateway.generate(
                messages=[HumanMessage(content=prompt)],
                model_profile=ModelProfile.BALANCED,
                temperature=0.3,
            )
            
            # 解析JSON
            content = response.content
            json_match = re.search(r'\[[^\]]+\]', content, re.DOTALL)
            
            if json_match:
                data = json.loads(json_match.group())
                subtasks = []
                
                for i, item in enumerate(data):
                    subtask = SubTask(
                        id=str(uuid4()),
                        title=item["title"],
                        description=item["description"],
                        estimated_minutes=item["estimated_minutes"],
                        complexity=self._assess_complexity(item["estimated_minutes"] / 60),
                        dependencies=[],  # 稍后解析
                        resources=item.get("resources", []),
                        checklist=item.get("checklist", []),
                    )
                    subtasks.append(subtask)
                
                # 解析依赖关系（将标题映射到ID）
                title_to_id = {st.title: st.id for st in subtasks}
                for i, item in enumerate(data):
                    dep_titles = item.get("dependencies", [])
                    subtasks[i].dependencies = [
                        title_to_id[dt] for dt in dep_titles if dt in title_to_id
                    ]
                
                return subtasks
                
        except Exception as e:
            logger.error("decomposer.llm_failed", error=str(e))
        
        # 回退：创建默认子任务
        return self._create_default_subtasks(task_title, task_description, estimated_hours)
    
    def _create_default_subtasks(
        self,
        title: str,
        description: str,
        estimated_hours: float,
    ) -> List[SubTask]:
        """创建默认子任务（LLM失败时使用）"""
        # 将任务拆分为3-5个子任务
        subtask_count = min(max(int(estimated_hours / 4), 3), 5)
        minutes_per_task = int(estimated_hours * 60 / subtask_count)
        
        subtasks = []
        for i in range(subtask_count):
            subtask = SubTask(
                id=str(uuid4()),
                title=f"{title} - 阶段 {i+1}",
                description=f"第{i+1}阶段：{description[:50]}...",
                estimated_minutes=minutes_per_task,
                complexity=TaskComplexity.MEDIUM,
                dependencies=[subtasks[-1].id] if subtasks else [],
                resources=[],
                checklist=["开始阶段", "完成阶段"],
            )
            subtasks.append(subtask)
        
        return subtasks
    
    def _analyze_dependencies(self, subtasks: List[SubTask]) -> List[SubTask]:
        """分析并验证依赖关系"""
        # 检查循环依赖
        task_ids = {st.id for st in subtasks}
        
        for subtask in subtasks:
            # 过滤不存在的依赖
            subtask.dependencies = [d for d in subtask.dependencies if d in task_ids]
        
        return subtasks
    
    def _calculate_critical_path(self, subtasks: List[SubTask]) -> List[str]:
        """计算关键路径（简化版）"""
        # 构建图
        graph = {st.id: st for st in subtasks}
        
        # 计算每个任务的最早开始时间和最晚开始时间
        # 简化处理：返回最长依赖链
        
        def get_path_length(task_id: str, visited: Set[str]) -> int:
            if task_id in visited:
                return 0
            visited.add(task_id)
            
            task = graph.get(task_id)
            if not task or not task.dependencies:
                return task.estimated_minutes if task else 0
            
            max_dep_length = max(
                get_path_length(dep, visited.copy()) for dep in task.dependencies
            )
            return max_dep_length + task.estimated_minutes
        
        # 找到最长的路径
        longest_path = []
        max_length = 0
        
        for subtask in subtasks:
            visited = set()
            length = get_path_length(subtask.id, visited)
            if length > max_length:
                max_length = length
                longest_path = list(visited)
        
        return longest_path
    
    def _group_parallel_tasks(self, subtasks: List[SubTask]) -> List[List[str]]:
        """分组可并行执行的任务"""
        # 使用拓扑排序的思想
        groups = []
        completed = set()
        remaining = {st.id for st in subtasks}
        
        task_map = {st.id: st for st in subtasks}
        
        while remaining:
            # 找出当前可以执行的任务（所有依赖已完成）
            can_execute = []
            for task_id in remaining:
                task = task_map[task_id]
                if all(dep in completed for dep in task.dependencies):
                    can_execute.append(task_id)
            
            if not can_execute:
                # 有循环依赖，打破循环
                can_execute = [remaining.pop()]
            else:
                for task_id in can_execute:
                    remaining.remove(task_id)
            
            groups.append(can_execute)
            completed.update(can_execute)
        
        return groups
    
    def _assess_risks(
        self,
        subtasks: List[SubTask],
        original_estimated_hours: float,
    ) -> List[str]:
        """评估风险"""
        risks = []
        
        # 检查总时间
        total_minutes = sum(st.estimated_minutes for st in subtasks)
        estimated_minutes = original_estimated_hours * 60
        
        if total_minutes > estimated_minutes * 1.3:
            risks.append("拆解后总时间超出原预估30%，可能需要调整时间安排")
        
        # 检查依赖深度
        if len(subtasks) > 10:
            risks.append("子任务数量较多，建议分阶段执行")
        
        # 检查复杂子任务
        complex_count = sum(1 for st in subtasks if st.complexity == TaskComplexity.COMPLEX)
        if complex_count > 0:
            risks.append(f"包含{complex_count}个复杂子任务，可能需要进一步拆解")
        
        return risks


class ResumableTaskManager:
    """
    可恢复任务管理器
    
    管理任务的执行状态、检查点和恢复
    """
    
    def __init__(self):
        self._checkpoints: Dict[str, List[TaskCheckpoint]] = {}
    
    async def create_checkpoint(
        self,
        task_id: str,
        state: Dict[str, Any],
        progress_percent: float,
        notes: str = None,
    ) -> TaskCheckpoint:
        """创建任务检查点"""
        checkpoint = TaskCheckpoint(
            checkpoint_id=str(uuid4()),
            task_id=task_id,
            state=state,
            progress_percent=progress_percent,
            created_at=datetime.now(),
            notes=notes,
        )
        
        if task_id not in self._checkpoints:
            self._checkpoints[task_id] = []
        
        self._checkpoints[task_id].append(checkpoint)
        
        logger.info(
            "task.checkpoint_created",
            task_id=task_id,
            checkpoint_id=checkpoint.checkpoint_id,
            progress=progress_percent,
        )
        
        return checkpoint
    
    async def get_latest_checkpoint(
        self,
        task_id: str,
    ) -> Optional[TaskCheckpoint]:
        """获取最新的检查点"""
        checkpoints = self._checkpoints.get(task_id, [])
        return checkpoints[-1] if checkpoints else None
    
    async def get_checkpoint_history(
        self,
        task_id: str,
    ) -> List[TaskCheckpoint]:
        """获取检查点历史"""
        return self._checkpoints.get(task_id, [])
    
    async def resume_from_checkpoint(
        self,
        task_id: str,
        checkpoint_id: str = None,
    ) -> Optional[TaskCheckpoint]:
        """
        从检查点恢复任务
        
        Args:
            task_id: 任务ID
            checkpoint_id: 检查点ID（None则使用最新）
        
        Returns:
            恢复的检查点
        """
        if checkpoint_id:
            # 查找指定检查点
            checkpoints = self._checkpoints.get(task_id, [])
            for cp in checkpoints:
                if cp.checkpoint_id == checkpoint_id:
                    logger.info("task.resumed", task_id=task_id, checkpoint_id=checkpoint_id)
                    return cp
        else:
            # 使用最新检查点
            cp = await self.get_latest_checkpoint(task_id)
            if cp:
                logger.info("task.resumed_from_latest", task_id=task_id, checkpoint_id=cp.checkpoint_id)
            return cp
        
        return None
    
    async def calculate_progress(
        self,
        subtasks: List[SubTask],
        completed_ids: List[str],
    ) -> float:
        """计算整体进度"""
        if not subtasks:
            return 100.0
        
        total_minutes = sum(st.estimated_minutes for st in subtasks)
        completed_minutes = sum(
            st.estimated_minutes for st in subtasks if st.id in completed_ids
        )
        
        return (completed_minutes / total_minutes) * 100 if total_minutes > 0 else 0.0


class TaskBatchService:
    """
    任务批量操作服务
    
    支持批量更新、删除等操作的二次确认
    """
    
    def __init__(self):
        self.state_machine = TaskStateMachine()
    
    async def batch_update_status(
        self,
        task_ids: List[str],
        new_status: TaskStatus,
        db: AsyncSession,
        confirmed: bool = False,
    ) -> Dict[str, Any]:
        """
        批量更新任务状态
        
        Args:
            task_ids: 任务ID列表
            new_status: 新状态
            db: 数据库会话
            confirmed: 是否已确认
        
        Returns:
            操作结果
        """
        if not confirmed:
            # 需要确认
            return {
                "requires_confirmation": True,
                "task_count": len(task_ids),
                "operation": f"batch_update_to_{new_status.value}",
            }
        
        # 执行更新
        updated = []
        failed = []
        
        for task_id in task_ids:
            try:
                result = await db.execute(
                    select(Task).where(Task.id == task_id)
                )
                task = result.scalar_one_or_none()
                
                if task:
                    old_status = TaskStatus(task.status)
                    
                    if self.state_machine.can_transition(old_status, new_status):
                        task.status = new_status.value
                        updated.append(task_id)
                    else:
                        failed.append({
                            "task_id": task_id,
                            "reason": f"无法从 {old_status.value} 转换到 {new_status.value}",
                        })
                else:
                    failed.append({"task_id": task_id, "reason": "任务不存在"})
                    
            except Exception as e:
                failed.append({"task_id": task_id, "reason": str(e)})
        
        await db.commit()
        
        return {
            "success": len(failed) == 0,
            "updated_count": len(updated),
            "failed_count": len(failed),
            "updated": updated,
            "failed": failed,
        }
    
    async def batch_delete(
        self,
        task_ids: List[str],
        db: AsyncSession,
        confirmed: bool = False,
    ) -> Dict[str, Any]:
        """
        批量删除任务
        
        需要二次确认，因为删除不可逆
        """
        if not confirmed:
            return {
                "requires_confirmation": True,
                "task_count": len(task_ids),
                "operation": "batch_delete",
                "warning": "删除操作不可逆，请谨慎确认",
            }
        
        deleted = []
        failed = []
        
        for task_id in task_ids:
            try:
                result = await db.execute(
                    select(Task).where(Task.id == task_id)
                )
                task = result.scalar_one_or_none()
                
                if task:
                    await db.delete(task)
                    deleted.append(task_id)
                else:
                    failed.append({"task_id": task_id, "reason": "任务不存在"})
                    
            except Exception as e:
                failed.append({"task_id": task_id, "reason": str(e)})
        
        await db.commit()
        
        return {
            "success": len(failed) == 0,
            "deleted_count": len(deleted),
            "failed_count": len(failed),
            "deleted": deleted,
            "failed": failed,
        }


# 全局服务实例
_decomposer_agent: Optional[DecomposerAgent] = None
_resumable_manager: Optional[ResumableTaskManager] = None
_batch_service: Optional[TaskBatchService] = None


def get_decomposer_agent() -> DecomposerAgent:
    """获取Decomposer Agent单例"""
    global _decomposer_agent
    if _decomposer_agent is None:
        _decomposer_agent = DecomposerAgent()
    return _decomposer_agent


def get_resumable_task_manager() -> ResumableTaskManager:
    """获取可恢复任务管理器单例"""
    global _resumable_manager
    if _resumable_manager is None:
        _resumable_manager = ResumableTaskManager()
    return _resumable_manager


def get_task_batch_service() -> TaskBatchService:
    """获取任务批量服务单例"""
    global _batch_service
    if _batch_service is None:
        _batch_service = TaskBatchService()
    return _batch_service
