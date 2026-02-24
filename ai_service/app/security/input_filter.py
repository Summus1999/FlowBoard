"""
Input pre-filter for prompt-injection and command-abuse patterns.
"""

from __future__ import annotations

import re
from typing import List

from app.core.exceptions import InvalidParamsException


_DANGEROUS_PATTERNS: List[re.Pattern[str]] = [
    re.compile(r"ignore\s+all\s+previous\s+instructions", re.IGNORECASE),
    re.compile(r"system\s+prompt", re.IGNORECASE),
    re.compile(r"act\s+as\s+root", re.IGNORECASE),
    re.compile(r"\b(rm\s+-rf|chmod\s+777|sudo\s+)\b", re.IGNORECASE),
    re.compile(r"(api[_\s-]?key|secret|token)\s*[:=]", re.IGNORECASE),
]


def validate_user_input(text: str) -> None:
    """Reject risky input patterns before entering model chain."""
    if not text or not text.strip():
        raise InvalidParamsException("query cannot be empty")
    for pattern in _DANGEROUS_PATTERNS:
        if pattern.search(text):
            raise InvalidParamsException("input rejected by security policy")
