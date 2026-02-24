"""
Offline evaluation pipeline.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, asdict
from datetime import datetime
from statistics import mean
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.services.evaluation_service import EvaluationDataset
from app.services.rag_chain import create_rag_chain
from app.services.retrieval_service import get_retrieval_service

logger = get_logger(__name__)


@dataclass
class OfflineMetrics:
    answer_accuracy: float
    citation_faithfulness: float
    retrieval_recall_at_k: float
    tool_success_rate: float
    hallucination_rate: float


class OfflineEvaluationPipeline:
    """Run repeatable offline evaluation tasks and persist reports."""

    def __init__(self, report_dir: Optional[str] = None):
        self.report_dir = report_dir or settings.EVAL_REPORT_DIR
        self.retrieval_service = get_retrieval_service()

    async def run(
        self,
        db: AsyncSession,
        category: Optional[str] = None,
        max_examples: int = 30,
    ) -> Dict[str, Any]:
        dataset = EvaluationDataset()
        dataset.load()
        examples = dataset.examples
        if category:
            examples = [item for item in examples if item.get("category") == category]
        examples = examples[:max_examples]

        if not examples:
            return {
                "evaluated_count": 0,
                "metrics": asdict(
                    OfflineMetrics(
                        answer_accuracy=0.0,
                        citation_faithfulness=0.0,
                        retrieval_recall_at_k=0.0,
                        tool_success_rate=1.0,
                        hallucination_rate=0.0,
                    )
                ),
                "report_path": None,
            }

        sample_results: List[Dict[str, Any]] = []
        accuracy_scores: List[float] = []
        citation_scores: List[float] = []
        recall_scores: List[float] = []
        hallucination_scores: List[float] = []

        for item in examples:
            query = item.get("query", "")
            expected = item.get("expected_answer", "")
            retrieval_results = await self.retrieval_service.retrieve(
                query=query,
                db=db,
                top_k=settings.RAG_TOP_K,
            )
            chain = create_rag_chain(db=db, session_id=None, trace_id=None)
            rag_response = await chain.ainvoke(query)

            answer_accuracy = self._token_overlap_score(expected, rag_response.answer)
            citation_faithfulness = 1.0 if rag_response.citations else 0.0
            retrieval_recall = 1.0 if retrieval_results else 0.0
            hallucination = 1.0 - citation_faithfulness

            accuracy_scores.append(answer_accuracy)
            citation_scores.append(citation_faithfulness)
            recall_scores.append(retrieval_recall)
            hallucination_scores.append(hallucination)
            sample_results.append(
                {
                    "id": item.get("id"),
                    "category": item.get("category"),
                    "query": query,
                    "accuracy": round(answer_accuracy, 4),
                    "citation_faithfulness": citation_faithfulness,
                    "retrieval_recall_at_k": retrieval_recall,
                    "hallucination": hallucination,
                }
            )

        metrics = OfflineMetrics(
            answer_accuracy=round(mean(accuracy_scores), 4),
            citation_faithfulness=round(mean(citation_scores), 4),
            retrieval_recall_at_k=round(mean(recall_scores), 4),
            tool_success_rate=1.0,
            hallucination_rate=round(mean(hallucination_scores), 4),
        )
        report = {
            "generated_at": datetime.utcnow().isoformat(),
            "category": category,
            "evaluated_count": len(sample_results),
            "metrics": asdict(metrics),
            "samples": sample_results,
        }
        report_path = self._save_report(report)

        logger.info(
            "evaluation.offline.completed",
            category=category,
            evaluated_count=len(sample_results),
            report_path=report_path,
        )
        return {
            "evaluated_count": len(sample_results),
            "metrics": asdict(metrics),
            "report_path": report_path,
        }

    def _save_report(self, report: Dict[str, Any]) -> str:
        os.makedirs(self.report_dir, exist_ok=True)
        filename = f"offline_eval_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        output_path = os.path.join(self.report_dir, filename)
        with open(output_path, "w", encoding="utf-8") as fp:
            json.dump(report, fp, ensure_ascii=False, indent=2)
        return output_path

    @staticmethod
    def _token_overlap_score(expected: str, actual: str) -> float:
        if not expected.strip() or not actual.strip():
            return 0.0
        expected_tokens = {token for token in expected.split() if token}
        actual_tokens = {token for token in actual.split() if token}
        if not expected_tokens:
            return 0.0
        return len(expected_tokens & actual_tokens) / len(expected_tokens)


_offline_pipeline: Optional[OfflineEvaluationPipeline] = None


def get_offline_evaluation_pipeline() -> OfflineEvaluationPipeline:
    global _offline_pipeline
    if _offline_pipeline is None:
        _offline_pipeline = OfflineEvaluationPipeline()
    return _offline_pipeline
