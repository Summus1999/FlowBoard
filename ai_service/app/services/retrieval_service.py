"""
检索服务
混合检索：稀疏检索（BM25）+ 稠密检索（向量）
"""

import time
from dataclasses import dataclass
from typing import List, Optional, Dict, Any, Tuple

from sqlalchemy import select, text, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import array

from app.core.config import settings
from app.core.logging import get_logger
from app.models.rag import RAGChunk, RAGIndexVersion, RetrievalLog, RAGDocVersion, RAGDocument
from app.services.model_gateway import get_model_gateway

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


class RetrievalService:
    """
    检索服务
    
    实现混合检索：
    1. 稀疏检索：PostgreSQL FTS (BM25近似)
    2. 稠密检索：pgvector ANN
    3. RRF融合：Reciprocal Rank Fusion
    4. 重排序：Cross-Encoder
    """
    
    def __init__(self):
        self.model_gateway = get_model_gateway()
        self.top_k = settings.RAG_TOP_K
        self.rerank_top_k = settings.RAG_RERANK_TOP_K
    
    async def retrieve(
        self,
        query: str,
        db: AsyncSession,
        session_id: Optional[str] = None,
        trace_id: Optional[str] = None,
        top_k: int = None,
    ) -> List[RetrievalResult]:
        """
        执行混合检索
        
        Args:
            query: 查询文本
            db: 数据库会话
            session_id: 会话ID
            trace_id: 追踪ID
            top_k: 返回结果数量
        
        Returns:
            检索结果列表
        """
        start_time = time.time()
        top_k = top_k or self.top_k
        
        logger.info("retrieval.start", query=query[:50], top_k=top_k)
        
        try:
            # 1. 查询归一化
            normalized_query = self._normalize_query(query)
            
            # 2. 获取当前激活的索引版本
            index_version = await self._get_active_index_version(db)
            
            # 3. 并行执行稀疏和稠密检索
            sparse_results = await self._sparse_search(normalized_query, top_k * 2, db)
            dense_results = await self._dense_search(normalized_query, top_k * 2, db)
            
            # 4. RRF融合
            fused_results = self._rrf_fusion(sparse_results, dense_results, k=60)
            
            # 5. 取Top-K进行重排序
            candidates = fused_results[:self.rerank_top_k]
            
            # 6. 重排序
            reranked = await self._rerank(query, candidates)
            
            # 7. 格式化结果
            results = await self._format_results(reranked[:top_k], db)
            
            # 8. 记录检索日志
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
                "retrieval.completed",
                query=query[:50],
                result_count=len(results),
                latency_ms=round(latency_ms, 2),
            )
            
            return results
            
        except Exception as e:
            logger.error("retrieval.failed", query=query[:50], error=str(e))
            raise
    
    def _normalize_query(self, query: str) -> str:
        """
        查询归一化
        
        - 去除多余空白
        - 中英文术语扩展（可选）
        """
        # 去除多余空白
        normalized = " ".join(query.split())
        
        # TODO: 中英文术语扩展
        # 例如：ML -> Machine Learning, 机器学习
        
        return normalized
    
    async def _sparse_search(
        self,
        query: str,
        top_k: int,
        db: AsyncSession,
    ) -> List[Tuple[str, float]]:
        """
        稀疏检索 - PostgreSQL FTS
        
        使用to_tsvector和plainto_tsquery
        """
        # 构建FTS查询
        # 支持中文需要使用zhparser或类似扩展
        # 这里使用简单的tsvector匹配
        
        try:
            # 使用websearch_to_tsquery支持更自然的查询语法
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
            logger.warning("retrieval.sparse_search_failed", error=str(e))
            return []
    
    async def _dense_search(
        self,
        query: str,
        top_k: int,
        db: AsyncSession,
    ) -> List[Tuple[str, float]]:
        """
        稠密检索 - 向量相似度搜索
        
        使用pgvector的<=>操作符（余弦距离）
        """
        try:
            # 生成查询向量
            query_embedding = await self.model_gateway.embed([query])
            
            if not query_embedding or not query_embedding[0]:
                logger.warning("retrieval.empty_embedding")
                return []
            
            embedding = query_embedding[0]
            
            # 向量检索
            # 使用余弦相似度: 1 - (embedding <=> query_embedding)
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
            logger.warning("retrieval.dense_search_failed", error=str(e))
            return []
    
    def _rrf_fusion(
        self,
        sparse_results: List[Tuple[str, float]],
        dense_results: List[Tuple[str, float]],
        k: int = 60,
    ) -> List[Tuple[str, float]]:
        """
        Reciprocal Rank Fusion
        
        score = sum(1 / (k + rank))
        
        Args:
            sparse_results: 稀疏检索结果 [(chunk_id, score), ...]
            dense_results: 稠密检索结果 [(chunk_id, score), ...]
            k: RRF常数，通常取60
        
        Returns:
            融合后的结果 [(chunk_id, score), ...]
        """
        scores: Dict[str, float] = {}
        
        # 处理稀疏检索结果
        for rank, (chunk_id, _) in enumerate(sparse_results):
            scores[chunk_id] = scores.get(chunk_id, 0) + 1.0 / (k + rank + 1)
        
        # 处理稠密检索结果
        for rank, (chunk_id, _) in enumerate(dense_results):
            scores[chunk_id] = scores.get(chunk_id, 0) + 1.0 / (k + rank + 1)
        
        # 排序
        fused = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        
        return fused
    
    async def _rerank(
        self,
        query: str,
        candidates: List[Tuple[str, float]],
    ) -> List[Tuple[str, float]]:
        """
        重排序
        
        使用Cross-Encoder或供应商rerank API
        
        当前使用简化的实现：保持原有分数
        """
        if not candidates:
            return []
        
        # TODO: 实现真正的rerank
        # 可以调用Cohere Rerank API或本地Cross-Encoder
        
        logger.info("retrieval.rerank", candidate_count=len(candidates))
        
        # 暂时直接返回，后续可以接入真正的rerank
        return candidates
    
    async def _format_results(
        self,
        ranked: List[Tuple[str, float]],
        db: AsyncSession,
    ) -> List[RetrievalResult]:
        """格式化检索结果"""
        results = []
        
        for rank, (chunk_id, score) in enumerate(ranked, 1):
            # 获取chunk详情
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
            log = RetrievalLog(
                id=str(uuid4()),  # 需要导入uuid
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
            logger.warning("retrieval.log_failed", error=str(e))
            # 日志记录失败不影响主流程
    
    async def evaluate_confidence(
        self,
        query: str,
        results: List[RetrievalResult],
    ) -> float:
        """
        评估检索结果的置信度
        
        Returns:
            0-1之间的置信度分数
        """
        if not results:
            return 0.0
        
        # 基于分数分布评估
        scores = [r.score for r in results]
        avg_score = sum(scores) / len(scores)
        max_score = max(scores)
        
        # 简单的置信度计算
        # 如果最高分数较低，置信度也较低
        confidence = min(max_score * 1.5, 1.0)
        
        # 如果结果数量不足，降低置信度
        if len(results) < 3:
            confidence *= 0.8
        
        return round(confidence, 2)


# 全局服务实例
_retrieval_service: Optional[RetrievalService] = None


def get_retrieval_service() -> RetrievalService:
    """获取检索服务单例"""
    global _retrieval_service
    if _retrieval_service is None:
        _retrieval_service = RetrievalService()
    return _retrieval_service
