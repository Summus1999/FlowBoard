"""Storage layer for Sirchmunk search system."""

from .duckdb import DuckDBManager
from .knowledge_storage import KnowledgeStorage

__all__ = [
    "DuckDBManager",
    "KnowledgeStorage",
]
