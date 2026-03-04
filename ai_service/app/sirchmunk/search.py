"""
AgenticSearch - Main search engine for Sirchmunk.

Provides embedding-free, agent-based document search with three modes:
- FILENAME_ONLY: Fast file name matching
- FAST: 2 LLM calls + greedy early-termination
- DEEP: Full ReAct loop with knowledge clustering
"""

import asyncio
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Tuple, Union

from loguru import logger

from .schema.knowledge import KnowledgeCluster
from .schema.request import Request, Message, ContentItem
from .schema.search_context import SearchContext
from .retrieve.text_retriever import GrepRetriever
from .learnings.knowledge_base import KnowledgeBase
from .storage.knowledge_storage import KnowledgeStorage
from .llm.adapter import FlowBoardLLMAdapter
from .llm.prompts import FAST_QUERY_ANALYSIS, ROI_RESULT_SUMMARY
from .utils.constants import (
    DEFAULT_WORK_PATH,
    DEFAULT_TOP_K_FILES,
    DEFAULT_MAX_TOKEN_BUDGET,
    DEFAULT_MAX_LOOPS,
    DEFAULT_CLUSTER_SIM_THRESHOLD,
    DEFAULT_CLUSTER_SIM_TOP_K,
)


class AgenticSearch:
    """
    Embedding-free agentic document search engine.
    
    Supports three search modes:
    - FILENAME_ONLY: Pure file name matching, zero LLM calls
    - FAST: 2 LLM calls + greedy early-termination (2-5s)
    - DEEP: Full parallel retrieval + ReAct refinement (10-30s)
    """
    
    def __init__(
        self,
        llm: Optional[FlowBoardLLMAdapter] = None,
        work_path: Optional[Union[str, Path]] = None,
        paths: Optional[Union[str, Path, List[str], List[Path]]] = None,
        verbose: bool = True,
        reuse_knowledge: bool = True,
        cluster_sim_threshold: float = DEFAULT_CLUSTER_SIM_THRESHOLD,
        cluster_sim_top_k: int = DEFAULT_CLUSTER_SIM_TOP_K,
    ):
        """
        Initialize AgenticSearch.
        
        Args:
            llm: LLM adapter for query analysis and synthesis.
            work_path: Base work path for caching and storage.
            paths: Default search paths.
            verbose: Enable verbose logging.
            reuse_knowledge: Enable knowledge cluster reuse.
            cluster_sim_threshold: Similarity threshold for cluster reuse.
            cluster_sim_top_k: Top-k clusters to consider for reuse.
        """
        # Normalize paths
        if paths is not None:
            if isinstance(paths, (str, Path)):
                self.paths = [str(Path(paths).expanduser().resolve())]
            else:
                self.paths = [str(Path(p).expanduser().resolve()) for p in paths]
        else:
            self.paths = None
        
        # Work path
        self.work_path = Path(work_path or DEFAULT_WORK_PATH).expanduser().resolve()
        self.work_path.mkdir(parents=True, exist_ok=True)
        
        # LLM
        self.llm = llm or FlowBoardLLMAdapter()
        
        # Components
        self.grep_retriever = GrepRetriever(work_path=self.work_path)
        self.knowledge_base = KnowledgeBase(llm=self.llm, work_path=self.work_path)
        self.knowledge_storage = KnowledgeStorage(work_path=str(self.work_path))
        
        # Configuration
        self.verbose = verbose
        self.reuse_knowledge = reuse_knowledge
        self.cluster_sim_threshold = cluster_sim_threshold
        self.cluster_sim_top_k = cluster_sim_top_k
        
        # LLM usage tracking
        self.llm_usages: List[Dict[str, Any]] = []
    
    def _resolve_paths(
        self,
        paths: Optional[Union[str, Path, List[str], List[Path]]] = None,
    ) -> List[str]:
        """Resolve search paths."""
        if paths is None:
            paths = self.paths
        
        if paths is None:
            return ["."]
        
        if isinstance(paths, (str, Path)):
            return [str(Path(paths).expanduser().resolve())]
        
        return [str(Path(p).expanduser().resolve()) for p in paths]
    
    async def search(
        self,
        query: str,
        paths: Optional[Union[str, Path, List[str], List[Path]]] = None,
        *,
        mode: Literal["DEEP", "FAST", "FILENAME_ONLY"] = "FAST",
        max_loops: int = DEFAULT_MAX_LOOPS,
        max_token_budget: int = DEFAULT_MAX_TOKEN_BUDGET,
        top_k_files: int = DEFAULT_TOP_K_FILES,
        return_context: bool = False,
    ) -> Union[str, Tuple[str, SearchContext], List[Dict[str, Any]], KnowledgeCluster]:
        """
        Search for information in documents.
        
        Args:
            query: User search query.
            paths: Paths to search in.
            mode: Search mode (FILENAME_ONLY, FAST, DEEP).
            max_loops: Maximum ReAct loops (DEEP mode only).
            max_token_budget: Maximum LLM token budget.
            top_k_files: Maximum files to retrieve.
            return_context: Return SearchContext with answer.
            
        Returns:
            - FILENAME_ONLY: List of file match dicts
            - FAST: Answer string (or tuple with context)
            - DEEP: KnowledgeCluster or answer string
        """
        paths = self._resolve_paths(paths)
        
        logger.info(f"Search started: mode={mode}, query={query[:50]}...")
        
        if mode == "FILENAME_ONLY":
            return await self._search_by_filename(query=query, paths=paths)
        elif mode == "FAST":
            answer = await self._search_fast(
                query=query,
                paths=paths,
                top_k_files=top_k_files,
            )
            if return_context:
                return answer, SearchContext()
            return answer
        else:  # DEEP
            answer, cluster, context = await self._search_deep(
                query=query,
                paths=paths,
                max_loops=max_loops,
                max_token_budget=max_token_budget,
                top_k_files=top_k_files,
            )
            if return_context:
                return answer, context
            return cluster if cluster else answer
    
    async def _search_by_filename(
        self,
        query: str,
        paths: List[str],
    ) -> List[Dict[str, Any]]:
        """
        Search by file name only.
        
        Fast mode that only matches file names without reading content.
        """
        results = []
        
        for search_path in paths:
            path = Path(search_path)
            if not path.exists():
                continue
            
            if path.is_file():
                if query.lower() in path.name.lower():
                    results.append({
                        "path": str(path),
                        "name": path.name,
                        "type": "file",
                    })
            else:
                # Recursive glob
                for file_path in path.rglob("*"):
                    if file_path.is_file() and query.lower() in file_path.name.lower():
                        results.append({
                            "path": str(file_path),
                            "name": file_path.name,
                            "type": "file",
                        })
        
        return results[:50]  # Limit results
    
    async def _search_fast(
        self,
        query: str,
        paths: List[str],
        top_k_files: int = 5,
    ) -> str:
        """
        Fast search mode with minimal LLM calls.
        
        Steps:
        1. LLM query analysis (extract keywords)
        2. ripgrep-all keyword search
        3. Read top file(s)
        4. LLM answer synthesis
        """
        # Step 1: Query analysis
        keywords = await self._analyze_query_fast(query)
        
        if not keywords.get("primary") and not keywords.get("fallback"):
            return f"Could not extract search terms from query: {query}"
        
        # Step 2: Keyword search
        search_terms = keywords.get("primary", []) + keywords.get("fallback", [])
        
        search_results = await self.grep_retriever.retrieve(
            terms=search_terms,
            path=paths,
            logic="or",
            literal=True,
            rank=True,
        )
        
        if not search_results:
            return f"No results found for: {query}"
        
        # Extract unique files
        files = []
        for r in search_results:
            if r.get("type") == "begin":
                file_path = r.get("data", {}).get("path", {}).get("text", "")
                if file_path and file_path not in files:
                    files.append(file_path)
        
        files = files[:top_k_files]
        
        if not files:
            return f"No matching files found for: {query}"
        
        # Step 3: Read file content
        combined_content = ""
        for file_path in files:
            try:
                content = Path(file_path).read_text(encoding='utf-8', errors='ignore')
                combined_content += f"\n\n=== {file_path} ===\n{content[:3000]}"
            except Exception as e:
                logger.warning(f"Failed to read {file_path}: {e}")
        
        if not combined_content:
            return f"Could not read any matching files for: {query}"
        
        # Step 4: Synthesize answer
        answer = await self._synthesize_answer(query, combined_content[:8000])
        
        return answer
    
    async def _search_deep(
        self,
        query: str,
        paths: List[str],
        max_loops: int = 10,
        max_token_budget: int = 64000,
        top_k_files: int = 5,
    ) -> Tuple[str, Optional[KnowledgeCluster], SearchContext]:
        """
        Deep search mode with full knowledge clustering.
        
        Steps:
        1. Check for cluster reuse
        2. Parallel probe (keywords, dir scan, knowledge cache)
        3. Parallel retrieval
        4. Build knowledge cluster
        5. Generate answer
        6. Persist cluster
        """
        context = SearchContext(
            max_token_budget=max_token_budget,
            max_loops=max_loops,
        )
        
        # Step 1: Try cluster reuse
        if self.reuse_knowledge:
            existing = await self._try_reuse_cluster(query)
            if existing:
                logger.info(f"Reusing existing cluster: {existing.id}")
                answer = await self._generate_answer_from_cluster(existing, query)
                return answer, existing, context
        
        # Step 2: Query analysis
        keywords = await self._analyze_query_fast(query)
        
        # Step 3: Search
        search_terms = keywords.get("primary", []) + keywords.get("fallback", [])
        
        if not search_terms:
            return f"Could not extract search terms from: {query}", None, context
        
        search_results = await self.grep_retriever.retrieve(
            terms=search_terms,
            path=paths,
            logic="or",
            literal=True,
            rank=True,
        )
        
        # Extract files
        files = []
        for r in search_results:
            if r.get("type") == "begin":
                file_path = r.get("data", {}).get("path", {}).get("text", "")
                if file_path and file_path not in files:
                    files.append(file_path)
        
        files = files[:top_k_files]
        
        if not files:
            return f"No results found for: {query}", None, context
        
        # Step 4: Build knowledge cluster
        request = Request(
            messages=[Message(role="user", content=[ContentItem(type="text", text=query)])]
        )
        
        keyword_weights = {}
        for kw in search_terms:
            keyword_weights[kw] = 5.0  # Default IDF weight
        
        cluster = await self.knowledge_base.build(
            request=request,
            retrieved_infos=[{"path": f} for f in files],
            keywords=keyword_weights,
            top_k_files=top_k_files,
        )
        
        # Step 5: Generate answer
        if cluster:
            answer = await self._generate_answer_from_cluster(cluster, query)
            
            # Step 6: Persist cluster
            await self._save_cluster(cluster, query)
        else:
            # Fallback to simple synthesis
            combined = ""
            for f in files[:3]:
                try:
                    combined += f"\n=== {f} ===\n" + Path(f).read_text(encoding='utf-8', errors='ignore')[:2000]
                except:
                    pass
            
            answer = await self._synthesize_answer(query, combined[:6000])
        
        return answer, cluster, context
    
    async def _analyze_query_fast(self, query: str) -> Dict[str, Any]:
        """Analyze query to extract search keywords."""
        try:
            prompt = FAST_QUERY_ANALYSIS.format(user_input=query)
            response = await self.llm.generate(prompt)
            
            # Parse JSON response
            text = response.content
            
            # Try to extract JSON
            json_match = re.search(r'\{[^{}]*\}', text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                return result
            
            # Fallback: split query into words
            words = query.split()
            return {
                "primary": [" ".join(words[:3])] if len(words) >= 2 else words,
                "fallback": words[:5],
                "file_hints": [],
                "intent": query,
            }
            
        except Exception as e:
            logger.error(f"Query analysis failed: {e}")
            words = query.split()
            return {
                "primary": words[:2],
                "fallback": words[:4],
                "file_hints": [],
                "intent": query,
            }
    
    async def _synthesize_answer(self, query: str, content: str) -> str:
        """Synthesize answer from content."""
        try:
            prompt = ROI_RESULT_SUMMARY.format(
                user_input=query,
                text_content=content,
            )
            response = await self.llm.generate(prompt)
            return response.content
        except Exception as e:
            logger.error(f"Answer synthesis failed: {e}")
            return f"Found relevant content but synthesis failed: {str(e)[:100]}"
    
    async def _try_reuse_cluster(self, query: str) -> Optional[KnowledgeCluster]:
        """Try to find and reuse an existing cluster."""
        try:
            # Simple name-based search for now
            clusters = await self.knowledge_storage.search_by_name(query[:30])
            if clusters:
                return clusters[0]
            return None
        except Exception as e:
            logger.error(f"Cluster reuse check failed: {e}")
            return None
    
    async def _generate_answer_from_cluster(
        self,
        cluster: KnowledgeCluster,
        query: str,
    ) -> str:
        """Generate answer from a knowledge cluster."""
        # Extract content
        content = cluster.content if isinstance(cluster.content, str) else "\n".join(cluster.content)
        
        if len(content) < 100:
            # Use evidence summaries
            summaries = [ev.summary for ev in cluster.evidences if ev.summary]
            content = "\n\n".join(summaries)
        
        return await self._synthesize_answer(query, content[:6000])
    
    async def _save_cluster(self, cluster: KnowledgeCluster, query: str):
        """Save cluster to storage."""
        try:
            # Add query to cluster history
            if query not in cluster.queries:
                cluster.queries.append(query)
            
            # Check if exists
            existing = await self.knowledge_storage.get(cluster.id)
            if existing:
                await self.knowledge_storage.update(cluster)
            else:
                await self.knowledge_storage.insert(cluster)
            
            logger.info(f"Saved cluster: {cluster.id}")
        except Exception as e:
            logger.error(f"Failed to save cluster: {e}")
