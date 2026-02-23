"""
检索服务 V2 - 增强版
支持中文全文检索和更完善的混合检索策略
"""

import time
from dataclasses import dataclass
from typing import List, Optional, Dict, Any, Tuple

from sqlalchemy import select, text, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.models.rag import RAGChunk, RAGIndexVersion, RetrievalLog, RAGDocVersion, RAGDocument
from app.services.model_gateway import get_model_gateway
from app.services.rerank_service import get_rerank_service

logger = get_logger(__name__)


@dataclass
class RetrievalResult:
    """检索结果"""
    chunk_id: str
    content: str
    score: float
    doc_name: str
    section_path: Optional[str]
    page_number: Optional[int]
    source_path: str
    rank: int
    retrieval_method: str  # sparse, dense, hybrid


class RetrievalServiceV2:
    """
    增强版检索服务
    
    特性：
    1. 中文全文检索支持（zhparser）
    2. 更完善的混合检索策略
    3. 集成外部Rerank服务
    """
    
    def __init__(self):
        self.model_gateway = get_model_gateway()
        self.rerank_service = get_rerank_service()
        self.top_k = settings.RAG_TOP_K
        self.rerank_top_k = settings.RAG_RERANK_TOP_K
        self.use_chinese_fts = False  # 是否使用中文全文检索
    
    async def retrieve(
        self,
        query: str,
        db: AsyncSession,
        session_id: Optional[str] = None,
        trace_id: Optional[str] = None,
        top_k: int = None,
        use_rerank: bool = True,
    ) -> List[RetrievalResult]:
        """
        执行增强版混合检索
        
        Args:
            query: 查询文本
            db: 数据库会话
            session_id: 会话ID
            trace_id: 追踪ID
            top_k: 返回结果数量
            use_rerank: 是否使用重排序
        
        Returns:
            检索结果列表
        """
        start_time = time.time()
        top_k = top_k or self.top_k
        
        logger.info("retrieval_v2.start", query=query[:50], top_k=top_k)
        
        try:
            # 1. 查询归一化
            normalized_query = self._normalize_query(query)
            
            # 2. 获取当前激活的索引版本
            index_version = await self._get_active_index_version(db)
            
            # 3. 并行执行稀疏和稠密检索
            sparse_results = await self._sparse_search_chinese(
                normalized_query, top_k * 2, db
            ) if self.use_chinese_fts else await self._sparse_search(
                normalized_query, top_k * 2, db
            )
            
            dense_results = await self._dense_search(
                normalized_query, top_k * 2, db
            )
            
            # 4. RRF融合
            fused_results = self._rrf_fusion(sparse_results, dense_results, k=60)
            
            # 5. 重排序（如果启用）
            if use_rerank and len(fused_results) > top_k:
                candidates = [
                    {
                        "id": chunk_id,
                        "content": await self._get_chunk_content(chunk_id, db),
                        "score": score,
                        "metadata": {"original_rank": i},
                    }
                    for i, (chunk_id, score) in enumerate(fused_results[:self.rerank_top_k * 2])
                ]
                
                reranked = await self.rerank_service.rerank(
                    query=normalized_query,
                    documents=candidates,
                    top_k=self.rerank_top_k,
                )
                
                # 转换为统一格式
                fused_results = [(r.doc_id, r.score) for r in reranked]
            
            # 6. 格式化结果
            results = await self._format_results(fused_results[:top_k], db)
            
            # 7. 记录检索日志
            latency_ms = (time.time() - start_time) * 1000
            await self._log_retrieval(
                query=query,
                normalized_query=normalized_query,
                results=results,
                latency_ms=latency_ms,
                session_id=session_id,
                trace_id=trace_id,
                index_version_id=index_version.id if index_version else None,
                db=db,
            )
            
            logger.info(
                "retrieval_v2.completed",
                query=query[:50],
                result_count=len(results),
                latency_ms=round(latency_ms, 2),
            )
            
            return results
            
        except Exception as e:
            logger.error("retrieval_v2.failed", query=query[:50], error=str(e))
            raise
    
    async def _sparse_search_chinese(
        self,
        query: str,
        top_k: int,
        db: AsyncSession,
    ) -> List[Tuple[str, float]]:
        """
        中文稀疏检索（使用zhparser）
        
        需要PostgreSQL安装zhparser扩展
        """
        try:
            # 使用中文配置的tsvector
            sql = text("""
                SELECT 
                    c.id as chunk_id,
                    ts_rank_cd(
                        c.tsv, 
                        plainto_tsquery('chinese', :query),
                        32
                    ) as score
                FROM rag_chunks c
                JOIN rag_doc_versions v ON c.doc_version_id = v.id
                JOIN rag_documents d ON v.document_id = d.id
                WHERE c.tsv @@ plainto_tsquery('chinese', :query)
                AND d.status = 'indexed'
                ORDER BY score DESC
                LIMIT :top_k
            """)
            
            result = await db.execute(sql, {"query": query, "top_k": top_k})
            
            return [(row.chunk_id, float(row.score)) for row in result]
            
        except Exception as e:
            logger.warning("retrieval_v2.chinese_fts_failed", error=str(e))
            # 回退到普通检索
            return await self._sparse_search(query, top_k, db)
    
    async def _sparse_search(
        self,
        query: str,
        top_k: int,
        db: AsyncSession,
    ) -> List[Tuple[str, float]]:
        """标准稀疏检索"""
        try:
            sql = text("""
                SELECT 
                    c.id as chunk_id,
                    ts_rank_cd(c.tsv, plainto_tsquery('simple', :query), 32) as score
                FROM rag_chunks c
                JOIN rag_doc_versions v ON c.doc_version_id = v.id
                JOIN rag_documents d ON v.document_id = d.id
                WHERE c.tsv @@ plainto_tsquery('simple', :query)
                AND d.status = 'indexed'
                ORDER BY score DESC
                LIMIT :top_k
            """)
            
            result = await db.execute(sql, {"query": query, "top_k": top_k})
            
            return [(row.chunk_id, float(row.score)) for row in result]
            
        except Exception as e:
            logger.warning("retrieval_v2.sparse_search_failed", error=str(e))
            return []
    
    async def _dense_search(
        self,
        query: str,
        top_k: int,
        db: AsyncSession,
    ) -> List[Tuple[str, float]]:
        """稠密检索"""
        try:
            query_embedding = await self.model_gateway.embed([query])
            
            if not query_embedding or not query_embedding[0]:
                return []
            
            embedding = query_embedding[0]
            
            sql = text("""
                SELECT 
                    c.id as chunk_id,
                    1 - (c.embedding <=> :embedding::vector) as score
                FROM rag_chunks c
                JOIN rag_doc_versions v ON c.doc_version_id = v.id
                JOIN rag_documents d ON v.document_id = d.id
                WHERE c.embedding IS NOT NULL
                AND d.status = 'indexed'
                ORDER BY c.embedding <=> :embedding::vector
                LIMIT :top_k
            """)
            
            result = await db.execute(
                sql, 
                {"embedding": str(embedding), "top_k": top_k}
            )
            
            return [(row.chunk_id, float(row.score)) for row in result]
            
        except Exception as e:
            logger.warning("retrieval_v2.dense_search_failed", error=str(e))
            return []
    
    def _rrf_fusion(
        self,
        sparse_results: List[Tuple[str, float]],
        dense_results: List[Tuple[str, float]],
        k: int = 60,
    ) -> List[Tuple[str, float]]:
        """RRF融合"""
        scores: Dict[str, float] = {}
        
        for rank, (chunk_id, _) in enumerate(sparse_results):
            scores[chunk_id] = scores.get(chunk_id, 0) + 1.0 / (k + rank + 1)
        
        for rank, (chunk_id, _) in enumerate(dense_results):
            scores[chunk_id] = scores.get(chunk_id, 0) + 1.0 / (k + rank + 1)
        
        fused = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        return fused
    
    async def _get_chunk_content(self, chunk_id: str, db: AsyncSession) -> str:
        """获取块内容"""
        result = await db.execute(
            select(RAGChunk.content).where(RAGChunk.id == chunk_id)
        )
        row = result.scalar_one_or_none()
        return row or ""
    
    async def _format_results(
        self,
        ranked: List[Tuple[str, float]],
        db: AsyncSession,
    ) -> List[RetrievalResult]:
        """格式化结果"""
        results = []
        
        for rank, (chunk_id, score) in enumerate(ranked, 1):
            result = await db.execute(
                select(
                    RAGChunk,
                    RAGDocument.file_name,
                    RAGDocument.source_path,
                )
                .join(RAGDocVersion, RAGChunk.doc_version_id == RAGDocVersion.id)
                .join(RAGDocument, RAGDocVersion.document_id == RAGDocument.id)
                .where(RAGChunk.id == chunk_id)
            )
            row = result.first()
            
            if row:
                chunk, file_name, source_path = row
                results.append(RetrievalResult(
                    chunk_id=chunk_id,
                    content=chunk.content,
                    score=score,
                    doc_name=file_name,
                    section_path=chunk.section_path,
                    page_number=chunk.page_number,
                    source_path=source_path,
                    rank=rank,
                    retrieval_method="hybrid",
                ))
        
        return results
    
    async def _get_active_index_version(
        self,
        db: AsyncSession,
    ) -> Optional[RAGIndexVersion]:
        """获取当前激活的索引版本"""
        result = await db.execute(
            select(RAGIndexVersion)
            .where(RAGIndexVersion.is_active == True)
        )
        return result.scalar_one_or_none()
    
    async def _log_retrieval(
        self,
        query: str,
        normalized_query: str,
        results: List[RetrievalResult],
        latency_ms: float,
        session_id: Optional[str],
        trace_id: Optional[str],
        index_version_id: Optional[str],
        db: AsyncSession,
    ):
        """记录检索日志"""
        try:
            from uuid import uuid4
            
            log = RetrievalLog(
                id=str(uuid4()),
                query=query,
                query_normalized=normalized_query,
                session_id=session_id,
                trace_id=trace_id or str(uuid4()),
                index_version_id=index_version_id,
                retrieval_results=[
                    {
                        "chunk_id": r.chunk_id,
                        "score": r.score,
                        "rank": r.rank,
                    }
                    for r in results
                ],
                latency_ms=latency_ms,
            )
            
            db.add(log)
            await db.commit()
            
        except Exception as e:
            logger.warning("retrieval_v2.log_failed", error=str(e))
    
    def _normalize_query(self, query: str) -> str:
        """查询归一化"""
        normalized = " ".join(query.split())
        return normalized
    
    async def evaluate_confidence(
        self,
        query: str,
        results: List[RetrievalResult],
    ) -> float:
        """评估置信度"""
        if not results:
            return 0.0
        
        scores = [r.score for r in results]
        max_score = max(scores)
        
        confidence = min(max_score * 1.5, 1.0)
        
        if len(results) < 3:
            confidence *= 0.8
        
        return round(confidence, 2)


# 全局服务实例
_retrieval_service_v2: Optional[RetrievalServiceV2] = None


def get_retrieval_service_v2() -> RetrievalServiceV2:
    """获取检索服务V2单例"""
    global _retrieval_service_v2
    if _retrieval_service_v2 is None:
        _retrieval_service_v2 = RetrievalServiceV2()
    return _retrieval_service_v2
