"""
评估API路由
检索和问答质量评估
"""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.api.deps import get_db, get_trace_id, get_request_id
from app.services.evaluation_service import (
    get_retrieval_evaluator,
    get_qa_evaluator,
    EvaluationDataset,
)
from app.services.retrieval_service import get_retrieval_service

logger = get_logger(__name__)
router = APIRouter()


@router.get("/retrieval/metrics")
async def get_retrieval_metrics(
    days: int = Query(7, ge=1, le=30),
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    获取检索指标
    
    包括命中率、延迟分布、置信度分布等
    """
    start_date = datetime.now() - timedelta(days=days)
    
    evaluator = get_retrieval_evaluator()
    report = await evaluator.generate_evaluation_report(
        start_date=start_date,
        db=db,
    )
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "period_days": days,
        **report,
    }


@router.post("/retrieval/evaluate")
async def evaluate_retrieval(
    query: str,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    评估单次检索质量
    
    返回相关性、多样性、覆盖度等指标
    """
    # 执行检索
    retrieval_service = get_retrieval_service()
    results = await retrieval_service.retrieve(query, db, trace_id=trace_id)
    
    # 评估质量
    evaluator = get_retrieval_evaluator()
    
    result_dicts = [
        {
            "id": r.chunk_id,
            "content": r.content,
            "score": r.score,
            "doc_name": r.doc_name,
        }
        for r in results
    ]
    
    metrics = await evaluator.evaluate_retrieval_quality(query, result_dicts, db)
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "query": query,
        "retrieved_count": len(results),
        "metrics": metrics,
        "results": [
            {
                "chunk_id": r.chunk_id,
                "doc_name": r.doc_name,
                "score": r.score,
                "rank": r.rank,
            }
            for r in results[:5]
        ],
    }


@router.post("/qa/evaluate")
async def evaluate_qa(
    query: str,
    answer: str,
    reference_texts: Optional[list] = None,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
):
    """
    评估问答质量
    
    评估维度：忠实度、完整性、简洁性
    """
    evaluator = get_qa_evaluator()
    
    chunks = [{"content": text} for text in (reference_texts or [])]
    
    scores = await evaluator.evaluate_answer(query, answer, chunks)
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "scores": scores,
        "assessment": {
            "is_faithful": scores["faithfulness"] >= 0.7,
            "is_complete": scores["completeness"] >= 0.7,
            "is_concise": scores["conciseness"] >= 0.7,
            "is_good_overall": scores["overall"] >= 0.7,
        },
    }


@router.get("/dataset")
async def get_evaluation_dataset(
    category: Optional[str] = None,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
):
    """
    获取评测数据集
    """
    dataset = EvaluationDataset()
    dataset.load()
    
    examples = dataset.examples
    if category:
        examples = [e for e in examples if e.get("category") == category]
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "total": len(dataset.examples),
        "filtered": len(examples),
        "examples": examples[:50],  # 最多返回50条
    }


@router.post("/dataset/add")
async def add_evaluation_example(
    query: str,
    expected_answer: str,
    category: str = "general",
    tags: Optional[list] = None,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
):
    """
    添加评测样例到数据集
    """
    dataset = EvaluationDataset()
    dataset.load()
    
    dataset.add_example(
        query=query,
        expected_answer=expected_answer,
        category=category,
        tags=tags or [],
    )
    
    dataset.save()
    
    logger.info("evaluation.example_added", query=query[:50])
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "added": True,
        "total_examples": len(dataset.examples),
    }


@router.post("/run-batch")
async def run_batch_evaluation(
    category: Optional[str] = None,
    max_examples: int = Query(10, ge=1, le=50),
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    运行批量评测
    
    在评测数据集上运行RAG流程并评估效果
    """
    dataset = EvaluationDataset()
    dataset.load()
    
    examples = dataset.examples
    if category:
        examples = [e for e in examples if e.get("category") == category]
    
    examples = examples[:max_examples]
    
    # 这里应该实际运行RAG流程并评估
    # 简化实现：返回待评测列表
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "to_evaluate": len(examples),
        "examples": [
            {
                "id": e.get("id"),
                "query": e.get("query"),
                "category": e.get("category"),
            }
            for e in examples
        ],
    }


@router.get("/health")
async def evaluation_health(
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
):
    """
    评估系统健康检查
    """
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "status": "healthy",
        "capabilities": [
            "retrieval_metrics",
            "retrieval_quality",
            "qa_quality",
            "dataset_management",
        ],
    }
