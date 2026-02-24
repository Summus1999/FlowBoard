"""
Chat API路由
处理聊天、问答、流式输出
"""

import json
import re
from typing import AsyncGenerator, List, Optional
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
from app.api.sse import sse_event
from app.core.exceptions import RetrievalTimeoutException
from app.graph.workflow import get_workflow
from app.graph.state import GraphState
from app.services.model_gateway import get_model_gateway, ModelProfile
from app.services.rag_chain import create_rag_chain, RAGResponse
from app.services.evaluation_service import get_qa_evaluator
from app.security.input_filter import validate_user_input
from app.utils.citation import (
    CitationFormatter,
    format_citation_for_frontend,
    validate_citations_from_text,
)

logger = get_logger(__name__)
router = APIRouter()
LOW_CONFIDENCE_MESSAGE = (
    "当前答案置信度低于 90%，建议你点击引用核验关键结论，必要时让我继续补充检索。"
)


async def generate_stream_response(
    state: GraphState,
    trace_id: str,
    request_id: str,
) -> AsyncGenerator[str, None]:
    """
    生成流式响应（基于LangGraph工作流）
    """
    # 首先发送meta事件
    yield sse_event(
        "meta",
        {
            "trace_id": trace_id,
            "request_id": request_id,
            "session_id": state["session_id"],
        },
    )
    
    try:
        workflow = get_workflow()
        
        # 执行工作流
        result = await workflow.ainvoke(state)
        
        # 模拟流式输出
        output = result.get("output", "")
        
        # 分段发送token
        chunk_size = settings.STREAM_CHUNK_SIZE
        for i in range(0, len(output), chunk_size):
            chunk = output[i:i+chunk_size]
            yield sse_event("token", {"text": chunk})
        
        # 发送引用信息
        citations = result.get("citations", [])
        for citation in citations:
            yield sse_event("citation", citation)
        
        # 发送风险提示
        risk_message = result.get("risk_message")
        confidence = result.get("confidence", 1.0)
        if risk_message or confidence < 0.9:
            yield sse_event(
                "risk",
                {
                    "confidence": confidence,
                    "message": risk_message or LOW_CONFIDENCE_MESSAGE,
                },
            )
        
        # 发送结束事件
        yield sse_event(
            "done",
            {
                "trace_id": trace_id,
                "request_id": request_id,
            },
        )
        
    except Exception as e:
        logger.error("chat.stream_error", error=str(e), trace_id=trace_id)
        yield sse_event(
            "error",
            {
                "code": "AI-5001",
                "message": str(e),
                "trace_id": trace_id,
                "request_id": request_id,
            },
        )


async def _stream_direct_fallback_answer(
    query: str,
    trace_id: str,
    request_id: str,
    reason: str,
) -> AsyncGenerator[str, None]:
    gateway = get_model_gateway()
    messages = [HumanMessage(content=f"请直接回答用户问题，并明确这是基于非检索模式：{query}")]
    response = await gateway.generate(
        messages=messages,
        model_profile=ModelProfile.COST_EFFECTIVE,
        temperature=0.3,
    )
    if response.content:
        yield sse_event("token", {"text": response.content})
    yield sse_event(
        "risk",
        {
            "confidence": 0.0,
            "message": LOW_CONFIDENCE_MESSAGE,
            "reason": reason,
            "no_citation_flag": True,
        },
    )
    yield sse_event(
        "done",
        {
            "trace_id": trace_id,
            "request_id": request_id,
            "no_citation_flag": True,
        },
    )


async def generate_rag_stream(
    query: str,
    db: AsyncSession,
    session_id: str,
    trace_id: str,
    request_id: str,
) -> AsyncGenerator[str, None]:
    """
    生成RAG流式响应（使用新的RAGChain）
    """
    # 发送meta事件
    yield sse_event(
        "meta",
        {
            "trace_id": trace_id,
            "request_id": request_id,
            "session_id": session_id,
        },
    )
    
    try:
        # 创建RAG链
        chain = create_rag_chain(
            db=db,
            session_id=session_id,
            trace_id=trace_id,
        )
        
        # 流式执行
        async for event in chain.astream(query):
            event_type = event.get("type")
            data = event.get("data", {})
            if event_type == "retrieval":
                continue
            if event_type == "risk":
                data["message"] = data.get("message") or LOW_CONFIDENCE_MESSAGE
            if event_type == "done":
                data["trace_id"] = trace_id
                data["request_id"] = request_id
            yield sse_event(event_type, data)

    except RetrievalTimeoutException as exc:
        logger.warning("chat.retrieval_timeout_degraded", trace_id=trace_id, error=str(exc))
        async for frame in _stream_direct_fallback_answer(
            query=query,
            trace_id=trace_id,
            request_id=request_id,
            reason="retrieval_timeout",
        ):
            yield frame
    except Exception as e:
        logger.error("chat.rag_stream_error", error=str(e), trace_id=trace_id)
        if settings.RAG_DEGRADE_ON_TIMEOUT:
            async for frame in _stream_direct_fallback_answer(
                query=query,
                trace_id=trace_id,
                request_id=request_id,
                reason="retrieval_failed",
            ):
                yield frame
        else:
            yield sse_event(
                "error",
                {
                    "code": "AI-5002",
                    "message": f"retrieval failed: {str(e)}",
                    "trace_id": trace_id,
                    "request_id": request_id,
                },
            )


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
    validate_user_input(request.query)
    
    # 创建或获取会话
    effective_session_id = request.session_id or session_id or str(uuid4())
    
    # 判断是否为知识问答模式
    if request.mode == "qa" or request.mode == "auto":
        # 使用新的RAG链
        return StreamingResponse(
            generate_rag_stream(
                query=request.query,
                db=db,
                session_id=effective_session_id,
                trace_id=trace_id,
                request_id=request_id,
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        )
    else:
        # 使用LangGraph工作流
        messages = [HumanMessage(content=request.query)]
        
        state: GraphState = {
            "session_id": effective_session_id,
            "user_id": "default_user",
            "trace_id": trace_id,
            "request_id": request_id,
            "messages": messages,
            "intent": "chat",
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
    db: AsyncSession = Depends(get_db),
):
    """
    评估回答的置信度（使用完整的评估服务）
    """
    try:
        # 首先使用模型评估
        gateway = get_model_gateway()
        
        review_prompt = f"""请评估以下问答对的置信度：

问题：{query}

回答：{answer}

请输出JSON格式：{{"confidence": 0.0-1.0, "risk_level": "low|medium|high", "reason": "原因说明"}}"""
        
        messages = [HumanMessage(content=review_prompt)]
        response = await gateway.generate(
            messages=messages,
            model_profile=ModelProfile.COST_EFFECTIVE,
            temperature=0.1,
        )
        
        # 解析响应
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


@router.post("/evaluate-answer")
async def evaluate_answer(
    query: str,
    answer: str,
    reference_docs: Optional[List[str]] = None,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
):
    """
    评估回答质量
    
    评估维度：忠实度、完整性、简洁性
    """
    try:
        evaluator = get_qa_evaluator()
        
        # 构建参考文档
        chunks = [{"content": doc} for doc in (reference_docs or [])]
        
        scores = await evaluator.evaluate_answer(query, answer, chunks)
        
        return {
            "trace_id": trace_id,
            "request_id": request_id,
            "scores": scores,
            "is_good_answer": scores["overall"] >= 0.7,
        }
        
    except Exception as e:
        logger.error("chat.evaluate_answer_error", error=str(e))
        return {
            "trace_id": trace_id,
            "request_id": request_id,
            "error": str(e),
        }


@router.post("/rag-query")
async def rag_query(
    query: str,
    top_k: int = 5,
    include_citations: bool = True,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    session_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    RAG查询接口（非流式）
    
    完整的RAG流程：检索 -> 重排 -> 生成
    """
    logger.info("chat.rag_query", query=query[:50], top_k=top_k)
    validate_user_input(query)
    
    try:
        # 创建RAG链
        chain = create_rag_chain(
            db=db,
            session_id=session_id,
            trace_id=trace_id,
        )
        
        # 执行查询
        response: RAGResponse = await chain.ainvoke(query)
        
        # 格式化引用
        citations_data = []
        if include_citations:
            for i, citation in enumerate(response.citations, 1):
                citations_data.append(format_citation_for_frontend(
                    chunk_id=citation.chunk_id,
                    doc_name=citation.source,
                    source_path=citation.metadata.get("source_path", ""),
                    section=citation.section,
                    page=citation.page,
                    content=citation.content,
                    rank=i,
                ))
        
        return {
            "trace_id": trace_id,
            "request_id": request_id,
            "query": query,
            "answer": response.answer,
            "citations": citations_data,
            "confidence": response.confidence,
            "risk_level": response.risk_level,
            "risk_message": response.risk_message,
            "metadata": response.metadata,
        }
        
    except Exception as e:
        logger.error("chat.rag_query_error", error=str(e))
        return {
            "trace_id": trace_id,
            "request_id": request_id,
            "error": str(e),
        }
