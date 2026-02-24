"""
Request context utilities.
"""

from __future__ import annotations

import re
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from uuid import uuid4


TRACE_ID_REGEX = re.compile(r"^[0-9a-f-]{36}$")
REQUEST_ID_REGEX = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")


@dataclass
class RequestContext:
    """Per-request context shared across layers."""

    trace_id: str
    request_id: str
    route: str = ""
    method: str = ""
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    idempotency_key: Optional[str] = None
    retry_attempt: int = 0
    is_replay: bool = False
    created_at: str = ""


_request_context: ContextVar[Optional[RequestContext]] = ContextVar(
    "request_context", default=None
)


def _new_trace_id() -> str:
    return str(uuid4())


def _new_request_id() -> str:
    now = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    return f"req-{now}-{uuid4().hex[:8]}"


def normalize_trace_id(raw: Optional[str]) -> str:
    if not raw:
        return _new_trace_id()
    candidate = raw.strip().lower()
    if TRACE_ID_REGEX.match(candidate):
        return candidate
    return _new_trace_id()


def normalize_request_id(raw: Optional[str]) -> str:
    if not raw:
        return _new_request_id()
    candidate = raw.strip()
    if REQUEST_ID_REGEX.match(candidate):
        return candidate
    return _new_request_id()


def set_request_context(ctx: RequestContext) -> None:
    _request_context.set(ctx)


def get_request_context() -> Optional[RequestContext]:
    return _request_context.get()


def clear_request_context() -> None:
    _request_context.set(None)
