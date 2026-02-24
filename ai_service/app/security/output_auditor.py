"""
Output auditing for leakage and policy risks.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List


@dataclass
class AuditResult:
    blocked: bool
    issues: List[str] = field(default_factory=list)


_LEAK_PATTERNS = [
    (re.compile(r"sk-[A-Za-z0-9]{20,}"), "possible_api_key"),
    (re.compile(r"AKIA[0-9A-Z]{16}"), "possible_aws_key"),
    (re.compile(r"-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----"), "private_key_material"),
]

_ABUSE_PATTERNS = [
    (re.compile(r"ignore\s+all\s+previous\s+instructions", re.IGNORECASE), "prompt_injection_echo"),
    (re.compile(r"run\s+shell\s+command", re.IGNORECASE), "unsafe_tool_instruction"),
]


def audit_output(text: str) -> AuditResult:
    """Inspect model output and flag high-risk patterns."""
    if not text:
        return AuditResult(blocked=False, issues=[])

    issues: List[str] = []
    for pattern, issue in _LEAK_PATTERNS + _ABUSE_PATTERNS:
        if pattern.search(text):
            issues.append(issue)
    return AuditResult(blocked=bool(issues), issues=issues)
