"""
LangGraph状态定义
定义多Agent工作流的共享状态
"""

from typing import Annotated, Any, Dict, List, Optional, TypedDict
from dataclasses import dataclass, field

from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage


class GraphState(TypedDict):
    """
    LangGraph工作流状态
    
    这是在整个Agent工作流中传递的核心状态对象
    """
    
    # 基础信息
    session_id: str
    user_id: str
    trace_id: str
    request_id: str
    
    # 消息历史
    messages: Annotated[List[BaseMessage], add_messages]
    
    # 当前意图
    intent: str  # plan, decompose, qa, review, chat
    
    # 用户输入
    query: str
    query_normalized: Optional[str]
    
    # RAG检索结果
    retrieval_context: Optional[List[Dict]]
    citations: Optional[List[Dict]]
    
    # 计划相关
    plan_id: Optional[str]
    plan_proposal: Optional[Dict]  # 计划提案
    plan_version: Optional[int]
    user_confirmed: Optional[bool]  # 用户是否确认
    
    # 任务相关
    task_ids: Optional[List[str]]
    tasks_to_modify: Optional[List[Dict]]
    
    # Agent输出
    output: Optional[str]
    output_streaming: bool
    
    # 风险评估
    confidence: float
    risk_level: str  # low, medium, high
    risk_message: Optional[str]
    
    # 工具调用
    tool_calls: Optional[List[Dict]]
    tool_results: Optional[List[Dict]]
    
    # 执行状态
    status: str  # init, context_loaded, intent_classified, proposal_ready, confirmed, executing, completed, failed
    error: Optional[str]
    checkpoint: Optional[Dict]  # 恢复点
    
    # 元数据
    metadata: Dict[str, Any]


@dataclass
class AgentCheckpoint:
    """
    Agent检查点
    用于任务恢复和重试
    """
    
    checkpoint_id: str
    state: Dict[str, Any]
    created_at: str
    retry_count: int = 0
    
    def to_dict(self) -> Dict:
        return {
            "checkpoint_id": self.checkpoint_id,
            "state": self.state,
            "created_at": self.created_at,
            "retry_count": self.retry_count,
        }


@dataclass
class ProposalSummary:
    """计划提案摘要"""
    
    title: str
    description: str
    estimated_duration: str
    milestones_count: int
    tasks_count: int
    impact_scope: List[str]  # 影响范围
    can_undo: bool = True
    undo_window_minutes: int = 30
    
    def to_confirmation_prompt(self) -> str:
        """生成确认提示"""
        return f"""
## 学习计划提案

**{self.title}**

{self.description}

- 预计周期: {self.estimated_duration}
- 里程碑: {self.milestones_count}个
- 任务数: {self.tasks_count}个
- 影响范围: {', '.join(self.impact_scope)}

{'⚠️ 注意: 此操作可在30分钟内撤销' if self.can_undo else ''}

请确认是否执行此计划？（yes/no）
"""
