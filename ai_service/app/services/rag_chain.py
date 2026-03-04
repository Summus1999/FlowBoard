"""
RAG检索链（LangChain LCEL风格）
实现完整的检索-重排-生成链条
"""

from typing import AsyncIterator, Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from datetime import datetime
import json

from langchain_core.runnables import Runnable, RunnableConfig
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.services.retrieval_service import get_retrieval_service, RetrievalResult
from app.services.model_gateway import get_model_gateway, ModelProfile
from app.services.prompt_version_manager import get_prompt_version_manager
from app.security.output_auditor import audit_output

# Sirchmunk检索服务（可选）
_sirchmunk_service = None

def get_sirchmunk_service():
    """获取Sirchmunk检索服务单例"""
    global _sirchmunk_service
    if _sirchmunk_service is None and getattr(settings, 'USE_SIRCHMUNK', False):
        from app.services.sirchmunk_retrieval_service import SirchmunkRetrievalService
        _sirchmunk_service = SirchmunkRetrievalService()
    return _sirchmunk_service

logger = get_logger(__name__)
LOW_CONFIDENCE_MESSAGE = (
    "当前答案置信度低于 90%，建议你点击引用核验关键结论，必要时让我继续补充检索。"
)


@dataclass
class Citation:
    """引用信息"""
    ref_id: str
    chunk_id: str
    content: str
    source: str  # 文件名
    section: Optional[str] = None
    page: Optional[int] = None
    score: float = 0.0


@dataclass
class RAGContext:
    """RAG上下文"""
    query: str
    query_normalized: str
    retrieval_results: List[RetrievalResult] = field(default_factory=list)
    citations: List[Citation] = field(default_factory=list)
    context_text: str = ""
    confidence: float = 0.0
    
    def to_dict(self) -> Dict:
        return {
            "query": self.query,
            "retrieval_results_count": len(self.retrieval_results),
            "citations_count": len(self.citations),
            "confidence": self.confidence,
        }


@dataclass
class RAGResponse:
    """RAG响应"""
    answer: str
    citations: List[Citation]
    confidence: float
    risk_level: str  # low, medium, high
    risk_message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def format_with_citations(self) -> str:
        """格式化带引用的回答"""
        return self.answer
    
    def get_citation_map(self) -> Dict[str, Dict]:
        """获取引用映射"""
        return {
            c.ref_id: {
                "source": c.source,
                "section": c.section,
                "page": c.page,
                "content_preview": c.content[:200] + "..." if len(c.content) > 200 else c.content,
            }
            for c in self.citations
        }


# RAG系统提示词
RAG_SYSTEM_TEMPLATE = """你是一个基于知识库的智能问答助手。请根据提供的参考资料回答问题。

重要规则：
1. 严格基于提供的参考资料回答，不要添加外部知识
2. 如果参考资料不足以回答问题，请明确告知用户
3. 使用引用标注信息来源，格式为 [ref-1], [ref-2] 等
4. 每个关键事实或数据都必须标注引用
5. 如果多个引用支持同一观点，可以标注多个 [ref-1][ref-2]

参考资料：
{context}

请根据以上资料回答用户问题。"""


class QueryNormalizationRunnable(Runnable[str, str]):
    """查询归一化Runnable"""
    
    def invoke(self, input: str, config: Optional[RunnableConfig] = None) -> str:
        """同步调用（不推荐使用）"""
        raise NotImplementedError("请使用ainvoke")
    
    async def ainvoke(self, input: str, config: Optional[RunnableConfig] = None) -> str:
        """异步归一化查询"""
        # 去除多余空白
        normalized = " ".join(input.split())
        
        # 中英文术语扩展（可选）
        # 例如：ML -> Machine Learning
        
        logger.debug("rag_chain.query_normalized", original=input, normalized=normalized)
        return normalized


class RetrievalRunnable(Runnable[str, RAGContext]):
    """检索Runnable - 支持传统检索和Sirchmunk检索"""
    
    def __init__(
        self,
        db: AsyncSession,
        session_id: Optional[str] = None,
        trace_id: Optional[str] = None,
        search_mode: str = "FAST",  # Sirchmunk模式: FAST, DEEP, FILENAME_ONLY
        knowledge_paths: Optional[List[str]] = None,
    ):
        self.db = db
        self.session_id = session_id
        self.trace_id = trace_id
        self.search_mode = search_mode
        self.knowledge_paths = knowledge_paths
        self.retrieval_service = get_retrieval_service()
        self.use_sirchmunk = getattr(settings, 'USE_SIRCHMUNK', False)
    
    def invoke(self, input: str, config: Optional[RunnableConfig] = None) -> RAGContext:
        raise NotImplementedError("请使用ainvoke")
    
    async def ainvoke(self, input: str, config: Optional[RunnableConfig] = None) -> RAGContext:
        """执行检索 - 根据配置选择传统或Sirchmunk检索"""
        logger.info("rag_chain.retrieval_start", query=input[:50], use_sirchmunk=self.use_sirchmunk)
        
        if self.use_sirchmunk:
            return await self._sirchmunk_retrieve(input)
        else:
            return await self._traditional_retrieve(input)
    
    async def _sirchmunk_retrieve(self, query: str) -> RAGContext:
        """使用Sirchmunk代理式检索"""
        sirchmunk_service = get_sirchmunk_service()
        if not sirchmunk_service:
            logger.warning("rag_chain.sirchmunk_not_initialized, falling back to traditional")
            return await self._traditional_retrieve(query)
        
        try:
            # 确保服务已初始化
            await sirchmunk_service.initialize()
            
            # 执行Sirchmunk检索
            result = await sirchmunk_service.search(
                query=query,
                paths=self.knowledge_paths,
                mode=self.search_mode,
                top_k_files=settings.RAG_TOP_K,
            )
            
            # 转换为RAGContext格式
            citations = []
            context_parts = []
            
            for i, file_result in enumerate(result.files, 1):
                ref_id = f"ref-{i}"
                
                # 合并文件中的所有证据片段
                evidence_content = "\n".join([
                    e.get("content", "") for e in file_result.get("evidence", [])
                ])
                
                citation = Citation(
                    ref_id=ref_id,
                    chunk_id=f"sirchmunk_{file_result.get('path', '')}",
                    content=evidence_content[:2000],  # 限制长度
                    source=file_result.get("file_name", ""),
                    section=None,
                    page=None,
                    score=file_result.get("relevance_score", 0.0),
                )
                citations.append(citation)
                
                context_parts.append(
                    f"\n[{ref_id}] {file_result.get('file_name', '')}\n{evidence_content[:2000]}\n"
                )
            
            context_text = "\n".join(context_parts)
            
            # 计算置信度
            confidence = result.confidence if hasattr(result, 'confidence') else 0.8
            
            logger.info(
                "rag_chain.sirchmunk_retrieval_complete",
                result_count=len(result.files),
                confidence=confidence,
                mode=self.search_mode,
            )
            
            return RAGContext(
                query=query,
                query_normalized=query,
                retrieval_results=[],  # Sirchmunk不使用传统RetrievalResult
                citations=citations,
                context_text=context_text,
                confidence=confidence,
            )
            
        except Exception as e:
            logger.error("rag_chain.sirchmunk_retrieval_failed", error=str(e))
            # 降级到传统检索
            logger.warning("rag_chain.falling_back_to_traditional")
            return await self._traditional_retrieve(query)
    
    async def _traditional_retrieve(self, query: str) -> RAGContext:
        """使用传统检索"""
        results = await self.retrieval_service.retrieve(
            query=query,
            db=self.db,
            session_id=self.session_id,
            trace_id=self.trace_id,
            top_k=settings.RAG_TOP_K,
        )
        
        # 评估置信度
        confidence = await self.retrieval_service.evaluate_confidence(query, results)
        
        # 构建引用
        citations = []
        context_parts = []
        
        for i, result in enumerate(results, 1):
            ref_id = f"ref-{i}"
            
            citation = Citation(
                ref_id=ref_id,
                chunk_id=result.chunk_id,
                content=result.content,
                source=result.doc_name,
                section=result.section_path,
                page=result.page_number,
                score=result.score,
            )
            citations.append(citation)
            
            # 构建上下文文本
            context_parts.append(f"\n[{ref_id}] {result.doc_name}\n{result.content}\n")
        
        context = "\n".join(context_parts)
        
        logger.info(
            "rag_chain.retrieval_complete",
            result_count=len(results),
            confidence=confidence,
        )
        
        return RAGContext(
            query=query,
            query_normalized=query,
            retrieval_results=results,
            citations=citations,
            context_text=context,
            confidence=confidence,
        )


class RerankRunnable(Runnable[RAGContext, RAGContext]):
    """重排序Runnable"""
    
    def __init__(self, top_k: int = None):
        self.top_k = top_k or settings.RAG_RERANK_TOP_K
        self.model_gateway = get_model_gateway()
    
    def invoke(self, input: RAGContext, config: Optional[RunnableConfig] = None) -> RAGContext:
        raise NotImplementedError("请使用ainvoke")
    
    async def ainvoke(self, input: RAGContext, config: Optional[RunnableConfig] = None) -> RAGContext:
        """执行重排序"""
        if not input.citations or len(input.citations) <= self.top_k:
            return input
        
        logger.info("rag_chain.rerank_start", candidate_count=len(input.citations))
        
        # 使用Cross-Encoder或LLM进行重排序
        # 这里使用简化的实现：基于原始分数重新排序
        
        # 按分数排序
        sorted_citations = sorted(
            input.citations,
            key=lambda c: c.score,
            reverse=True
        )[:self.top_k]
        
        # 重新编号引用
        for i, citation in enumerate(sorted_citations, 1):
            citation.ref_id = f"ref-{i}"
        
        # 更新上下文
        input.citations = sorted_citations
        input.context_text = self._rebuild_context(sorted_citations)
        
        logger.info("rag_chain.rerank_complete", top_k=len(sorted_citations))
        
        return input
    
    def _rebuild_context(self, citations: List[Citation]) -> str:
        """重建上下文文本"""
        parts = []
        for citation in citations:
            parts.append(f"\n[{citation.ref_id}] {citation.source}\n{citation.content}\n")
        return "\n".join(parts)


class AnswerGenerationRunnable(Runnable[RAGContext, RAGResponse]):
    """回答生成Runnable"""
    
    def __init__(self, stream: bool = False):
        self.stream = stream
        self.model_gateway = get_model_gateway()
        self.prompt_manager = get_prompt_version_manager()
    
    def invoke(self, input: RAGContext, config: Optional[RunnableConfig] = None) -> RAGResponse:
        raise NotImplementedError("请使用ainvoke")
    
    async def ainvoke(self, input: RAGContext, config: Optional[RunnableConfig] = None) -> RAGResponse:
        """生成回答"""
        logger.info("rag_chain.generation_start")
        
        # 构建prompt
        template = self.prompt_manager.get_prompt("rag_system", RAG_SYSTEM_TEMPLATE)
        system_prompt = template.format(context=input.context_text)
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=input.query),
        ]
        
        try:
            response = await self.model_gateway.generate(
                messages=messages,
                model_profile=ModelProfile.BALANCED,
                temperature=0.3,
            )
            
            answer = response.content
            
            # 确定风险等级
            risk_level, risk_message = self._assess_risk(input.confidence, answer)
            audit_result = audit_output(answer)
            if audit_result.blocked:
                risk_level = "high"
                risk_message = "输出包含高风险信息，已触发安全审查。"
                answer = "抱歉，当前内容触发了安全策略，请调整问题后重试。"
            
            logger.info(
                "rag_chain.generation_complete",
                answer_length=len(answer),
                risk_level=risk_level,
            )
            
            return RAGResponse(
                answer=answer,
                citations=input.citations,
                confidence=input.confidence,
                risk_level=risk_level,
                risk_message=risk_message,
                metadata={
                    "model": response.model,
                    "latency_ms": response.latency_ms,
                    "prompt_version": self.prompt_manager.get_active_version("rag_system"),
                    "output_audit_issues": audit_result.issues if audit_result.blocked else [],
                },
            )
            
        except Exception as e:
            logger.error("rag_chain.generation_failed", error=str(e))
            raise
    
    async def astream(
        self,
        input: RAGContext,
        config: Optional[RunnableConfig] = None,
    ) -> AsyncIterator[str]:
        """流式生成"""
        template = self.prompt_manager.get_prompt("rag_system", RAG_SYSTEM_TEMPLATE)
        system_prompt = template.format(context=input.context_text)
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=input.query),
        ]
        
        async for delta in self.model_gateway.generate_stream(
            messages=messages,
            model_profile=ModelProfile.BALANCED,
            temperature=0.3,
        ):
            yield delta.content
    
    def _assess_risk(self, confidence: float, answer: str) -> tuple:
        """评估风险等级"""
        if confidence < 0.7:
            return "high", LOW_CONFIDENCE_MESSAGE
        elif confidence < 0.9:
            return "medium", LOW_CONFIDENCE_MESSAGE
        else:
            return "low", None


class RAGChain:
    """
    RAG检索链（LangChain LCEL风格）
    
    链条: query_normalize -> retrieve -> rerank -> generate
    
    使用示例:
        chain = RAGChain(db=session)
        response = await chain.ainvoke("什么是Python？")
        
        # 使用Sirchmunk检索
        chain = RAGChain(db=session, search_mode="DEEP")
        response = await chain.ainvoke("什么是Python？")
    """
    
    def __init__(
        self,
        db: AsyncSession,
        session_id: Optional[str] = None,
        trace_id: Optional[str] = None,
        skip_rerank: bool = False,
        search_mode: str = "FAST",  # Sirchmunk模式
        knowledge_paths: Optional[List[str]] = None,
    ):
        self.db = db
        self.session_id = session_id
        self.trace_id = trace_id
        
        # 构建链条
        self.normalize_step = QueryNormalizationRunnable()
        self.retrieval_step = RetrievalRunnable(
            db=db,
            session_id=session_id,
            trace_id=trace_id,
            search_mode=search_mode,
            knowledge_paths=knowledge_paths,
        )
        self.rerank_step = None if skip_rerank else RerankRunnable()
        self.generation_step = AnswerGenerationRunnable()
    
    async def ainvoke(self, query: str) -> RAGResponse:
        """
        执行完整RAG链条
        
        Args:
            query: 用户查询
        
        Returns:
            RAGResponse: 包含回答、引用、置信度等信息
        """
        logger.info("rag_chain.start", query=query[:50])
        
        # 1. 查询归一化
        normalized_query = await self.normalize_step.ainvoke(query)
        
        # 2. 检索
        context = await self.retrieval_step.ainvoke(normalized_query)
        
        # 3. 重排序（如果启用）
        if self.rerank_step:
            context = await self.rerank_step.ainvoke(context)
        
        # 4. 生成回答
        response = await self.generation_step.ainvoke(context)
        
        logger.info("rag_chain.complete", citation_count=len(response.citations))
        
        return response
    
    async def astream(self, query: str) -> AsyncIterator[Dict[str, Any]]:
        """
        流式执行RAG链条
        
        Yields:
            {"type": "retrieval", "data": ...}
            {"type": "citation", "data": ...}
            {"type": "token", "data": ...}
            {"type": "risk", "data": ...}
            {"type": "done", "data": ...}
        """
        # 1. 查询归一化
        normalized_query = await self.normalize_step.ainvoke(query)
        
        # 2. 检索
        context = await self.retrieval_step.ainvoke(normalized_query)
        
        # 发送检索结果
        yield {
            "type": "retrieval",
            "data": {
                "result_count": len(context.retrieval_results),
                "confidence": context.confidence,
            }
        }
        
        # 发送引用
        for citation in context.citations:
            yield {
                "type": "citation",
                "data": {
                    "ref_id": citation.ref_id,
                    "source": citation.source,
                    "section": citation.section,
                    "page": citation.page,
                }
            }
        
        # 3. 重排序
        if self.rerank_step:
            context = await self.rerank_step.ainvoke(context)
        
        # 4. 流式生成
        full_answer = ""
        async for token in self.generation_step.astream(context):
            full_answer += token
            yield {"type": "token", "data": {"text": token}}
        
        # 5. 风险评估
        risk_level, risk_message = self.generation_step._assess_risk(
            context.confidence, full_answer
        )
        
        if risk_message:
            yield {
                "type": "risk",
                "data": {
                    "confidence": context.confidence,
                    "level": risk_level,
                    "message": risk_message,
                }
            }
        
        # 6. 完成
        yield {
            "type": "done",
            "data": {
                "answer": full_answer,
                "citations": [
                    {
                        "ref_id": c.ref_id,
                        "source": c.source,
                        "section": c.section,
                    }
                    for c in context.citations
                ],
                "confidence": context.confidence,
            }
        }


def create_rag_chain(
    db: AsyncSession,
    session_id: Optional[str] = None,
    trace_id: Optional[str] = None,
    search_mode: str = "FAST",
    knowledge_paths: Optional[List[str]] = None,
) -> RAGChain:
    """
    创建RAG链的工厂函数
    
    Args:
        db: 数据库会话
        session_id: 会话ID
        trace_id: 追踪ID
        search_mode: Sirchmunk搜索模式 (FAST, DEEP, FILENAME_ONLY)
        knowledge_paths: 知识库路径列表
    
    Returns:
        RAGChain实例
    """
    return RAGChain(
        db=db,
        session_id=session_id,
        trace_id=trace_id,
        search_mode=search_mode,
        knowledge_paths=knowledge_paths,
    )
