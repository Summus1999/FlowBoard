"""
Sirchmunk Retrieval Service for FlowBoard.

Provides an integration layer between Sirchmunk's AgenticSearch engine
and FlowBoard's existing RAG infrastructure.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Union

from loguru import logger

from app.core.config import settings
from app.core.logging import get_logger

logger_fb = get_logger(__name__)


@dataclass
class SirchmunkSearchResult:
    """Result from Sirchmunk search."""
    answer: str
    sources: List[str]
    confidence: float
    mode: str
    cluster_id: Optional[str] = None
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class SirchmunkRetrievalService:
    """
    Sirchmunk-based retrieval service for FlowBoard.
    
    Replaces traditional RAG (chunk + vector index) with Sirchmunk's
    embedding-free, agent-based document search.
    """
    
    def __init__(self, work_path: Optional[str] = None):
        """
        Initialize Sirchmunk retrieval service.
        
        Args:
            work_path: Work path for Sirchmunk data. Defaults to settings.
        """
        self._search_engine = None
        self._initialized = False
        self._work_path = work_path or getattr(settings, 'SIRCHMUNK_WORK_PATH', None)
    
    def _ensure_initialized(self):
        """Lazily initialize the search engine."""
        if self._initialized:
            return
        
        try:
            from app.sirchmunk import AgenticSearch
            from app.sirchmunk.llm.adapter import FlowBoardLLMAdapter
            
            work_path = self._work_path or str(Path.home() / ".flowboard" / "sirchmunk")
            
            self._search_engine = AgenticSearch(
                llm=FlowBoardLLMAdapter(),
                work_path=work_path,
                verbose=True,
                reuse_knowledge=True,
            )
            
            self._initialized = True
            logger_fb.info("sirchmunk.initialized", work_path=work_path)
            
        except Exception as e:
            logger_fb.error("sirchmunk.init_failed", error=str(e))
            raise
    
    async def search(
        self,
        query: str,
        paths: Optional[List[str]] = None,
        mode: Literal["FAST", "DEEP", "FILENAME_ONLY"] = "FAST",
        top_k_files: int = 5,
    ) -> SirchmunkSearchResult:
        """
        Search documents using Sirchmunk.
        
        Args:
            query: User search query.
            paths: Paths to search in. Uses knowledge base paths if not provided.
            mode: Search mode (FILENAME_ONLY, FAST, DEEP).
            top_k_files: Maximum files to retrieve.
            
        Returns:
            SirchmunkSearchResult with answer, sources, and metadata.
        """
        self._ensure_initialized()
        
        # Default paths from settings
        if not paths:
            paths = self._get_default_paths()
        
        logger_fb.info(
            "sirchmunk.search_start",
            query=query[:50],
            mode=mode,
            paths_count=len(paths),
        )
        
        try:
            if mode == "FILENAME_ONLY":
                results = await self._search_engine.search(
                    query=query,
                    paths=paths,
                    mode="FILENAME_ONLY",
                )
                
                return SirchmunkSearchResult(
                    answer=f"Found {len(results)} matching files",
                    sources=[r.get("path", "") for r in results[:10]],
                    confidence=1.0 if results else 0.0,
                    mode=mode,
                    metadata={"file_matches": results[:20]},
                )
            
            elif mode == "FAST":
                answer = await self._search_engine.search(
                    query=query,
                    paths=paths,
                    mode="FAST",
                    top_k_files=top_k_files,
                )
                
                return SirchmunkSearchResult(
                    answer=answer if isinstance(answer, str) else str(answer),
                    sources=paths[:top_k_files],
                    confidence=0.7,  # FAST mode confidence
                    mode=mode,
                )
            
            else:  # DEEP
                result = await self._search_engine.search(
                    query=query,
                    paths=paths,
                    mode="DEEP",
                    top_k_files=top_k_files,
                    return_context=True,
                )
                
                if isinstance(result, tuple):
                    answer, context = result
                else:
                    answer = str(result)
                    context = None
                
                # Extract cluster info if available
                cluster_id = None
                sources = paths[:top_k_files]
                
                if hasattr(result, 'id'):
                    cluster_id = result.id
                if hasattr(result, 'search_results'):
                    sources = result.search_results
                
                return SirchmunkSearchResult(
                    answer=answer if isinstance(answer, str) else str(answer),
                    sources=sources,
                    confidence=0.85,  # DEEP mode confidence
                    mode=mode,
                    cluster_id=cluster_id,
                    metadata={"context": context.to_dict() if context else None},
                )
                
        except Exception as e:
            logger_fb.error("sirchmunk.search_failed", error=str(e))
            return SirchmunkSearchResult(
                answer=f"Search failed: {str(e)}",
                sources=[],
                confidence=0.0,
                mode=mode,
                metadata={"error": str(e)},
            )
    
    def _get_default_paths(self) -> List[str]:
        """Get default knowledge base paths from settings."""
        paths = []
        
        # Try to get paths from settings
        data_dir = getattr(settings, 'DATA_DIR', None)
        if data_dir:
            data_path = Path(data_dir)
            
            # Add knowledge subdirectories
            for subdir in ['knowledge', 'documents', 'uploads']:
                subpath = data_path / subdir
                if subpath.exists():
                    paths.append(str(subpath))
        
        # Fallback to current directory
        if not paths:
            paths = ["."]
        
        return paths
    
    async def get_status(self) -> Dict[str, Any]:
        """Get service status."""
        return {
            "initialized": self._initialized,
            "work_path": self._work_path,
            "engine_available": self._search_engine is not None,
        }


# Global singleton
_sirchmunk_service: Optional[SirchmunkRetrievalService] = None


def get_sirchmunk_service() -> SirchmunkRetrievalService:
    """Get Sirchmunk retrieval service singleton."""
    global _sirchmunk_service
    if _sirchmunk_service is None:
        _sirchmunk_service = SirchmunkRetrievalService()
    return _sirchmunk_service
