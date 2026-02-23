"""
Chat API路由
处理聊天、问答、流式输出
"""

import json
import re
from typing import AsyncGenerator, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, Header
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.api.schemas import (
    ChatRequest,
    ConfidenceResponse,
)
from app.api.deps import get_db, get_trace_id, get_request_id
from app.graph.workflow import get_workflow
from app.graph.state import GraphState
from app.services.model_gateway import get_model_gateway, ModelProfile

logger = get_logger(__name__)
router = APIRouter()


async def generate_stream_response(
    state: GraphState,
    trace_id: str,
    request_id: str,
) -> AsyncGenerator[str, None]:
    """
    生成流式响应
    """
    # 首先发送meta事件
    meta_event = {
        "event": "meta",
        "data": {
            "trace_id": trace_id,
            "request_id": request_id,
            "session_id": state["session_id"],
        }
    }
    yield f"data: {json.dumps(meta_event, ensure_ascii=False)}\n\n"
    
    try:
        workflow = get_workflow()
        
        # 执行工作流
        result = await workflow.ainvoke(state)
        
        # 模拟流式输出（实际应该逐步yield）
        output = result.get("output", "")
        
        # 分段发送token
        chunk_size = settings.STREAM_CHUNK_SIZE
        for i in range(0, len(output), chunk_size):
            chunk = output[i:i+chunk_size]
            token_event = {
                "event": "token",
                "data": {"text": chunk}
            }
            yield f"data: {json.dumps(token_event, ensure_ascii=False)}\n\n"
        
        # 发送引用信息
        citations = result.get("citations", [])
        for citation in citations:
            citation_event = {
                "event": "citation",
                "data": citation
            }
            yield f"data: {json.dumps(citation_event, ensure_ascii=False)}\n\n"
        
        # 发送风险提示
        risk_message = result.get("risk_message")
        confidence = result.get("confidence", 1.0)
        if risk_message or confidence < 0.9:
            risk_event = {
                "event": "risk",
                "data": {
                    "confidence": confidence,
                    "message": risk_message or f"当前答案置信度为{confidence:.0%}，建议核验",
                }
            }
            yield f"data: {json.dumps(risk_event, ensure_ascii=False)}\n\n"
        
        # 发送结束事件
        done_event = {
            "event": "done",
            "data": {
                "trace_id": trace_id,
                "request_id": request_id,
            }
        }
        yield f"data: {json.dumps(done_event, ensure_ascii=False)}\n\n"
        
    except Exception as e:
        logger.error("chat.stream_error", error=str(e), trace_id=trace_id)
        error_event = {
            "event": "error",
            "data": {
                "code": "AI-5001",
                "message": str(e),
            }
        }
        yield f"data: {json.dumps(error_event, ensure_ascii=False)}\n\n"


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    session_id: Optional[str] = Header(None, alias="X-Session-Id"),
    db: AsyncSession = Depends(get_db),
):
    """
    流式聊天接口
    
    支持多轮对话、RAG问答、计划生成等
    """
    logger.info(
        "chat.stream_request",
        trace_id=trace_id,
        request_id=request_id,
        query=request.query[:50],
    )
    
    # 创建或获取会话
    effective_session_id = request.session_id or session_id or str(uuid4())
    
    # 构建初始状态
    messages = [HumanMessage(content=request.query)]
    
    state: GraphState = {
        "session_id": effective_session_id,
        "user_id": "default_user",  # TODO: 从认证获取
        "trace_id": trace_id,
        "request_id": request_id,
        "messages": messages,
        "intent": "chat",  # 将被classify_intent覆盖
        "query": request.query,
        "query_normalized": None,
        "retrieval_context": None,
        "citations": None,
        "plan_id": None,
        "plan_proposal": None,
        "plan_version": None,
        "user_confirmed": None,
        "task_ids": None,
        "tasks_to_modify": None,
        "output": None,
        "output_streaming": True,
        "confidence": 1.0,
        "risk_level": "low",
        "risk_message": None,
        "tool_calls": None,
        "tool_results": None,
        "status": "init",
        "error": None,
        "checkpoint": None,
        "metadata": request.context or {},
    }
    
    return StreamingResponse(
        generate_stream_response(state, trace_id, request_id),
        media_type="text/event-stream",
        headers={
            "X-Trace-Id": trace_id,
            "X-Request-Id": request_id,
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@router.post("/evaluate-confidence")
async def evaluate_confidence(
    query: str,
    answer: str,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
):
    """
    评估回答的置信度
    """
    gateway = get_model_gateway()
    
    # 使用Reviewer模型评估置信度
    review_prompt = f"""请评估以下问答对的置信度：

问题：{query}

回答：{answer}

请输出JSON格式：{{"confidence": 0.0-1.0, "risk_level": "low|medium|high"}}"""
    
    try:
        messages = [HumanMessage(content=review_prompt)]
        response = await gateway.generate(
            messages=messages,
            model_profile=ModelProfile.COST_EFFECTIVE,
            temperature=0.1,
        )
        
        # 解析响应（简化处理）
        json_match = re.search(r'\{[^}]+\}', response.content)
        if json_match:
            result = json.loads(json_match.group())
            confidence = result.get("confidence", 0.5)
            risk_level = result.get("risk_level", "medium")
        else:
            confidence = 0.5
            risk_level = "medium"
        
        return ConfidenceResponse(
            trace_id=trace_id,
            request_id=request_id,
            confidence=confidence,
            risk_level=risk_level,
            need_warning=confidence < 0.9,
        )
        
    except Exception as e:
        logger.error("chat.evaluate_confidence_error", error=str(e))
        return ConfidenceResponse(
            trace_id=trace_id,
            request_id=request_id,
            confidence=0.5,
            risk_level="high",
            need_warning=True,
        )
