"""
Retrieval source whitelist enforcement.
"""

from __future__ import annotations

import os
from typing import Iterable, List

from app.core.config import settings
from app.core.exceptions import InvalidParamsException


def _normalize(path: str) -> str:
    return os.path.abspath(path).rstrip("/")


def enforce_source_whitelist(source_path: str, whitelist: Iterable[str] | None = None) -> None:
    """Ensure source path is within configured whitelist roots."""
    allowed_roots: List[str] = list(whitelist or settings.SECURITY_SOURCE_WHITELIST)
    if not allowed_roots:
        return

    normalized_target = _normalize(source_path)
    normalized_roots = [_normalize(item) for item in allowed_roots]
    if not any(normalized_target.startswith(root + "/") or normalized_target == root for root in normalized_roots):
        raise InvalidParamsException("source path not in whitelist")
