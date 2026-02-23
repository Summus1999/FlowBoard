"""
LangGraph工作流定义
组装各节点和边，构建完整的工作流
"""

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from app.core.logging import get_logger
from app.graph.state import GraphState
from app.graph.nodes import (
    load_context_node,
    classify_intent_node,
    planner_agent_node,
    decomposer_agent_node,
    rag_qa_agent_node,
    reviewer_agent_node,
    user_confirm_node,
    execute_tools_node,
    memory_write_node,
    chat_node,
)
from app.graph.edges import (
    route_by_intent,
    check_confirmation,
    check_risk,
    should_continue_execution,
)

logger = get_logger(__name__)


def create_workflow() -> StateGraph:
    """
    创建LangGraph工作流
    
    工作流结构：
    INIT -> CONTEXT_LOAD -> INTENT_CLASSIFY -> [PLAN|DECOMPOSE|QA|CHAT]
    PLAN -> USER_CONFIRM -> EXECUTION -> MEMORY_WRITE -> END
    """
    
    # 创建工作流
    workflow = StateGraph(GraphState)
    
    # 添加节点
    workflow.add_node("load_context", load_context_node)
    workflow.add_node("classify_intent", classify_intent_node)
    workflow.add_node("planner", planner_agent_node)
    workflow.add_node("decomposer", decomposer_agent_node)
    workflow.add_node("rag_qa", rag_qa_agent_node)
    workflow.add_node("reviewer", reviewer_agent_node)
    workflow.add_node("user_confirm", user_confirm_node)
    workflow.add_node("execute_tools", execute_tools_node)
    workflow.add_node("memory_write", memory_write_node)
    workflow.add_node("chat", chat_node)
    
    # 设置入口点
    workflow.set_entry_point("load_context")
    
    # 添加边
    workflow.add_edge("load_context", "classify_intent")
    
    # 意图分类后的条件路由
    workflow.add_conditional_edges(
        "classify_intent",
        route_by_intent,
        {
            "planner": "planner",
            "decomposer": "decomposer",
            "rag_qa": "rag_qa",
            "chat": "chat",
        }
    )
    
    # Planner流程：需要用户确认
    workflow.add_edge("planner", "user_confirm")
    workflow.add_conditional_edges(
        "user_confirm",
        check_confirmation,
        {
            "execute": "execute_tools",
            "wait": END,  # 等待用户确认，结束当前执行
            "end": END,
        }
    )
    
    # Decomposer流程
    workflow.add_edge("decomposer", "reviewer")
    
    # RAG QA流程
    workflow.add_edge("rag_qa", "reviewer")
    
    # Chat流程
    workflow.add_edge("chat", "memory_write")
    
    # Reviewer后的流程
    workflow.add_edge("reviewer", "memory_write")
    
    # 工具执行后的流程
    workflow.add_edge("execute_tools", "memory_write")
    
    # 记忆写入后结束
    workflow.add_edge("memory_write", END)
    
    return workflow


def create_compiled_workflow(checkpointer=None):
    """
    创建编译后的工作流
    
    Args:
        checkpointer: 状态检查点器，用于持久化和恢复
    
    Returns:
        编译后的工作流
    """
    workflow = create_workflow()
    
    # 如果没有提供checkpointer，使用内存检查点
    if checkpointer is None:
        checkpointer = MemorySaver()
    
    compiled = workflow.compile(
        checkpointer=checkpointer,
        interrupt_before=["user_confirm"],  # 在需要用户确认的节点前中断
    )
    
    logger.info("graph.workflow_compiled")
    return compiled


# 全局工作流实例
_workflow = None


def get_workflow():
    """获取编译后的工作流实例"""
    global _workflow
    if _workflow is None:
        _workflow = create_compiled_workflow()
    return _workflow
