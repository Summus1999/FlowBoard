"""LLM layer for Sirchmunk search system."""

from .adapter import FlowBoardLLMAdapter
from .prompts import (
    FAST_QUERY_ANALYSIS,
    SEARCH_RESULT_SUMMARY,
    ROI_RESULT_SUMMARY,
    EVIDENCE_SUMMARY,
    EVALUATE_EVIDENCE_SAMPLE,
    generate_keyword_extraction_prompt,
)

__all__ = [
    "FlowBoardLLMAdapter",
    "FAST_QUERY_ANALYSIS",
    "SEARCH_RESULT_SUMMARY", 
    "ROI_RESULT_SUMMARY",
    "EVIDENCE_SUMMARY",
    "EVALUATE_EVIDENCE_SAMPLE",
    "generate_keyword_extraction_prompt",
]
