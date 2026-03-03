"""
LangGraph边条件定义
定义状态转换的条件逻辑
"""

from typing import Literal

from app.core.logging import get_logger
from app.graph.state import GraphState

logger = get_logger(__name__)


def route_by_intent(state: GraphState) -> Literal["planner", "decomposer", "rag_qa", "chat"]:
    """
    根据意图路由到不同Agent
    """
    intent = state.get("intent", "chat")
    
    routing_map = {
        "plan": "planner",
        "decompose": "decomposer",
        "qa": "rag_qa",
        "chat": "chat",
    }
    
    next_node = routing_map.get(intent, "chat")
    logger.info("graph.edge.route_by_intent", intent=intent, next=next_node)
    
    return next_node


def check_confirmation(state: GraphState) -> Literal["execute", "wait", "end"]:
    """
    检查确认状态
    """
    confirmed = state.get("user_confirmed")
    status = state.get("status")
    
    if status == "rejected":
        return "end"
    elif confirmed is True:
        return "execute"
    else:
        return "wait"


def check_risk(state: GraphState) -> Literal["review", "output"]:
    """
    检查风险等级
    """
    confidence = state.get("confidence", 0.0)
    
    if confidence < 0.7:
        return "review"
    return "output"


def check_error(state: GraphState) -> Literal["error", "continue"]:
    """
    检查是否有错误
    """
    if state.get("error"):
        return "error"
    return "continue"


def should_continue_execution(state: GraphState) -> Literal["execute_tools", "memory_write", "end"]:
    """
    决定是否继续执行
    """
    intent = state.get("intent")
    confirmed = state.get("user_confirmed")
    
    # 计划类意图需要执行工具
    if intent == "plan" and confirmed:
        return "execute_tools"
    
    return "memory_write"
