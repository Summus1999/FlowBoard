"""
Tool call guardrails: schema and permission checks.
"""

from __future__ import annotations

from typing import Any, Dict

from app.core.exceptions import InvalidParamsException, UnconfirmedRiskException


def validate_tool_arguments(
    tool_name: str,
    arguments: Dict[str, Any],
    *,
    user_confirmed: bool = False,
) -> None:
    """Validate tool arguments and high-risk actions."""
    if not isinstance(arguments, dict):
        raise InvalidParamsException("tool arguments must be an object")

    if tool_name == "calendar.create_event":
        required = {"title", "start_time", "end_time"}
        missing = sorted(item for item in required if item not in arguments)
        if missing:
            raise InvalidParamsException(f"missing tool args: {', '.join(missing)}")
    elif tool_name == "todo.create":
        required = {"title"}
        missing = sorted(item for item in required if item not in arguments)
        if missing:
            raise InvalidParamsException(f"missing tool args: {', '.join(missing)}")

    if tool_name in {"calendar.delete_event", "todo.batch_delete", "task.batch_update"} and not user_confirmed:
        raise UnconfirmedRiskException("high-risk tool action requires user confirmation")
