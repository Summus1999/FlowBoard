"""
LangGraph Integration Nodes for CrewAI

This module provides LangGraph workflow nodes that integrate
crewAI crews with FlowBoard's existing graph-based workflow system.

These nodes allow gradual migration from the current LangGraph
implementation to crewAI while maintaining backward compatibility.
"""

import json
from typing import Any, Dict, Optional
from datetime import datetime

from app.graph.state import GraphState
from app.crews.learning_crew import (
    create_planning_crew,
    create_decomposition_crew,
    create_review_crew,
    get_crew_executor,
)
from app.crews.callbacks import SSECallbackHandler, create_sse_callback_handler
from app.core.logging import get_logger

logger = get_logger(__name__)


async def planner_crew_node(state: GraphState) -> GraphState:
    """
    LangGraph node that uses crewAI for planning.
    
    This node replaces the original planner_agent_node with
    crewAI-based planning while maintaining the same interface.
    
    Args:
        state: Current graph state
        
    Returns:
        Updated graph state with plan proposal
    """
    logger.info(
        "crew_node.planner_start",
        session_id=state.get("session_id"),
        query=state.get("query", "")[:50],
    )
    
    try:
        # Extract planning parameters from state
        query = state.get("query", "")
        metadata = state.get("metadata", {})
        
        target_date = metadata.get("target_date")
        weekly_hours = metadata.get("weekly_hours", 10)
        constraints = metadata.get("constraints", [])
        
        # Create and execute planning crew
        crew = create_planning_crew(
            goal_description=query,
            target_date=target_date,
            weekly_hours=weekly_hours,
            constraints=constraints,
            verbose=False,  # Reduce noise in production
        )
        
        # Execute crew (synchronous)
        result = crew.kickoff()
        
        # Extract result content
        result_content = result.raw if hasattr(result, 'raw') else str(result)
        result_json = result.json_dict if hasattr(result, 'json_dict') else None
        
        # Build plan proposal for state
        plan_proposal = {
            "content": result_content,
            "json_data": result_json,
            "generated_by": "crewai_planner",
            "generated_at": datetime.now().isoformat(),
        }
        
        # Update state
        state["plan_proposal"] = plan_proposal
        state["output"] = _format_plan_output(result_content, result_json)
        state["status"] = "proposal_ready"
        state["user_confirmed"] = None  # Awaiting confirmation
        state["confidence"] = 0.85  # Default confidence for crew output
        state["risk_level"] = "low"
        
        logger.info(
            "crew_node.planner_complete",
            session_id=state.get("session_id"),
        )
        
    except Exception as e:
        logger.error(
            "crew_node.planner_error",
            session_id=state.get("session_id"),
            error=str(e),
        )
        state["error"] = str(e)
        state["status"] = "failed"
    
    return state


async def decomposer_crew_node(state: GraphState) -> GraphState:
    """
    LangGraph node that uses crewAI for task decomposition.
    
    This node replaces the original decomposer_agent_node with
    crewAI-based decomposition.
    
    Args:
        state: Current graph state
        
    Returns:
        Updated graph state with decomposition result
    """
    logger.info(
        "crew_node.decomposer_start",
        session_id=state.get("session_id"),
    )
    
    try:
        query = state.get("query", "")
        metadata = state.get("metadata", {})
        
        # Parse task information from query
        task_title = metadata.get("task_title", query[:50])
        task_description = metadata.get("task_description", query)
        estimated_hours = metadata.get("estimated_hours", 8.0)
        
        # Create and execute decomposition crew
        crew = create_decomposition_crew(
            task_title=task_title,
            task_description=task_description,
            estimated_hours=estimated_hours,
            verbose=False,
        )
        
        result = crew.kickoff()
        
        result_content = result.raw if hasattr(result, 'raw') else str(result)
        result_json = result.json_dict if hasattr(result, 'json_dict') else None
        
        # Update state
        state["output"] = result_content
        state["status"] = "completed"
        state["confidence"] = 0.85
        state["risk_level"] = "low"
        
        # Store decomposition data in metadata
        if result_json:
            state["metadata"] = {
                **state.get("metadata", {}),
                "decomposition_result": result_json,
            }
        
        logger.info(
            "crew_node.decomposer_complete",
            session_id=state.get("session_id"),
        )
        
    except Exception as e:
        logger.error(
            "crew_node.decomposer_error",
            session_id=state.get("session_id"),
            error=str(e),
        )
        state["error"] = str(e)
        state["status"] = "failed"
    
    return state


async def reviewer_crew_node(state: GraphState) -> GraphState:
    """
    LangGraph node that uses crewAI for progress review.
    
    This node replaces the original reviewer_agent_node with
    crewAI-based review generation.
    
    Args:
        state: Current graph state
        
    Returns:
        Updated graph state with review result
    """
    logger.info(
        "crew_node.reviewer_start",
        session_id=state.get("session_id"),
    )
    
    try:
        metadata = state.get("metadata", {})
        
        # Extract review parameters
        period = metadata.get("review_period", "weekly")
        tasks_data = metadata.get("tasks_data", "[]")
        start_date = metadata.get("start_date")
        end_date = metadata.get("end_date")
        
        # Default dates if not provided
        if not end_date:
            end_date = datetime.now().isoformat()
        if not start_date:
            from datetime import timedelta
            period_days = {"daily": 1, "weekly": 7, "monthly": 30}.get(period, 7)
            start_dt = datetime.now() - timedelta(days=period_days)
            start_date = start_dt.isoformat()
        
        # Ensure tasks_data is a string
        if isinstance(tasks_data, list):
            tasks_data = json.dumps(tasks_data, ensure_ascii=False)
        
        # Create and execute review crew
        crew = create_review_crew(
            period=period,
            tasks_data=tasks_data,
            start_date=start_date,
            end_date=end_date,
            verbose=False,
        )
        
        result = crew.kickoff()
        
        result_content = result.raw if hasattr(result, 'raw') else str(result)
        result_json = result.json_dict if hasattr(result, 'json_dict') else None
        
        # Update state
        state["output"] = result_content
        state["status"] = "completed"
        state["confidence"] = 0.9
        state["risk_level"] = "low"
        
        # Store review data
        if result_json:
            state["metadata"] = {
                **state.get("metadata", {}),
                "review_result": result_json,
            }
        
        logger.info(
            "crew_node.reviewer_complete",
            session_id=state.get("session_id"),
        )
        
    except Exception as e:
        logger.error(
            "crew_node.reviewer_error",
            session_id=state.get("session_id"),
            error=str(e),
        )
        state["error"] = str(e)
        state["status"] = "failed"
    
    return state


def _format_plan_output(content: str, json_data: Optional[Dict]) -> str:
    """
    Format plan output for user display.
    
    Args:
        content: Raw content from crew
        json_data: Structured JSON data if available
        
    Returns:
        Formatted output string
    """
    if json_data:
        # Format from structured data
        title = json_data.get("title", "学习计划")
        overview = json_data.get("overview", "")
        milestones = json_data.get("milestones", [])
        
        output_parts = [
            f"## {title}",
            "",
            overview,
            "",
            "### 里程碑",
        ]
        
        for i, ms in enumerate(milestones, 1):
            ms_title = ms.get("title", f"里程碑 {i}")
            ms_duration = ms.get("duration_days", "?")
            output_parts.append(f"{i}. **{ms_title}** ({ms_duration}天)")
        
        output_parts.extend([
            "",
            "---",
            "请确认是否执行此计划？(yes/no)",
        ])
        
        return "\n".join(output_parts)
    
    # Fallback to raw content
    return content


# Alternative routing function for workflow integration
def should_use_crew(state: GraphState) -> bool:
    """
    Determine if crewAI should be used for the current state.
    
    This function can be used in conditional edges to decide
    whether to route to crew nodes or original nodes.
    
    Args:
        state: Current graph state
        
    Returns:
        True if crew should be used
    """
    metadata = state.get("metadata", {})
    
    # Check if crew is explicitly requested
    if metadata.get("use_crew", False):
        return True
    
    # Check if feature flag is enabled (could be from config)
    if metadata.get("enable_crewai", False):
        return True
    
    # Default to original implementation
    return False


def create_crew_enabled_workflow():
    """
    Create a workflow with optional crew routing.
    
    This function demonstrates how to modify the existing workflow
    to conditionally use crewAI nodes.
    
    Returns:
        Modified workflow with crew support
    """
    from langgraph.graph import StateGraph, END
    from app.graph.state import GraphState
    from app.graph.nodes import (
        load_context_node,
        classify_intent_node,
        planner_agent_node,  # Original node
        decomposer_agent_node,  # Original node
        reviewer_agent_node,  # Original node
        rag_qa_agent_node,
        user_confirm_node,
        execute_tools_node,
        memory_write_node,
        chat_node,
    )
    from app.graph.edges import (
        route_by_intent,
        check_confirmation,
    )
    
    workflow = StateGraph(GraphState)
    
    # Add all nodes
    workflow.add_node("load_context", load_context_node)
    workflow.add_node("classify_intent", classify_intent_node)
    
    # Original nodes
    workflow.add_node("planner", planner_agent_node)
    workflow.add_node("decomposer", decomposer_agent_node)
    workflow.add_node("reviewer", reviewer_agent_node)
    
    # Crew nodes
    workflow.add_node("planner_crew", planner_crew_node)
    workflow.add_node("decomposer_crew", decomposer_crew_node)
    workflow.add_node("reviewer_crew", reviewer_crew_node)
    
    # Other nodes
    workflow.add_node("rag_qa", rag_qa_agent_node)
    workflow.add_node("user_confirm", user_confirm_node)
    workflow.add_node("execute_tools", execute_tools_node)
    workflow.add_node("memory_write", memory_write_node)
    workflow.add_node("chat", chat_node)
    
    # Entry point
    workflow.set_entry_point("load_context")
    
    # Edges
    workflow.add_edge("load_context", "classify_intent")
    
    # Intent routing with crew option
    def route_with_crew_option(state: GraphState) -> str:
        """Route based on intent and crew preference."""
        intent = state.get("intent", "chat")
        use_crew = should_use_crew(state)
        
        if intent == "plan":
            return "planner_crew" if use_crew else "planner"
        elif intent == "decompose":
            return "decomposer_crew" if use_crew else "decomposer"
        elif intent == "review":
            return "reviewer_crew" if use_crew else "reviewer"
        elif intent == "qa":
            return "rag_qa"
        else:
            return "chat"
    
    workflow.add_conditional_edges(
        "classify_intent",
        route_with_crew_option,
        {
            "planner": "planner",
            "planner_crew": "planner_crew",
            "decomposer": "decomposer",
            "decomposer_crew": "decomposer_crew",
            "reviewer": "reviewer",
            "reviewer_crew": "reviewer_crew",
            "rag_qa": "rag_qa",
            "chat": "chat",
        }
    )
    
    # Connect crew nodes to same downstream flow as original nodes
    workflow.add_edge("planner", "user_confirm")
    workflow.add_edge("planner_crew", "user_confirm")
    
    workflow.add_edge("decomposer", "memory_write")
    workflow.add_edge("decomposer_crew", "memory_write")
    
    workflow.add_edge("reviewer", "memory_write")
    workflow.add_edge("reviewer_crew", "memory_write")
    
    workflow.add_edge("rag_qa", "memory_write")
    workflow.add_edge("chat", "memory_write")
    
    workflow.add_conditional_edges(
        "user_confirm",
        check_confirmation,
        {
            "execute": "execute_tools",
            "wait": END,
            "end": END,
        }
    )
    
    workflow.add_edge("execute_tools", "memory_write")
    workflow.add_edge("memory_write", END)
    
    return workflow


# Exports
__all__ = [
    "planner_crew_node",
    "decomposer_crew_node",
    "reviewer_crew_node",
    "should_use_crew",
    "create_crew_enabled_workflow",
]
