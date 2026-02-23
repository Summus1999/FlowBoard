"""
Planner Agent测试
"""

import pytest
from datetime import datetime, timedelta

from app.services.planner_service import (
    PlannerAgent,
    PlanTemplateLibrary,
    PlanProposal,
    LearningGoal,
    Milestone,
    LearningTask,
)
from app.services.plan_confirmation import (
    ConfirmationService,
    ConfirmationType,
    ProposalConfirmationBuilder,
)
from app.services.plan_version_manager import PlanVersionManager


class TestPlanTemplateLibrary:
    """计划模板库测试"""
    
    def test_get_template(self):
        """测试获取模板"""
        template = PlanTemplateLibrary.get_template("backend_development")
        
        assert template is not None
        assert "milestones" in template
        assert len(template["milestones"]) > 0
    
    def test_detect_template_backend(self):
        """测试检测后端模板"""
        detected = PlanTemplateLibrary.detect_template("我想学习后端开发")
        assert detected == "backend_development"
    
    def test_detect_template_frontend(self):
        """测试检测前端模板"""
        detected = PlanTemplateLibrary.detect_template("学习React和Vue")
        assert detected == "frontend_development"
    
    def test_detect_template_data(self):
        """测试检测数据科学模板"""
        detected = PlanTemplateLibrary.detect_template("机器学习入门")
        assert detected == "data_science"
    
    def test_detect_template_none(self):
        """测试无匹配模板"""
        detected = PlanTemplateLibrary.detect_template("学习绘画")
        assert detected is None


class TestPlannerAgent:
    """Planner Agent测试"""
    
    def test_parse_weekly_hours(self):
        """测试解析每周学习时间"""
        planner = PlannerAgent()
        
        # 正常情况
        hours = planner._parse_weekly_hours(["每周10小时"])
        assert hours == 10
        
        # 不同格式
        hours = planner._parse_weekly_hours(["每周20个小时学习"])
        assert hours == 20
        
        # 无约束
        hours = planner._parse_weekly_hours([])
        assert hours == 10  # 默认值
        
        # 无匹配
        hours = planner._parse_weekly_hours(["尽快完成"])
        assert hours == 10  # 默认值
    
    def test_calculate_timeline(self):
        """测试计算时间线"""
        planner = PlannerAgent()
        
        milestones = [
            Milestone("M1", "Desc", 1, 7, [], ""),
            Milestone("M2", "Desc", 2, 14, [], ""),
        ]
        
        tasks = [
            LearningTask("T1", "Desc", 5, 3, [], [], 1),
            LearningTask("T2", "Desc", 10, 2, [], [], 1),
        ]
        
        total_days, total_hours = planner._calculate_timeline(milestones, tasks)
        
        assert total_days == 21  # 7 + 14
        assert total_hours == 15  # 5 + 10


class TestConfirmationBuilder:
    """确认构建器测试"""
    
    def test_build_for_plan_creation(self):
        """测试构建议划创建确认"""
        data = ProposalConfirmationBuilder.build_for_plan_creation(
            plan_id="plan-123",
            plan_title="Python学习计划",
            milestones_count=4,
            tasks_count=20,
            estimated_duration="3个月",
            will_create_calendar_events=True,
            will_create_todos=True,
        )
        
        assert data["confirmation_type"] == ConfirmationType.PLAN_CREATION
        assert data["plan_id"] == "plan-123"
        assert "Python学习计划" in data["title"]
        assert len(data["affected_items"]) == 4  # 里程碑 + 任务 + 日历 + 待办
    
    def test_build_for_batch_task_update(self):
        """测试构建批量任务更新确认"""
        data = ProposalConfirmationBuilder.build_for_batch_task_update(
            plan_id="plan-123",
            task_ids=["task-1", "task-2", "task-3"],
            update_type="complete",
        )
        
        assert data["confirmation_type"] == ConfirmationType.BATCH_TASK_UPDATE
        assert data["plan_id"] == "plan-123"
        assert "批量" in data["title"]
    
    def test_build_for_task_delete(self):
        """测试构建任务删除确认"""
        data = ProposalConfirmationBuilder.build_for_task_delete(
            plan_id="plan-123",
            task_id="task-1",
            task_title="学习Python基础",
        )
        
        assert data["confirmation_type"] == ConfirmationType.TASK_DELETE
        assert "删除" in data["title"]
        assert data["undo_window_minutes"] == 5


class TestConfirmationService:
    """确认服务测试"""
    
    @pytest.mark.asyncio
    async def test_create_confirmation(self):
        """测试创建确认"""
        service = ConfirmationService()
        
        confirmation = await service.create_confirmation(
            plan_id="plan-123",
            confirmation_type=ConfirmationType.PLAN_CREATION,
            title="测试确认",
            description="测试描述",
            impact_summary="影响摘要",
            affected_items=[{"type": "任务", "name": "任务1"}],
        )
        
        assert confirmation.plan_id == "plan-123"
        assert confirmation.confirmation_type == ConfirmationType.PLAN_CREATION
        assert confirmation.undo_available is True
        assert confirmation.undo_window_minutes == 30
    
    @pytest.mark.asyncio
    async def test_format_confirmation_prompt(self):
        """测试格式化确认提示"""
        service = ConfirmationService()
        
        confirmation = await service.create_confirmation(
            plan_id="plan-123",
            confirmation_type=ConfirmationType.PLAN_CREATION,
            title="创建学习计划",
            description="将创建一个学习计划",
            impact_summary="创建4个里程碑和20个任务",
            affected_items=[
                {"type": "里程碑", "name": "4个里程碑"},
                {"type": "任务", "name": "20个任务"},
            ],
        )
        
        prompt = service.format_confirmation_prompt(confirmation)
        
        assert "创建学习计划" in prompt
        assert "4个里程碑" in prompt
        assert "yes" in prompt.lower()
        assert "no" in prompt.lower()


class TestPlanVersionManager:
    """版本管理器测试"""
    
    def test_max_versions_to_keep(self):
        """测试最大保留版本数"""
        manager = PlanVersionManager()
        assert manager.MAX_VERSIONS_TO_KEEP == 10
