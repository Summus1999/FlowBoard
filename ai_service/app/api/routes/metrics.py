"""
Realtime metrics API route.
"""

from __future__ import annotations

from statistics import median

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_request_id, get_trace_id
from app.core.logging import get_logger
from app.models.plan import Plan, PlanStatus
from app.models.rag import RetrievalLog
from app.services.model_gateway import get_model_gateway

logger = get_logger(__name__)
router = APIRouter()


def _percentile(values: list[float], ratio: float) -> float:
    if not values:
        return 0.0
    sorted_values = sorted(values)
    idx = min(int(len(sorted_values) * ratio), len(sorted_values) - 1)
    return round(sorted_values[idx], 2)


@router.get("/realtime")
async def realtime_metrics(
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """Return online quality and cost metrics."""
    result = await db.execute(
        select(RetrievalLog).order_by(RetrievalLog.created_at.desc()).limit(200)
    )
    logs = result.scalars().all()
    latencies = [float(item.latency_ms) for item in logs]
    hit_count = sum(1 for item in logs if item.retrieval_results)
    no_answer_count = len(logs) - hit_count

    plan_result = await db.execute(select(Plan.status))
    statuses = plan_result.scalars().all()
    confirmed = sum(1 for status in statuses if status in {PlanStatus.CONFIRMED.value, PlanStatus.EXECUTING.value})
    proposed = sum(1 for status in statuses if status == PlanStatus.PROPOSED.value)
    confirmation_rate = round(confirmed / proposed, 4) if proposed else 1.0

    gateway = get_model_gateway()
    cost_stats = gateway.get_cost_stats()

    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "metrics": {
            "hit_rate": round(hit_count / len(logs), 4) if logs else 0.0,
            "no_answer_rate": round(no_answer_count / len(logs), 4) if logs else 0.0,
            "first_token_latency_p50_ms": round(median(latencies), 2) if latencies else 0.0,
            "first_token_latency_p95_ms": _percentile(latencies, 0.95),
            "plan_confirmation_rate": confirmation_rate,
            "monthly_cost_rmb": round(cost_stats.get("monthly_total", 0.0), 4),
        },
    }
