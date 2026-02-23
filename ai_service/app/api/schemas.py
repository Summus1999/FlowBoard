"""
API请求/响应模型
Pydantic模型定义
"""

from typing import Any, Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


# ===== 基础响应 =====

class BaseResponse(BaseModel):
    """基础响应模型"""
    trace_id: str
    request_id: str


class ErrorResponse(BaseModel):
    """错误响应模型"""
    code: str
    message: str
    trace_id: str
    request_id: str
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())


# ===== Chat API =====

class ChatRequest(BaseModel):
    """聊天请求"""
    session_id: Optional[str] = None
    query: str = Field(..., min_length=1, max_length=10000)
    mode: str = "auto"  # auto, plan, qa, chat
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)


class ChatStreamEvent(BaseModel):
    """聊天流式事件"""
    event: str  # meta, token, citation, risk, done, error
    data: Dict[str, Any]


class ConfidenceResponse(BaseResponse):
    """置信度评估响应"""
    confidence: float = Field(..., ge=0.0, le=1.0)
    risk_level: str  # low, medium, high
    need_warning: bool


# ===== Session API =====

class SessionCreateRequest(BaseModel):
    """创建会话请求"""
    user_id: str
    title: Optional[str] = None
    context: Optional[Dict[str, Any]] = None


class SessionResponse(BaseResponse):
    """会话响应"""
    session_id: str
    user_id: str
    title: Optional[str]
    status: str
    created_at: str


class MessageResponse(BaseModel):
    """消息响应"""
    id: str
    role: str
    content: str
    created_at: str


# ===== Plan API =====

class PlanProposeRequest(BaseModel):
    """计划提案请求"""
    session_id: str
    goal: str
    target_date: Optional[datetime] = None
    constraints: Optional[List[str]] = None


class PlanProposeResponse(BaseResponse):
    """计划提案响应"""
    plan_id: str
    proposal: Dict[str, Any]
    requires_confirmation: bool = True


class PlanConfirmRequest(BaseModel):
    """计划确认请求"""
    confirm: bool
    feedback: Optional[str] = None


class PlanConfirmResponse(BaseResponse):
    """计划确认响应"""
    plan_id: str
    status: str
    executed: bool


class PlanRollbackRequest(BaseModel):
    """计划回滚请求"""
    target_version: int
    reason: Optional[str] = None


class PlanResponse(BaseResponse):
    """计划响应"""
    plan_id: str
    title: str
    status: str
    current_version: int
    content: Optional[str] = None


# ===== Task API =====

class TaskBatchUpdateRequest(BaseModel):
    """任务批量更新请求"""
    task_ids: List[str]
    updates: Dict[str, Any]  # status, priority, etc.
    confirm_token: Optional[str] = None


class TaskResponse(BaseModel):
    """任务响应"""
    id: str
    title: str
    status: str
    priority: int
    scheduled_start: Optional[str]
    scheduled_end: Optional[str]


# ===== RAG API =====

class RAGSourceRequest(BaseModel):
    """RAG数据源请求"""
    source_type: str  # local_dir
    path: str
    auto_sync: bool = True


class RAGSourceResponse(BaseResponse):
    """RAG数据源响应"""
    source_id: str
    source_type: str
    path: str
    status: str


class RAGIndexRequest(BaseModel):
    """RAG索引请求"""
    source_id: Optional[str] = None
    mode: str = "incremental"  # full, incremental


class RAGIndexResponse(BaseResponse):
    """RAG索引响应"""
    job_id: str
    status: str
    mode: str


class RAGIndexVersionResponse(BaseResponse):
    """RAG索引版本响应"""
    versions: List[Dict[str, Any]]
    active_version: Optional[str]


# ===== Tool API =====

class ToolExecuteRequest(BaseModel):
    """工具执行请求"""
    tool_name: str
    arguments: Dict[str, Any]
    confirm_token: Optional[str] = None


class ToolExecuteResponse(BaseResponse):
    """工具执行响应"""
    tool_name: str
    success: bool
    result: Any


# ===== Metrics API =====

class MetricsResponse(BaseResponse):
    """指标响应"""
    metrics: Dict[str, Any]
    
    
class HealthResponse(BaseModel):
    """健康检查响应"""
    status: str
    version: str
    timestamp: str
