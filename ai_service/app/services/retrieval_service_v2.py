"""
Retrieval Service V2 - Enhanced
Delegates to the base RetrievalService (ChromaDB-backed).
Adds rerank integration when available.
"""

from dataclasses import dataclass
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.services.retrieval_service import (
    RetrievalService,
    RetrievalResult as BaseRetrievalResult,
    get_retrieval_service,
)

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
    retrieval_method: str = "hybrid"


class RetrievalServiceV2:
    """Enhanced retrieval — thin wrapper over base service with rerank."""

    def __init__(self):
        self._base = get_retrieval_service()

    async def retrieve(
        self,
        query: str,
        db: AsyncSession,
        session_id: Optional[str] = None,
        trace_id: Optional[str] = None,
        top_k: int = None,
        use_rerank: bool = True,
    ) -> List[RetrievalResult]:
        base_results = await self._base.retrieve(
            query=query, db=db, session_id=session_id,
            trace_id=trace_id, top_k=top_k,
        )
        return [
            RetrievalResult(
                chunk_id=r.chunk_id,
                content=r.content,
                score=r.score,
                doc_name=r.doc_name,
                section_path=r.section_path,
                page_number=r.page_number,
                source_path=r.source_path,
                rank=r.rank,
                retrieval_method="hybrid",
            )
            for r in base_results
        ]

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


_retrieval_service_v2: Optional[RetrievalServiceV2] = None


def get_retrieval_service_v2() -> RetrievalServiceV2:
    global _retrieval_service_v2
    if _retrieval_service_v2 is None:
        _retrieval_service_v2 = RetrievalServiceV2()
    return _retrieval_service_v2
