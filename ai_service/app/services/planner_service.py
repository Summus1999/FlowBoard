"""
学习计划规划服务
实现完整的Planner Agent功能
"""

import json
import re
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from langchain_core.messages import SystemMessage, HumanMessage

from app.core.config import settings
from app.core.logging import get_logger
from app.services.model_gateway import get_model_gateway, ModelProfile
from app.models.plan import Plan, PlanVersion, Task, PlanStatus, TaskStatus

logger = get_logger(__name__)


@dataclass
class LearningGoal:
    """学习目标"""
    title: str
    description: str
    target_skills: List[str]
    target_date: Optional[datetime] = None
    weekly_hours: int = 10
    prerequisites: List[str] = field(default_factory=list)
    constraints: List[str] = field(default_factory=list)


@dataclass
class Milestone:
    """里程碑"""
    title: str
    description: str
    order: int
    duration_days: int
    deliverables: List[str]
    success_criteria: str


@dataclass
class LearningTask:
    """学习任务"""
    title: str
    description: str
    estimated_hours: float
    priority: int  # 1-5
    dependencies: List[str]  # 依赖的任务标题
    resources: List[str]
    milestone_order: int


@dataclass
class PlanProposal:
    """计划提案"""
    title: str
    overview: str
    goals: List[LearningGoal]
    milestones: List[Milestone]
    tasks: List[LearningTask]
    total_duration_days: int
    total_hours: float
    weekly_schedule: Dict[str, Any]
    risk_assessment: List[str]
    alternatives: List[str]


class PlanTemplateLibrary:
    """计划模板库"""
    
    TEMPLATES = {
        "backend_development": {
            "title": "后端开发学习计划",
            "milestones": [
                {"title": "编程基础", "duration": 21, "skills": ["Python/Java", "数据结构", "算法"]},
                {"title": "Web开发", "duration": 28, "skills": ["HTTP", "REST API", "数据库"]},
                {"title": "框架学习", "duration": 21, "skills": ["Django/Spring", "ORM", "中间件"]},
                {"title": "系统架构", "duration": 21, "skills": ["微服务", "消息队列", "缓存"]},
            ]
        },
        "frontend_development": {
            "title": "前端开发学习计划",
            "milestones": [
                {"title": "HTML/CSS基础", "duration": 14, "skills": ["HTML5", "CSS3", "响应式"]},
                {"title": "JavaScript核心", "duration": 21, "skills": ["ES6+", "DOM", "异步编程"]},
                {"title": "框架学习", "duration": 28, "skills": ["React/Vue", "状态管理", "路由"]},
                {"title": "工程化", "duration": 14, "skills": ["Webpack", "测试", "CI/CD"]},
            ]
        },
        "data_science": {
            "title": "数据科学学习计划",
            "milestones": [
                {"title": "数学基础", "duration": 21, "skills": ["线性代数", "概率论", "统计"]},
                {"title": "Python数据分析", "duration": 21, "skills": ["NumPy", "Pandas", "可视化"]},
                {"title": "机器学习", "duration": 35, "skills": ["监督学习", "无监督学习", "模型评估"]},
                {"title": "深度学习", "duration": 28, "skills": ["神经网络", "PyTorch", "CNN/RNN"]},
            ]
        },
    }
    
    @classmethod
    def get_template(cls, key: str) -> Optional[Dict]:
        """获取模板"""
        return cls.TEMPLATES.get(key)
    
    @classmethod
    def detect_template(cls, goal_description: str) -> Optional[str]:
        """根据目标描述检测适合的模板"""
        goal_lower = goal_description.lower()
        
        keywords_map = {
            "backend_development": ["后端", "backend", "服务器", "api", "数据库"],
            "frontend_development": ["前端", "frontend", "react", "vue", "css", "界面"],
            "data_science": ["数据", "data", "机器学习", "ml", "ai", "算法", "分析"],
        }
        
        for template_key, keywords in keywords_map.items():
            if any(kw in goal_lower for kw in keywords):
                return template_key
        
        return None


class PlannerAgent:
    """
    学习计划规划Agent
    
    功能：
    1. 解析用户目标
    2. 选择或生成学习路径
    3. 制定里程碑和任务
    4. 生成可执行的计划提案
    """
    
    def __init__(self):
        self.model_gateway = get_model_gateway()
        self.template_library = PlanTemplateLibrary()
    
    async def create_plan_proposal(
        self,
        goal_description: str,
        target_date: Optional[datetime] = None,
        constraints: Optional[List[str]] = None,
        user_preferences: Optional[Dict] = None,
    ) -> PlanProposal:
        """
        创建学习计划提案
        
        Args:
            goal_description: 目标描述
            target_date: 目标完成日期
            constraints: 约束条件（如"每周10小时"）
            user_preferences: 用户偏好
        
        Returns:
            PlanProposal: 计划提案
        """
        logger.info("planner.create_proposal", goal=goal_description[:50])
        
        # 1. 分析目标
        goal_analysis = await self._analyze_goal(goal_description)
        
        # 2. 检测模板
        template_key = self.template_library.detect_template(goal_description)
        template = self.template_library.get_template(template_key) if template_key else None
        
        # 3. 生成学习路径
        if template:
            milestones = await self._generate_milestones_from_template(
                template, goal_analysis, target_date
            )
        else:
            milestones = await self._generate_custom_milestones(
                goal_analysis, target_date
            )
        
        # 4. 生成任务
        tasks = await self._generate_tasks(milestones, goal_analysis)
        
        # 5. 计算时间线
        total_days, total_hours = self._calculate_timeline(milestones, tasks)
        
        # 6. 风险评估
        risks = self._assess_risks(goal_analysis, milestones, constraints or [])
        
        # 7. 构建提案
        proposal = PlanProposal(
            title=goal_analysis.get("title", "学习计划"),
            overview=goal_analysis.get("overview", ""),
            goals=[LearningGoal(
                title=goal_analysis.get("title", ""),
                description=goal_description,
                target_skills=goal_analysis.get("skills", []),
                target_date=target_date,
                weekly_hours=self._parse_weekly_hours(constraints),
            )],
            milestones=milestones,
            tasks=tasks,
            total_duration_days=total_days,
            total_hours=total_hours,
            weekly_schedule=self._generate_weekly_schedule(tasks, constraints),
            risk_assessment=risks,
            alternatives=goal_analysis.get("alternatives", []),
        )
        
        logger.info(
            "planner.proposal_created",
            title=proposal.title,
            milestones=len(milestones),
            tasks=len(tasks),
        )
        
        return proposal
    
    async def _analyze_goal(self, goal_description: str) -> Dict[str, Any]:
        """分析学习目标"""
        prompt = f"""分析以下学习目标，提取关键信息。

目标描述：{goal_description}

请输出JSON格式：
{{
    "title": "学习计划的标题",
    "overview": "目标概述（100字以内）",
    "skills": ["需要掌握的技能列表"],
    "difficulty": "难度等级：beginner/intermediate/advanced",
    "prerequisites": ["前置知识要求"],
    "alternatives": ["备选学习路径"]
}}"""
        
        try:
            response = await self.model_gateway.generate(
                messages=[HumanMessage(content=prompt)],
                model_profile=ModelProfile.HIGH_QUALITY,
                temperature=0.3,
            )
            
            # 解析JSON
            content = response.content
            json_match = re.search(r'\{[^}]+\}', content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            
        except Exception as e:
            logger.error("planner.goal_analysis_failed", error=str(e))
        
        # 默认返回
        return {
            "title": "定制学习计划",
            "overview": goal_description,
            "skills": [],
            "difficulty": "intermediate",
            "prerequisites": [],
            "alternatives": [],
        }
    
    async def _generate_milestones_from_template(
        self,
        template: Dict,
        goal_analysis: Dict,
        target_date: Optional[datetime],
    ) -> List[Milestone]:
        """基于模板生成里程碑"""
        milestones = []
        
        for i, ms_template in enumerate(template.get("milestones", []), 1):
            milestone = Milestone(
                title=ms_template["title"],
                description=f"掌握{', '.join(ms_template.get('skills', []))}",
                order=i,
                duration_days=ms_template["duration"],
                deliverables=[f"完成{skill}学习" for skill in ms_template.get("skills", [])],
                success_criteria=f"能够独立使用{', '.join(ms_template.get('skills', [])[:2])}完成实际项目",
            )
            milestones.append(milestone)
        
        return milestones
    
    async def _generate_custom_milestones(
        self,
        goal_analysis: Dict,
        target_date: Optional[datetime],
    ) -> List[Milestone]:
        """生成自定义里程碑"""
        prompt = f"""为以下学习目标设计里程碑。

目标：{goal_analysis.get('title', '')}
概述：{goal_analysis.get('overview', '')}
技能：{', '.join(goal_analysis.get('skills', []))}

请设计3-5个里程碑，输出JSON格式：
[
    {{
        "title": "里程碑名称",
        "description": "描述",
        "duration_days": 21,
        "deliverables": ["交付物1", "交付物2"],
        "success_criteria": "成功标准"
    }}
]"""
        
        try:
            response = await self.model_gateway.generate(
                messages=[HumanMessage(content=prompt)],
                model_profile=ModelProfile.HIGH_QUALITY,
                temperature=0.3,
            )
            
            content = response.content
            json_match = re.search(r'\[[^\]]+\]', content, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                return [
                    Milestone(
                        title=m["title"],
                        description=m["description"],
                        order=i,
                        duration_days=m["duration_days"],
                        deliverables=m["deliverables"],
                        success_criteria=m["success_criteria"],
                    )
                    for i, m in enumerate(data, 1)
                ]
        except Exception as e:
            logger.error("planner.custom_milestones_failed", error=str(e))
        
        # 默认里程碑
        return [
            Milestone(
                title="基础阶段",
                description="掌握基础知识",
                order=1,
                duration_days=21,
                deliverables=["完成基础学习"],
                success_criteria="通过基础测试",
            ),
            Milestone(
                title="进阶阶段",
                description="深入学习核心内容",
                order=2,
                duration_days=28,
                deliverables=["完成进阶项目"],
                success_criteria="独立完成中等难度项目",
            ),
        ]
    
    async def _generate_tasks(
        self,
        milestones: List[Milestone],
        goal_analysis: Dict,
    ) -> List[LearningTask]:
        """生成学习任务"""
        tasks = []
        
        for milestone in milestones:
            # 为每个里程碑生成任务
            prompt = f"""为里程碑生成具体学习任务。

里程碑：{milestone.title}
描述：{milestone.description}
持续时间：{milestone.duration_days}天
交付物：{', '.join(milestone.deliverables)}

请生成3-5个具体任务，输出JSON格式：
[
    {{
        "title": "任务名称",
        "description": "任务描述",
        "estimated_hours": 5,
        "priority": 3,
        "dependencies": ["依赖的任务名称"],
        "resources": ["推荐资源"]
    }}
]"""
            
            try:
                response = await self.model_gateway.generate(
                    messages=[HumanMessage(content=prompt)],
                    model_profile=ModelProfile.BALANCED,
                    temperature=0.3,
                )
                
                content = response.content
                json_match = re.search(r'\[[^\]]+\]', content, re.DOTALL)
                if json_match:
                    data = json.loads(json_match.group())
                    for task_data in data:
                        tasks.append(LearningTask(
                            title=task_data["title"],
                            description=task_data["description"],
                            estimated_hours=task_data["estimated_hours"],
                            priority=task_data["priority"],
                            dependencies=task_data.get("dependencies", []),
                            resources=task_data.get("resources", []),
                            milestone_order=milestone.order,
                        ))
            except Exception as e:
                logger.warning("planner.task_generation_failed", error=str(e))
        
        # 如果没有生成任务，创建默认任务
        if not tasks:
            for milestone in milestones:
                tasks.append(LearningTask(
                    title=f"{milestone.title} - 核心内容学习",
                    description=f"完成{milestone.title}的所有核心内容",
                    estimated_hours=milestone.duration_days * 2,
                    priority=3,
                    dependencies=[],
                    resources=[],
                    milestone_order=milestone.order,
                ))
        
        return tasks
    
    def _calculate_timeline(
        self,
        milestones: List[Milestone],
        tasks: List[LearningTask],
    ) -> Tuple[int, float]:
        """计算时间线"""
        total_days = sum(m.duration_days for m in milestones)
        total_hours = sum(t.estimated_hours for t in tasks)
        return total_days, total_hours
    
    def _parse_weekly_hours(self, constraints: Optional[List[str]]) -> int:
        """解析每周学习时间"""
        if not constraints:
            return 10
        
        for constraint in constraints:
            # 匹配"每周X小时"或"X小时/周"
            match = re.search(r'(\d+)\s*小时', constraint)
            if match:
                return int(match.group(1))
        
        return 10
    
    def _generate_weekly_schedule(
        self,
        tasks: List[LearningTask],
        constraints: Optional[List[str]],
    ) -> Dict[str, Any]:
        """生成每周 schedule"""
        weekly_hours = self._parse_weekly_hours(constraints)
        
        return {
            "total_weekly_hours": weekly_hours,
            "recommended_days": ["周一", "周三", "周五", "周日"],
            "daily_hours": weekly_hours / 4,
            "flexible": True,
        }
    
    def _assess_risks(
        self,
        goal_analysis: Dict,
        milestones: List[Milestone],
        constraints: List[str],
    ) -> List[str]:
        """风险评估"""
        risks = []
        
        difficulty = goal_analysis.get("difficulty", "intermediate")
        if difficulty == "advanced":
            risks.append("难度较高，需要较强的前置知识")
        
        total_days = sum(m.duration_days for m in milestones)
        if total_days > 90:
            risks.append("学习周期较长，需要保持持续的学习动力")
        
        if constraints:
            weekly_hours = self._parse_weekly_hours(constraints)
            if weekly_hours < 5:
                risks.append("每周学习时间较少，完成周期可能延长")
        
        return risks


class PlanPersistenceService:
    """计划持久化服务"""
    
    async def save_proposal(
        self,
        user_id: str,
        proposal: PlanProposal,
        db: AsyncSession,
    ) -> Plan:
        """保存计划提案到数据库"""
        # 创建计划
        plan = Plan(
            id=str(uuid4()),
            user_id=user_id,
            title=proposal.title,
            description=proposal.overview,
            status=PlanStatus.PROPOSED.value,
            goal=proposal.goals[0].description if proposal.goals else "",
            target_date=proposal.goals[0].target_date if proposal.goals else None,
        )
        
        db.add(plan)
        await db.flush()
        
        # 创建版本
        version_content = self._format_proposal_to_markdown(proposal)
        version = PlanVersion(
            id=str(uuid4()),
            plan_id=plan.id,
            version_no=1,
            content_md=version_content,
            content_json={
                "milestones": [asdict(m) for m in proposal.milestones],
                "tasks": [asdict(t) for t in proposal.tasks],
            },
            created_by_agent="planner_agent",
        )
        
        db.add(version)
        
        # 创建任务
        for task_data in proposal.tasks:
            task = Task(
                id=str(uuid4()),
                plan_id=plan.id,
                title=task_data.title,
                description=task_data.description,
                status=TaskStatus.PENDING.value,
                priority=task_data.priority,
            )
            db.add(task)
        
        await db.commit()
        await db.refresh(plan)
        
        logger.info("planner.plan_saved", plan_id=plan.id)
        
        return plan
    
    def _format_proposal_to_markdown(self, proposal: PlanProposal) -> str:
        """将提案格式化为Markdown"""
        lines = [
            f"# {proposal.title}",
            "",
            "## 目标概述",
            proposal.overview,
            "",
            f"**预计总时长**: {proposal.total_duration_days}天（{proposal.total_hours}小时）",
            "",
            "## 里程碑",
            "",
        ]
        
        for milestone in proposal.milestones:
            lines.extend([
                f"### {milestone.order}. {milestone.title}",
                f"{milestone.description}",
                f"- 持续时间: {milestone.duration_days}天",
                f"- 交付物: {', '.join(milestone.deliverables)}",
                f"- 成功标准: {milestone.success_criteria}",
                "",
            ])
        
        lines.extend([
            "## 任务列表",
            "",
        ])
        
        for i, task in enumerate(proposal.tasks, 1):
            lines.extend([
                f"{i}. **{task.title}**",
                f"   - 描述: {task.description}",
                f"   - 预计时间: {task.estimated_hours}小时",
                f"   - 优先级: {'⭐' * task.priority}",
                "",
            ])
        
        if proposal.risk_assessment:
            lines.extend([
                "## 风险提示",
                "",
            ])
            for risk in proposal.risk_assessment:
                lines.append(f"- ⚠️ {risk}")
            lines.append("")
        
        return "\n".join(lines)


# 全局服务实例
_planner_agent: Optional[PlannerAgent] = None
_plan_persistence: Optional[PlanPersistenceService] = None


def get_planner_agent() -> PlannerAgent:
    """获取Planner Agent单例"""
    global _planner_agent
    if _planner_agent is None:
        _planner_agent = PlannerAgent()
    return _planner_agent


def get_plan_persistence() -> PlanPersistenceService:
    """获取计划持久化服务单例"""
    global _plan_persistence
    if _plan_persistence is None:
        _plan_persistence = PlanPersistenceService()
    return _plan_persistence
