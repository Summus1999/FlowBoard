"""
FlowBoard Sirchmunk Module - Embedding-Free Agentic Search

This module provides an embedding-free, agent-based document search system
ported from the summus_sirchmunk project. It replaces traditional RAG
(chunk + vector index) with real-time file search using ripgrep-all.

Key Components:
- AgenticSearch: Main search engine with FAST/DEEP/FILENAME_ONLY modes
- GrepRetriever: ripgrep-all based text retrieval
- KnowledgeStorage: DuckDB + Parquet persistent storage
- MonteCarloEvidenceSampling: Smart evidence extraction
"""

from .search import AgenticSearch

__all__ = [
    "AgenticSearch",
]

__version__ = "0.1.0"
