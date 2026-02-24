"""
Idempotency middleware for write requests.
"""

from __future__ import annotations

import base64
import hashlib
import json
from datetime import datetime
from typing import Any, Dict, Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings
from app.core.exceptions import InvalidParamsException, RequestIdConflictException
from app.core.logging import get_logger
from app.core.redis import get_redis

logger = get_logger(__name__)

WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _hash_payload(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _make_dedupe_key(
    request_id: str,
    route: str,
    method: str,
    user_id: str,
) -> str:
    return f"idem:{request_id}:{route}:{method}:{user_id}"


def _is_stream_response(response: Response) -> bool:
    content_type = response.headers.get("content-type", "")
    return content_type.startswith("text/event-stream")


def _requires_idempotency(request: Request) -> bool:
    method = request.method.upper()
    if method not in WRITE_METHODS:
        return False
    if method != "POST":
        return True
    if not settings.IDEMPOTENCY_ENFORCE_POST:
        return False
    return request.url.path not in set(settings.IDEMPOTENCY_EXEMPT_POST_PATHS)


class IdempotencyMiddleware(BaseHTTPMiddleware):
    """Provide request replay and conflict detection by request_id."""

    async def dispatch(self, request: Request, call_next):
        if not _requires_idempotency(request):
            return await call_next(request)

        request_id = getattr(request.state, "request_id", None)
        if not request_id:
            request_id = request.headers.get("X-Request-Id", "")
        idempotency_key = request.headers.get("Idempotency-Key") or getattr(
            request.state, "idempotency_key", None
        )
        if not idempotency_key:
            raise InvalidParamsException("write request requires Idempotency-Key")

        body = await request.body()
        body_hash = _hash_payload(body)
        user_id = request.headers.get("X-User-Id", "anonymous")
        dedupe_key = _make_dedupe_key(
            request_id=request_id,
            route=request.url.path,
            method=request.method.upper(),
            user_id=user_id,
        )

        try:
            redis = await get_redis()
            existing_raw = await redis.get(dedupe_key)
        except Exception as exc:  # noqa: BLE001
            logger.warning("idempotency.redis_unavailable", error=str(exc))
            existing_raw = None

        if existing_raw:
            existing: Dict[str, Any] = json.loads(existing_raw)
            if existing.get("body_hash") != body_hash:
                raise RequestIdConflictException(
                    "request_id conflict: payload mismatch",
                    details={
                        "route": request.url.path,
                        "method": request.method.upper(),
                    },
                )
            response_body_b64 = existing.get("response_body_b64")
            if response_body_b64:
                replay_response = Response(
                    content=base64.b64decode(response_body_b64),
                    status_code=existing.get("status_code", 200),
                    media_type=existing.get("content_type", "application/json"),
                )
                request.state.is_replay = True
                replay_response.headers["X-Idempotent-Replay"] = "true"
                replay_response.headers["X-Trace-Id"] = getattr(request.state, "trace_id", "")
                replay_response.headers["X-Request-Id"] = request_id
                return replay_response

        response = await call_next(request)

        if response.status_code >= 500 or _is_stream_response(response):
            return response

        response_body = getattr(response, "body", None)
        if response_body is None:
            return response

        payload = {
            "idempotency_key": idempotency_key,
            "request_id": request_id,
            "body_hash": body_hash,
            "status_code": response.status_code,
            "content_type": response.media_type or "application/json",
            "response_body_b64": base64.b64encode(response_body).decode("ascii"),
            "created_at": datetime.utcnow().isoformat(),
        }
        try:
            redis = await get_redis()
            await redis.set(
                dedupe_key,
                json.dumps(payload, ensure_ascii=False),
                ex=settings.IDEMPOTENCY_TTL_SECONDS,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("idempotency.persist_failed", error=str(exc))

        return response
