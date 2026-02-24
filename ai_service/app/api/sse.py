"""
SSE formatting helpers.
"""

from __future__ import annotations

import json
from typing import Any, Dict


def sse_event(event: str, data: Dict[str, Any]) -> str:
    """Format one SSE frame."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
