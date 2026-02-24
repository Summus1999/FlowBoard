"""
LangGraph节点定义
实现各Agent角色的具体逻辑
"""

import time
from datetime import datetime
from typing import Dict, Any

from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

from app.core.logging import get_logger
from app.core.exceptions import AIException
from app.services.model_gateway import get_model_gateway, ModelProfile
from app.services.prompt_version_manager import get_prompt_version_manager
from app.graph.state import GraphState, ProposalSummary

logger = get_logger(__name__)
prompt_manager = get_prompt_version_manager()
LOW_CONFIDENCE_MESSAGE = (
    "当前答案置信度低于 90%，建议你点击引用核验关键结论，必要时让我继续补充检索。"
)


# ===== 系统提示词 =====

PLANNER_SYSTEM_PROMPT = """你是一个专业的学习计划规划师。

你的职责：
1. 根据用户目标制定结构化的学习计划
2. 将长期目标拆分为可执行的里程碑和任务
3. 考虑用户的时间安排和学习节奏
4. 提供清晰的时间线和交付物

输出格式要求：
- 使用Markdown格式
- 包含目标概述、学习路径、里程碑、具体任务
- 每个任务包含预估时间和优先级
"""

DECOMPOSER_SYSTEM_PROMPT = """你是一个任务拆解专家。

你的职责：
1. 将计划中的大任务拆分为可执行的小任务
2. 定义任务间的依赖关系
3. 为每个任务分配合理的时间估计
4. 识别关键路径和阻塞点

输出格式要求：
- JSON格式，包含任务列表
- 每个任务包含: id, title, description, estimated_hours, dependencies, priority
"""

RAG_QA_SYSTEM_PROMPT = """你是一个知识问答助手，基于提供的参考资料回答问题。

你的职责：
1. 仔细分析提供的参考资料
2. 基于资料内容回答问题
3. 标注信息来源引用
4. 如果资料不足以回答问题，明确告知用户

引用格式：
使用 [ref-N] 格式标注引用，如 [ref-1], [ref-2]
"""

REVIEWER_SYSTEM_PROMPT = """你是一个质量审核专家。

你的职责：
1. 检查回答的准确性和一致性
2. 评估置信度（0-1之间）
3. 识别潜在风险和幻觉
4. 给出改进建议

输出JSON格式：
{
    "confidence": 0.92,
    "risk_level": "low", // low, medium, high
    "issues": [],
    "suggestions": []
}
"""


# ===== 节点函数 =====

async def load_context_node(state: GraphState) -> GraphState:
    """
    加载上下文节点
    加载会话历史、用户偏好、相关记忆
    """
    logger.info("graph.node.load_context", session_id=state["session_id"])
    
    # TODO: 从数据库加载历史消息和记忆
    # 这里简化处理，直接使用传入的messages
    
    state["status"] = "context_loaded"
    return state


async def classify_intent_node(state: GraphState) -> GraphState:
    """
    意图分类节点
    识别用户意图：plan, decompose, qa, review, chat
    """
    logger.info("graph.node.classify_intent", query=state["query"][:50])
    
    query = state["query"].lower()
    
    # 简单的规则分类，后续可以用模型分类
    if any(kw in query for kw in ["计划", "规划", "学习", "路线"]):
        intent = "plan"
    elif any(kw in query for kw in ["拆解", "分解", "任务", "步骤"]):
        intent = "decompose"
    elif any(kw in query for kw in ["总结", "复盘", "回顾", "进度"]):
        intent = "review"
    elif any(kw in query for kw in ["什么是", "怎么", "如何", "为什么", "解释"]):
        intent = "qa"
    else:
        intent = "chat"
    
    state["intent"] = intent
    state["status"] = "intent_classified"
    
    logger.info("graph.node.intent_classified", intent=intent)
    return state


async def planner_agent_node(state: GraphState) -> GraphState:
    """
    Planner Agent节点
    生成学习计划提案
    """
    logger.info("graph.node.planner_agent", session_id=state["session_id"])
    
    gateway = get_model_gateway()
    
    messages = [
        SystemMessage(content=prompt_manager.get_prompt("planner_system", PLANNER_SYSTEM_PROMPT)),
        *state["messages"],
        HumanMessage(content=f"请为我制定学习计划：{state['query']}"),
    ]
    
    try:
        # 使用高质量模型生成计划
        response = await gateway.generate(
            messages=messages,
            model_profile=ModelProfile.HIGH_QUALITY,
            temperature=0.7,
        )
        
        plan_content = response.content
        
        # 构建提案摘要
        proposal = ProposalSummary(
            title=f"学习计划：{state['query'][:30]}...",
            description="基于您的目标定制的学习计划",
            estimated_duration="3个月",
            milestones_count=3,
            tasks_count=12,
            impact_scope=["日历", "待办事项"],
        )
        
        state["plan_proposal"] = {
            "content": plan_content,
            "summary": proposal.__dict__,
        }
        state["output"] = proposal.to_confirmation_prompt()
        state["status"] = "proposal_ready"
        state["user_confirmed"] = None  # 等待用户确认
        
        # 添加AI消息到历史
        state["messages"] = list(state["messages"]) + [
            AIMessage(content=state["output"])
        ]
        
    except Exception as e:
        logger.error("graph.node.planner_error", error=str(e))
        state["error"] = str(e)
        state["status"] = "failed"
    
    return state


async def decomposer_agent_node(state: GraphState) -> GraphState:
    """
    Decomposer Agent节点
    拆解任务
    """
    logger.info("graph.node.decomposer_agent", session_id=state["session_id"])
    
    gateway = get_model_gateway()
    
    messages = [
        SystemMessage(content=prompt_manager.get_prompt("decomposer_system", DECOMPOSER_SYSTEM_PROMPT)),
        HumanMessage(content=f"请拆解以下任务：{state['query']}"),
    ]
    
    try:
        response = await gateway.generate(
            messages=messages,
            model_profile=ModelProfile.HIGH_QUALITY,
            temperature=0.5,
        )
        
        state["output"] = response.content
        state["status"] = "completed"
        
        state["messages"] = list(state["messages"]) + [
            AIMessage(content=state["output"])
        ]
        
    except Exception as e:
        logger.error("graph.node.decomposer_error", error=str(e))
        state["error"] = str(e)
        state["status"] = "failed"
    
    return state


async def rag_qa_agent_node(state: GraphState) -> GraphState:
    """
    RAG QA Agent节点
    基于检索结果回答问题
    """
    logger.info("graph.node.rag_qa_agent", session_id=state["session_id"])
    
    gateway = get_model_gateway()
    
    # 构建带引用的上下文
    context = ""
    citations = state.get("retrieval_context", [])
    
    if citations:
        for i, citation in enumerate(citations, 1):
            context += f"\n[ref-{i}] {citation.get('content', '')}\n"
    
    messages = [
        SystemMessage(content=prompt_manager.get_prompt("rag_qa_system", RAG_QA_SYSTEM_PROMPT)),
        HumanMessage(content=f"基于以下参考资料回答问题：\n\n{context}\n\n问题：{state['query']}"),
    ]
    
    try:
        response = await gateway.generate(
            messages=messages,
            model_profile=ModelProfile.BALANCED,
            temperature=0.3,
        )
        
        state["output"] = response.content
        state["citations"] = citations
        state["status"] = "completed"
        
        state["messages"] = list(state["messages"]) + [
            AIMessage(content=state["output"])
        ]
        
    except Exception as e:
        logger.error("graph.node.rag_qa_error", error=str(e))
        state["error"] = str(e)
        state["status"] = "failed"
    
    return state


async def reviewer_agent_node(state: GraphState) -> GraphState:
    """
    Reviewer Agent节点
    质量检查和风险评估
    """
    logger.info("graph.node.reviewer_agent", session_id=state["session_id"])
    
    gateway = get_model_gateway()
    
    # 如果没有输出，跳过审核
    if not state.get("output"):
        state["confidence"] = 0.5
        state["risk_level"] = "medium"
        return state
    
    messages = [
        SystemMessage(content=prompt_manager.get_prompt("reviewer_system", REVIEWER_SYSTEM_PROMPT)),
        HumanMessage(content=f"请审核以下内容：\n\n{state['output']}"),
    ]
    
    try:
        response = await gateway.generate(
            messages=messages,
            model_profile=ModelProfile.COST_EFFECTIVE,
            temperature=0.1,
        )
        
        # 解析审核结果
        # 简化处理，实际应该解析JSON
        state["confidence"] = 0.85
        state["risk_level"] = "low"
        
        # 如果置信度低于阈值，添加风险提示
        if state["confidence"] < 0.9:
            state["risk_message"] = LOW_CONFIDENCE_MESSAGE
        
    except Exception as e:
        logger.error("graph.node.reviewer_error", error=str(e))
        # 审核失败不影响主流程
        state["confidence"] = 0.5
        state["risk_level"] = "high"
        state["risk_message"] = "质量审核失败，请谨慎参考"
    
    return state


async def user_confirm_node(state: GraphState) -> GraphState:
    """
    用户确认节点
    处理用户确认/拒绝
    """
    logger.info("graph.node.user_confirm", session_id=state["session_id"])
    
    # 检查用户是否已确认
    confirmed = state.get("user_confirmed")
    
    if confirmed is None:
        # 等待用户确认，保持当前状态
        state["status"] = "waiting_confirm"
    elif confirmed is True:
        state["status"] = "confirmed"
        logger.info("graph.node.user_confirmed")
    else:
        state["status"] = "rejected"
        state["output"] = "计划已取消。如需重新制定，请告诉我。"
        logger.info("graph.node.user_rejected")
    
    return state


async def execute_tools_node(state: GraphState) -> GraphState:
    """
    工具执行节点
    执行日历、待办等工具调用
    """
    logger.info("graph.node.execute_tools", session_id=state["session_id"])
    
    # TODO: 实现工具调用逻辑
    # 创建日历事件、待办事项等
    
    state["status"] = "executing"
    return state


async def memory_write_node(state: GraphState) -> GraphState:
    """
    记忆写入节点
    保存到短期和长期记忆
    """
    logger.info("graph.node.memory_write", session_id=state["session_id"])
    
    # TODO: 实现记忆保存逻辑
    
    state["status"] = "completed"
    return state


async def chat_node(state: GraphState) -> GraphState:
    """
    普通聊天节点
    处理非特定意图的对话
    """
    logger.info("graph.node.chat", session_id=state["session_id"])
    
    gateway = get_model_gateway()
    
    try:
        response = await gateway.generate(
            messages=state["messages"],
            model_profile=ModelProfile.BALANCED,
            temperature=0.7,
        )
        
        state["output"] = response.content
        state["status"] = "completed"
        
        state["messages"] = list(state["messages"]) + [
            AIMessage(content=state["output"])
        ]
        
    except Exception as e:
        logger.error("graph.node.chat_error", error=str(e))
        state["error"] = str(e)
        state["status"] = "failed"
    
    return state
