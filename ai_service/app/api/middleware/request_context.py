"""
Request context middleware.
"""

from __future__ import annotations

from datetime import datetime
from time import perf_counter

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging import get_logger
from app.core.request_context import (
    RequestContext,
    clear_request_context,
    normalize_request_id,
    normalize_trace_id,
    set_request_context,
)

logger = get_logger(__name__)


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Create and propagate request context for every HTTP request."""

    async def dispatch(self, request: Request, call_next):
        start = perf_counter()

        trace_id = normalize_trace_id(request.headers.get("X-Trace-Id"))
        request_id = normalize_request_id(request.headers.get("X-Request-Id"))
        idempotency_key = request.headers.get("Idempotency-Key")
        retry_attempt = int(request.headers.get("X-Retry-Attempt", "0") or 0)

        ctx = RequestContext(
            trace_id=trace_id,
            request_id=request_id,
            route=request.url.path,
            method=request.method.upper(),
            session_id=request.headers.get("X-Session-Id"),
            user_id=request.headers.get("X-User-Id"),
            idempotency_key=idempotency_key,
            retry_attempt=retry_attempt,
            created_at=datetime.utcnow().isoformat(),
        )

        set_request_context(ctx)
        structlog.contextvars.bind_contextvars(trace_id=trace_id, request_id=request_id)
        request.state.trace_id = trace_id
        request.state.request_id = request_id
        request.state.idempotency_key = idempotency_key
        request.state.retry_attempt = retry_attempt
        request.state.is_replay = False

        try:
            response = await call_next(request)
        finally:
            elapsed_ms = round((perf_counter() - start) * 1000, 2)
            logger.info(
                "api.request.completed",
                trace_id=trace_id,
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                latency_ms=elapsed_ms,
            )
            structlog.contextvars.clear_contextvars()
            clear_request_context()

        response.headers["X-Trace-Id"] = trace_id
        response.headers["X-Request-Id"] = request_id
        response.headers["X-Idempotent-Replay"] = (
            "true" if getattr(request.state, "is_replay", False) else "false"
        )
        return response
