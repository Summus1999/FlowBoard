"""
Retrieval service
Hybrid retrieval: sparse (keyword) + dense (vector via ChromaDB)
"""

import asyncio
import time
from dataclasses import dataclass
from typing import List, Optional, Dict, Tuple
from uuid import uuid4

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import RetrievalTimeoutException
from app.core.logging import get_logger
from app.models.rag import RAGChunk, RAGIndexVersion, RetrievalLog, RAGDocVersion, RAGDocument
from app.services.model_gateway import get_model_gateway
from app.services import vector_store

logger = get_logger(__name__)


@dataclass
class RetrievalResult:
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
    Hybrid retrieval:
    1. Sparse: keyword matching on chunk content (SQLite LIKE)
    2. Dense: ChromaDB cosine similarity
    3. RRF fusion
    4. Rerank (placeholder)
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
        start_time = time.time()
        top_k = top_k or self.top_k
        
        logger.info("retrieval.start", query=query[:50], top_k=top_k)
        
        try:
            timeout_sec = max(settings.RAG_RETRIEVAL_TIMEOUT_MS / 1000.0, 0.1)
            async with asyncio.timeout(timeout_sec):
                normalized_query = self._normalize_query(query)
                index_version = await self._get_active_index_version(db)

                sparse_results = await self._sparse_search(normalized_query, top_k * 2, db)
                dense_results = await self._dense_search(normalized_query, top_k * 2)

                fused_results = self._rrf_fusion(sparse_results, dense_results, k=60)
                candidates = fused_results[: self.rerank_top_k]
                reranked = await self._rerank(query, candidates)
                results = await self._format_results(reranked[:top_k], db)

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
                    result_count=len(results),
                    latency_ms=round(latency_ms, 2),
                )
                return results

        except TimeoutError as exc:
            logger.warning("retrieval.timeout", timeout_ms=settings.RAG_RETRIEVAL_TIMEOUT_MS)
            raise RetrievalTimeoutException("retrieval timeout") from exc
        except Exception as e:
            logger.error("retrieval.failed", error=str(e))
            raise
    
    def _normalize_query(self, query: str) -> str:
        return " ".join(query.split())
    
    async def _sparse_search(
        self, query: str, top_k: int, db: AsyncSession,
    ) -> List[Tuple[str, float]]:
        """Keyword-based search using SQLite LIKE on chunk content."""
        try:
            keywords = [kw.strip() for kw in query.split() if kw.strip()]
            if not keywords:
                return []

            # Build a query that matches chunks containing any keyword
            stmt = (
                select(RAGChunk.id, RAGChunk.content)
                .join(RAGDocVersion, RAGChunk.doc_version_id == RAGDocVersion.id)
                .join(RAGDocument, RAGDocVersion.document_id == RAGDocument.id)
                .where(RAGDocument.status == "indexed")
            )

            # Score by number of keyword hits
            result = await db.execute(stmt)
            rows = result.all()

            scored: List[Tuple[str, float]] = []
            for row in rows:
                chunk_id, content = row
                content_lower = content.lower()
                hits = sum(1 for kw in keywords if kw.lower() in content_lower)
                if hits > 0:
                    scored.append((chunk_id, hits / len(keywords)))

            scored.sort(key=lambda x: x[1], reverse=True)
            return scored[:top_k]

        except Exception as e:
            logger.warning("retrieval.sparse_search_failed", error=str(e))
            return []
    
    async def _dense_search(
        self, query: str, top_k: int,
    ) -> List[Tuple[str, float]]:
        """Dense retrieval via ChromaDB cosine similarity."""
        try:
            query_embedding = await self.model_gateway.embed([query])
            if not query_embedding or not query_embedding[0]:
                return []

            return vector_store.query_similar(
                query_embedding=query_embedding[0],
                top_k=top_k,
            )
        except Exception as e:
            logger.warning("retrieval.dense_search_failed", error=str(e))
            return []
    
    def _rrf_fusion(
        self,
        sparse_results: List[Tuple[str, float]],
        dense_results: List[Tuple[str, float]],
        k: int = 60,
    ) -> List[Tuple[str, float]]:
        scores: Dict[str, float] = {}
        for rank, (chunk_id, _) in enumerate(sparse_results):
            scores[chunk_id] = scores.get(chunk_id, 0) + 1.0 / (k + rank + 1)
        for rank, (chunk_id, _) in enumerate(dense_results):
            scores[chunk_id] = scores.get(chunk_id, 0) + 1.0 / (k + rank + 1)
        return sorted(scores.items(), key=lambda x: x[1], reverse=True)
    
    async def _rerank(
        self, query: str, candidates: List[Tuple[str, float]],
    ) -> List[Tuple[str, float]]:
        # Placeholder — returns candidates as-is
        return candidates
    
    async def _format_results(
        self, ranked: List[Tuple[str, float]], db: AsyncSession,
    ) -> List[RetrievalResult]:
        results = []
        for rank, (chunk_id, score) in enumerate(ranked, 1):
            result = await db.execute(
                select(RAGChunk, RAGDocument.file_name, RAGDocument.source_path)
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
    
    async def _get_active_index_version(self, db: AsyncSession) -> Optional[RAGIndexVersion]:
        result = await db.execute(
            select(RAGIndexVersion).where(RAGIndexVersion.is_active == True)
        )
        return result.scalar_one_or_none()
    
    async def _log_retrieval(
        self, query, normalized_query, results, latency_ms,
        session_id, trace_id, index_version_id, db,
    ):
        try:
            log = RetrievalLog(
                id=str(uuid4()),
                query=query,
                query_normalized=normalized_query,
                session_id=session_id,
                trace_id=trace_id or str(uuid4()),
                index_version_id=index_version_id,
                retrieval_results=[
                    {"chunk_id": r.chunk_id, "score": r.score, "rank": r.rank}
                    for r in results
                ],
                latency_ms=latency_ms,
            )
            db.add(log)
            await db.commit()
        except Exception as e:
            logger.warning("retrieval.log_failed", error=str(e))
    
    async def evaluate_confidence(
        self, query: str, results: List[RetrievalResult],
    ) -> float:
        if not results:
            return 0.0
        scores = [r.score for r in results]
        max_score = max(scores)
        confidence = min(max_score * 1.5, 1.0)
        if len(results) < 3:
            confidence *= 0.8
        return round(confidence, 2)


_retrieval_service: Optional[RetrievalService] = None


def get_retrieval_service() -> RetrievalService:
    global _retrieval_service
    if _retrieval_service is None:
        _retrieval_service = RetrievalService()
    return _retrieval_service
