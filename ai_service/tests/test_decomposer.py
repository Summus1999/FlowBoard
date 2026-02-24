"""
Decomposer Agent测试
"""

import pytest
from datetime import datetime

from app.services.decomposer_service import (
    DecomposerAgent,
    TaskStateMachine,
    ResumableTaskManager,
    TaskBatchService,
    TaskComplexity,
    SubTask,
)


class TestTaskStateMachine:
    """任务状态机测试"""
    
    def test_valid_transitions_pending(self):
        """测试PENDING状态的有效转换"""
        from app.models.plan import TaskStatus
        
        sm = TaskStateMachine()
        
        # PENDING -> IN_PROGRESS 有效
        assert sm.can_transition(TaskStatus.PENDING, TaskStatus.IN_PROGRESS) is True
        
        # PENDING -> COMPLETED 无效
        assert sm.can_transition(TaskStatus.PENDING, TaskStatus.COMPLETED) is False
        
        # PENDING -> CANCELLED 有效
        assert sm.can_transition(TaskStatus.PENDING, TaskStatus.CANCELLED) is True
    
    def test_valid_transitions_in_progress(self):
        """测试IN_PROGRESS状态的有效转换"""
        from app.models.plan import TaskStatus
        
        sm = TaskStateMachine()
        
        # IN_PROGRESS -> COMPLETED 有效
        assert sm.can_transition(TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED) is True
        
        # IN_PROGRESS -> PAUSED 有效
        assert sm.can_transition(TaskStatus.IN_PROGRESS, TaskStatus.PAUSED) is True
        
        # IN_PROGRESS -> BLOCKED 有效
        assert sm.can_transition(TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED) is True
        
        # IN_PROGRESS -> PENDING 无效（不能回退）
        assert sm.can_transition(TaskStatus.IN_PROGRESS, TaskStatus.PENDING) is False
    
    def test_terminal_states(self):
        """测试终止状态"""
        from app.models.plan import TaskStatus
        
        sm = TaskStateMachine()
        
        # COMPLETED 不能转换到任何状态
        assert sm.can_transition(TaskStatus.COMPLETED, TaskStatus.IN_PROGRESS) is False
        assert sm.can_transition(TaskStatus.COMPLETED, TaskStatus.PENDING) is False
        
        # CANCELLED 不能转换到任何状态
        assert sm.can_transition(TaskStatus.CANCELLED, TaskStatus.IN_PROGRESS) is False


class TestDecomposerAgent:
    """Decomposer Agent测试"""
    
    def test_assess_complexity_simple(self):
        """测试简单任务复杂度评估"""
        agent = DecomposerAgent()
        
        # < 2小时 = SIMPLE
        complexity = agent._assess_complexity(1.5)
        assert complexity == TaskComplexity.SIMPLE
        
        complexity = agent._assess_complexity(2.0)
        assert complexity == TaskComplexity.SIMPLE
    
    def test_assess_complexity_medium(self):
        """测试中等任务复杂度评估"""
        agent = DecomposerAgent()
        
        # 2-8小时 = MEDIUM
        complexity = agent._assess_complexity(4.0)
        assert complexity == TaskComplexity.MEDIUM
        
        complexity = agent._assess_complexity(8.0)
        assert complexity == TaskComplexity.MEDIUM
    
    def test_assess_complexity_complex(self):
        """测试复杂任务复杂度评估"""
        agent = DecomposerAgent()
        
        # > 8小时 = COMPLEX
        complexity = agent._assess_complexity(10.0)
        assert complexity == TaskComplexity.COMPLEX
    
    def test_create_simple_task(self):
        """测试创建简单任务"""
        agent = DecomposerAgent()
        
        result = agent._create_simple_task(
            title="学习Python基础",
            description="学习Python基本语法",
            estimated_hours=1.5,
        )
        
        assert len(result.subtasks) == 1
        assert result.subtasks[0].title == "学习Python基础"
        assert result.subtasks[0].complexity == TaskComplexity.SIMPLE
    
    def test_create_default_subtasks(self):
        """测试创建默认子任务"""
        agent = DecomposerAgent()
        
        subtasks = agent._create_default_subtasks(
            title="大任务",
            description="描述",
            estimated_hours=12,
        )
        
        # 12小时应该拆分为3个子任务（12/4=3）
        assert len(subtasks) == 3
        
        # 检查依赖关系
        assert subtasks[0].dependencies == []
        assert subtasks[1].dependencies == [subtasks[0].id]
        assert subtasks[2].dependencies == [subtasks[1].id]
    
    def test_group_parallel_tasks(self):
        """测试并行任务分组"""
        agent = DecomposerAgent()
        
        # 创建测试子任务
        st1 = SubTask("id1", "任务1", "", 60, TaskComplexity.SIMPLE, [], [], [])
        st2 = SubTask("id2", "任务2", "", 60, TaskComplexity.SIMPLE, ["id1"], [], [])  # 依赖id1
        st3 = SubTask("id3", "任务3", "", 60, TaskComplexity.SIMPLE, [], [], [])  # 无依赖
        st4 = SubTask("id4", "任务4", "", 60, TaskComplexity.SIMPLE, ["id3"], [], [])  # 依赖id3
        
        subtasks = [st1, st2, st3, st4]
        groups = agent._group_parallel_tasks(subtasks)
        
        # 第一组应该是无依赖的st1和st3
        assert len(groups) >= 2
        assert st1.id in groups[0]
        assert st3.id in groups[0]
    
    def test_calculate_critical_path(self):
        """测试关键路径计算"""
        agent = DecomposerAgent()
        
        # 创建链式依赖
        st1 = SubTask("id1", "任务1", "", 60, TaskComplexity.SIMPLE, [], [], [])
        st2 = SubTask("id2", "任务2", "", 60, TaskComplexity.SIMPLE, ["id1"], [], [])
        st3 = SubTask("id3", "任务3", "", 60, TaskComplexity.SIMPLE, ["id2"], [], [])
        
        subtasks = [st1, st2, st3]
        critical_path = agent._calculate_critical_path(subtasks)
        
        # 关键路径应该包含所有任务
        assert len(critical_path) == 3
        assert st1.id in critical_path
        assert st2.id in critical_path
        assert st3.id in critical_path


class TestResumableTaskManager:
    """可恢复任务管理器测试"""
    
    @pytest.mark.asyncio
    async def test_create_checkpoint(self):
        """测试创建检查点"""
        manager = get_resumable_task_manager()
        
        checkpoint = await manager.create_checkpoint(
            task_id="task-123",
            state={"current_step": 3, "data": "test"},
            progress_percent=50.0,
            notes="完成第3步",
        )
        
        assert checkpoint.task_id == "task-123"
        assert checkpoint.progress_percent == 50.0
        assert checkpoint.state["current_step"] == 3
    
    @pytest.mark.asyncio
    async def test_get_latest_checkpoint(self):
        """测试获取最新检查点"""
        manager = get_resumable_task_manager()
        
        # 创建多个检查点
        await manager.create_checkpoint("task-123", {"step": 1}, 25.0)
        await manager.create_checkpoint("task-123", {"step": 2}, 50.0)
        latest = await manager.create_checkpoint("task-123", {"step": 3}, 75.0)
        
        retrieved = await manager.get_latest_checkpoint("task-123")
        
        assert retrieved.checkpoint_id == latest.checkpoint_id
        assert retrieved.progress_percent == 75.0
    
    @pytest.mark.asyncio
    async def test_resume_from_checkpoint(self):
        """测试从检查点恢复"""
        manager = get_resumable_task_manager()
        
        checkpoint = await manager.create_checkpoint(
            task_id="task-123",
            state={"current_step": 5},
            progress_percent=60.0,
        )
        
        # 从指定检查点恢复
        resumed = await manager.resume_from_checkpoint("task-123", checkpoint.checkpoint_id)
        
        assert resumed is not None
        assert resumed.state["current_step"] == 5
    
    @pytest.mark.asyncio
    async def test_calculate_progress(self):
        """测试进度计算"""
        manager = get_resumable_task_manager()
        
        subtasks = [
            SubTask("id1", "任务1", "", 60, TaskComplexity.SIMPLE, [], [], []),
            SubTask("id2", "任务2", "", 120, TaskComplexity.SIMPLE, [], [], []),
            SubTask("id3", "任务3", "", 60, TaskComplexity.SIMPLE, [], [], []),
        ]
        
        # 完成id1和id2（180分钟 / 240分钟 = 75%）
        progress = await manager.calculate_progress(subtasks, ["id1", "id2"])
        assert progress == 75.0
        
        # 全部完成
        progress = await manager.calculate_progress(subtasks, ["id1", "id2", "id3"])
        assert progress == 100.0


class TestTaskBatchService:
    """任务批量服务测试"""
    
    @pytest.mark.asyncio
    async def test_batch_update_requires_confirmation(self):
        """测试批量更新需要确认"""
        service = TaskBatchService()
        
        # Mock数据库会话
        class MockDB:
            async def commit(self):
                pass
        
        result = await service.batch_update_status(
            task_ids=["task-1", "task-2"],
            new_status="in_progress",
            db=MockDB(),
            confirmed=False,
        )
        
        assert result["requires_confirmation"] is True
        assert result["task_count"] == 2
    
    @pytest.mark.asyncio
    async def test_batch_delete_requires_confirmation(self):
        """测试批量删除需要确认"""
        service = TaskBatchService()
        
        class MockDB:
            async def commit(self):
                pass
        
        result = await service.batch_delete(
            task_ids=["task-1", "task-2", "task-3"],
            db=MockDB(),
            confirmed=False,
        )
        
        assert result["requires_confirmation"] is True
        assert result["warning"] is not None
        assert "不可逆" in result["warning"]


# 导入
from app.services.decomposer_service import get_resumable_task_manager
