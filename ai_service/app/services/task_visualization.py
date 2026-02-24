"""
任务可视化服务
生成任务甘特图、进度看板、依赖图等可视化数据
"""

from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from enum import Enum

from app.core.logging import get_logger

logger = get_logger(__name__)


class TaskViewType(str, Enum):
    """视图类型"""
    GANTT = "gantt"           # 甘特图
    KANBAN = "kanban"         # 看板
    LIST = "list"             # 列表
    DEPENDENCY = "dependency" # 依赖图
    TIMELINE = "timeline"     # 时间线


@dataclass
class GanttTask:
    """甘特图任务"""
    id: str
    title: str
    start_date: datetime
    end_date: datetime
    progress_percent: float
    dependencies: List[str]
    milestone: bool
    status: str
    assignee: Optional[str] = None
    color: Optional[str] = None


@dataclass
class KanbanColumn:
    """看板列"""
    id: str
    title: str
    status: str
    tasks: List[Dict[str, Any]]
    task_count: int
    wip_limit: Optional[int] = None  # 在制品限制


@dataclass
class DependencyNode:
    """依赖图节点"""
    id: str
    title: str
    status: str
    x: float
    y: float
    color: str


@dataclass
class DependencyEdge:
    """依赖图边"""
    source: str
    target: str
    type: str  # "blocking", "related"


@dataclass
class TaskVisualization:
    """任务可视化数据"""
    view_type: TaskViewType
    data: Dict[str, Any]
    metadata: Dict[str, Any]


class GanttChartGenerator:
    """甘特图生成器"""
    
    def generate(
        self,
        tasks: List[Dict[str, Any]],
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> TaskVisualization:
        """
        生成甘特图数据
        
        Args:
            tasks: 任务列表
            start_date: 开始日期
            end_date: 结束日期
        
        Returns:
            甘特图可视化数据
        """
        if not start_date:
            start_date = datetime.now()
        
        gantt_tasks = []
        current_date = start_date
        
        for i, task in enumerate(tasks):
            # 计算任务时间
            duration_hours = task.get("estimated_hours", 4)
            duration_days = max(1, int(duration_hours / 8))
            
            task_start = current_date
            task_end = task_start + timedelta(days=duration_days)
            
            gantt_task = GanttTask(
                id=task.get("id", f"task_{i}"),
                title=task.get("title", "未命名任务"),
                start_date=task_start,
                end_date=task_end,
                progress_percent=task.get("progress", 0),
                dependencies=task.get("dependencies", []),
                milestone=task.get("is_milestone", False),
                status=task.get("status", "pending"),
                assignee=task.get("assignee"),
                color=self._get_status_color(task.get("status", "pending")),
            )
            
            gantt_tasks.append(gantt_task)
            current_date = task_end + timedelta(days=1)  # 任务间间隔1天
        
        # 计算总时间范围
        if gantt_tasks:
            actual_start = min(t.start_date for t in gantt_tasks)
            actual_end = max(t.end_date for t in gantt_tasks)
        else:
            actual_start = start_date
            actual_end = start_date + timedelta(days=7)
        
        return TaskVisualization(
            view_type=TaskViewType.GANTT,
            data={
                "tasks": [asdict(t) for t in gantt_tasks],
                "start_date": actual_start.isoformat(),
                "end_date": actual_end.isoformat(),
                "total_days": (actual_end - actual_start).days,
            },
            metadata={
                "task_count": len(gantt_tasks),
                "milestone_count": sum(1 for t in gantt_tasks if t.milestone),
            },
        )
    
    def _get_status_color(self, status: str) -> str:
        """根据状态获取颜色"""
        colors = {
            "pending": "#9CA3AF",      # 灰色
            "in_progress": "#3B82F6",  # 蓝色
            "completed": "#10B981",    # 绿色
            "blocked": "#EF4444",      # 红色
            "paused": "#F59E0B",       # 黄色
        }
        return colors.get(status, "#6B7280")


class KanbanBoardGenerator:
    """看板生成器"""
    
    def generate(
        self,
        tasks: List[Dict[str, Any]],
        columns_config: Optional[List[Dict]] = None,
    ) -> TaskVisualization:
        """
        生成看板数据
        
        默认列：待办、进行中、已完成
        """
        if not columns_config:
            columns_config = [
                {"id": "pending", "title": "待办", "status": "pending", "wip_limit": None},
                {"id": "in_progress", "title": "进行中", "status": "in_progress", "wip_limit": 3},
                {"id": "completed", "title": "已完成", "status": "completed", "wip_limit": None},
            ]
        
        # 按状态分组任务
        columns = []
        for col_config in columns_config:
            col_tasks = [
                {
                    "id": t.get("id"),
                    "title": t.get("title"),
                    "priority": t.get("priority", 1),
                    "assignee": t.get("assignee"),
                    "due_date": t.get("due_date"),
                    "tags": t.get("tags", []),
                }
                for t in tasks
                if t.get("status") == col_config["status"]
            ]
            
            column = KanbanColumn(
                id=col_config["id"],
                title=col_config["title"],
                status=col_config["status"],
                tasks=col_tasks,
                task_count=len(col_tasks),
                wip_limit=col_config.get("wip_limit"),
            )
            columns.append(column)
        
        return TaskVisualization(
            view_type=TaskViewType.KANBAN,
            data={
                "columns": [asdict(c) for c in columns],
            },
            metadata={
                "total_tasks": len(tasks),
                "wip_violations": [
                    c.id for c in columns
                    if c.wip_limit and c.task_count > c.wip_limit
                ],
            },
        )


class DependencyGraphGenerator:
    """依赖图生成器"""
    
    def generate(
        self,
        tasks: List[Dict[str, Any]],
    ) -> TaskVisualization:
        """
        生成任务依赖关系图
        """
        nodes = []
        edges = []
        
        # 创建节点
        for i, task in enumerate(tasks):
            node = DependencyNode(
                id=task.get("id"),
                title=task.get("title", "")[:20],  # 截断标题
                status=task.get("status", "pending"),
                x=i * 150,  # 简单水平布局
                y=100 + (i % 3) * 100,  # 垂直错位
                color=self._get_status_color(task.get("status", "pending")),
            )
            nodes.append(node)
        
        # 创建边
        for task in tasks:
            task_id = task.get("id")
            for dep_id in task.get("dependencies", []):
                edge = DependencyEdge(
                    source=dep_id,
                    target=task_id,
                    type="blocking",
                )
                edges.append(edge)
        
        return TaskVisualization(
            view_type=TaskViewType.DEPENDENCY,
            data={
                "nodes": [asdict(n) for n in nodes],
                "edges": [asdict(e) for e in edges],
            },
            metadata={
                "node_count": len(nodes),
                "edge_count": len(edges),
                "has_cycles": self._detect_cycles(nodes, edges),
            },
        )
    
    def _get_status_color(self, status: str) -> str:
        """根据状态获取颜色"""
        colors = {
            "pending": "#9CA3AF",
            "in_progress": "#3B82F6",
            "completed": "#10B981",
            "blocked": "#EF4444",
            "paused": "#F59E0B",
        }
        return colors.get(status, "#6B7280")
    
    def _detect_cycles(self, nodes: List[DependencyNode], edges: List[DependencyEdge]) -> bool:
        """检测图中是否有环"""
        # 构建邻接表
        graph = {n.id: [] for n in nodes}
        for edge in edges:
            graph[edge.source].append(edge.target)
        
        # DFS检测环
        visited = set()
        rec_stack = set()
        
        def has_cycle(node_id: str) -> bool:
            visited.add(node_id)
            rec_stack.add(node_id)
            
            for neighbor in graph.get(node_id, []):
                if neighbor not in visited:
                    if has_cycle(neighbor):
                        return True
                elif neighbor in rec_stack:
                    return True
            
            rec_stack.remove(node_id)
            return False
        
        for node in nodes:
            if node.id not in visited:
                if has_cycle(node.id):
                    return True
        
        return False


class TaskDashboardGenerator:
    """任务仪表板生成器"""
    
    def generate(
        self,
        tasks: List[Dict[str, Any]],
        milestones: Optional[List[Dict]] = None,
    ) -> Dict[str, Any]:
        """
        生成任务仪表板数据
        
        包含统计、进度、预警等信息
        """
        total_tasks = len(tasks)
        
        # 状态统计
        status_counts = {}
        for task in tasks:
            status = task.get("status", "unknown")
            status_counts[status] = status_counts.get(status, 0) + 1
        
        # 计算完成率
        completed = status_counts.get("completed", 0)
        completion_rate = (completed / total_tasks * 100) if total_tasks > 0 else 0
        
        # 优先级分布
        priority_counts = {}
        for task in tasks:
            priority = task.get("priority", 1)
            priority_counts[priority] = priority_counts.get(priority, 0) + 1
        
        # 即将到期任务
        now = datetime.now()
        upcoming_deadline = [
            {
                "id": t.get("id"),
                "title": t.get("title"),
                "due_date": t.get("due_date"),
                "days_left": (datetime.fromisoformat(t.get("due_date")) - now).days
                if t.get("due_date") else None,
            }
            for t in tasks
            if t.get("due_date") and t.get("status") != "completed"
        ]
        upcoming_deadline.sort(key=lambda x: x.get("days_left") or 999)
        upcoming_deadline = upcoming_deadline[:5]  # 只显示前5个
        
        # 里程碑进度
        milestone_progress = []
        if milestones:
            for ms in milestones:
                ms_tasks = [t for t in tasks if t.get("milestone_id") == ms.get("id")]
                ms_total = len(ms_tasks)
                ms_completed = sum(1 for t in ms_tasks if t.get("status") == "completed")
                ms_progress = (ms_completed / ms_total * 100) if ms_total > 0 else 0
                
                milestone_progress.append({
                    "id": ms.get("id"),
                    "title": ms.get("title"),
                    "progress": ms_progress,
                    "total_tasks": ms_total,
                    "completed_tasks": ms_completed,
                })
        
        # 预警信息
        alerts = []
        
        # 逾期任务
        overdue = [t for t in tasks if self._is_overdue(t)]
        if overdue:
            alerts.append({
                "type": "overdue",
                "severity": "high",
                "message": f"有 {len(overdue)} 个任务已逾期",
                "task_ids": [t.get("id") for t in overdue],
            })
        
        # 阻塞任务
        blocked = [t for t in tasks if t.get("status") == "blocked"]
        if blocked:
            alerts.append({
                "type": "blocked",
                "severity": "medium",
                "message": f"有 {len(blocked)} 个任务被阻塞",
                "task_ids": [t.get("id") for t in blocked],
            })
        
        # 高优先级未开始任务
        high_priority_pending = [
            t for t in tasks
            if t.get("priority", 1) >= 4 and t.get("status") == "pending"
        ]
        if high_priority_pending:
            alerts.append({
                "type": "high_priority_pending",
                "severity": "low",
                "message": f"有 {len(high_priority_pending)} 个高优先级任务待处理",
                "task_ids": [t.get("id") for t in high_priority_pending],
            })
        
        return {
            "summary": {
                "total_tasks": total_tasks,
                "completion_rate": round(completion_rate, 1),
                "completed_tasks": completed,
                "remaining_tasks": total_tasks - completed,
            },
            "status_distribution": status_counts,
            "priority_distribution": priority_counts,
            "upcoming_deadlines": upcoming_deadline,
            "milestone_progress": milestone_progress,
            "alerts": alerts,
        }
    
    def _is_overdue(self, task: Dict) -> bool:
        """检查任务是否逾期"""
        if task.get("status") == "completed":
            return False
        
        due_date = task.get("due_date")
        if not due_date:
            return False
        
        try:
            due = datetime.fromisoformat(due_date)
            return due < datetime.now()
        except:
            return False


class TaskVisualizationService:
    """任务可视化服务"""
    
    def __init__(self):
        self.gantt_generator = GanttChartGenerator()
        self.kanban_generator = KanbanBoardGenerator()
        self.dependency_generator = DependencyGraphGenerator()
        self.dashboard_generator = TaskDashboardGenerator()
    
    async def generate_view(
        self,
        view_type: TaskViewType,
        tasks: List[Dict[str, Any]],
        **kwargs
    ) -> TaskVisualization:
        """
        生成指定类型的视图
        
        Args:
            view_type: 视图类型
            tasks: 任务列表
            **kwargs: 额外参数
        
        Returns:
            可视化数据
        """
        if view_type == TaskViewType.GANTT:
            return self.gantt_generator.generate(
                tasks,
                start_date=kwargs.get("start_date"),
                end_date=kwargs.get("end_date"),
            )
        
        elif view_type == TaskViewType.KANBAN:
            return self.kanban_generator.generate(
                tasks,
                columns_config=kwargs.get("columns_config"),
            )
        
        elif view_type == TaskViewType.DEPENDENCY:
            return self.dependency_generator.generate(tasks)
        
        elif view_type == TaskViewType.LIST:
            return TaskVisualization(
                view_type=TaskViewType.LIST,
                data={"tasks": tasks},
                metadata={"task_count": len(tasks)},
            )
        
        else:
            raise ValueError(f"不支持的视图类型: {view_type}")
    
    async def generate_dashboard(
        self,
        tasks: List[Dict[str, Any]],
        milestones: Optional[List[Dict]] = None,
    ) -> Dict[str, Any]:
        """生成仪表板"""
        return self.dashboard_generator.generate(tasks, milestones)


# 全局服务实例
_visualization_service: Optional[TaskVisualizationService] = None


def get_task_visualization_service() -> TaskVisualizationService:
    """获取任务可视化服务单例"""
    global _visualization_service
    if _visualization_service is None:
        _visualization_service = TaskVisualizationService()
    return _visualization_service
