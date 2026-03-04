"""
Knowledge Base for Sirchmunk.

Builds and manages KnowledgeCluster objects from retrieved evidence.
"""

import asyncio
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
from uuid import uuid4

from loguru import logger

from ..schema.knowledge import KnowledgeCluster, EvidenceUnit, Lifecycle
from ..schema.request import Request
from .evidence_processor import MonteCarloEvidenceSampling, EvidenceSample


class KnowledgeBase:
    """
    Builds KnowledgeCluster objects from retrieved file evidence.
    
    Uses Monte Carlo sampling to extract relevant snippets and LLM
    to synthesize cluster metadata.
    """
    
    def __init__(
        self,
        llm=None,
        work_path: Union[str, Path] = None,
        log_callback=None,
    ):
        """
        Initialize KnowledgeBase.
        
        Args:
            llm: LLM adapter for synthesis.
            work_path: Base work path for caching.
            log_callback: Optional logging callback.
        """
        self.llm = llm
        self.work_path = Path(work_path or "~/.flowboard/sirchmunk").expanduser().resolve()
        self.log_callback = log_callback
        
        # Monte Carlo sampler
        self.sampler = MonteCarloEvidenceSampling()
    
    async def build(
        self,
        request: Request,
        retrieved_infos: List[Dict[str, Any]],
        keywords: Dict[str, float] = None,
        top_k_files: int = 3,
        top_k_snippets: int = 10,
        verbose: bool = False,
    ) -> Optional[KnowledgeCluster]:
        """
        Build a KnowledgeCluster from retrieved file information.
        
        Args:
            request: Original user request.
            retrieved_infos: List of dicts with 'path' key pointing to files.
            keywords: Keywords with IDF weights for sampling.
            top_k_files: Maximum number of files to process.
            top_k_snippets: Maximum snippets per file.
            verbose: Enable verbose logging.
            
        Returns:
            KnowledgeCluster object or None if insufficient evidence.
        """
        user_query = request.get_user_input()
        
        if not retrieved_infos:
            logger.warning("No retrieved files to build cluster from")
            return None
        
        # Limit files
        file_paths = [info.get("path") for info in retrieved_infos[:top_k_files]]
        file_paths = [p for p in file_paths if p]
        
        if not file_paths:
            return None
        
        # Extract evidence from each file
        all_evidences: List[EvidenceUnit] = []
        
        async def extract_from_file(file_path: str) -> Optional[EvidenceUnit]:
            try:
                path = Path(file_path)
                if not path.exists():
                    return None
                
                # Read file content
                content = await self._read_file_content(path)
                if not content:
                    return None
                
                # Sample evidence
                self.sampler.set_document(content, str(path))
                
                samples = await self.sampler.get_roi(
                    query=user_query,
                    keywords=keywords or {},
                    llm_evaluator=self._llm_evaluate if self.llm else None,
                )
                
                if not samples:
                    return None
                
                # Create EvidenceUnit
                snippets = [
                    {
                        "snippet": s.content[:500],
                        "start": s.start,
                        "end": s.end,
                        "score": s.score,
                        "reasoning": s.reasoning,
                    }
                    for s in samples[:top_k_snippets]
                ]
                
                summary = await self._summarize_snippets(snippets, user_query)
                
                return EvidenceUnit(
                    doc_id=hashlib.md5(str(path).encode()).hexdigest()[:16],
                    file_or_url=path,
                    summary=summary,
                    is_found=len(snippets) > 0,
                    snippets=snippets,
                    extracted_at=datetime.now(timezone.utc),
                )
                
            except Exception as e:
                logger.error(f"Failed to extract evidence from {file_path}: {e}")
                return None
        
        # Process files concurrently
        evidence_results = await asyncio.gather(
            *[extract_from_file(fp) for fp in file_paths],
            return_exceptions=True
        )
        
        for ev in evidence_results:
            if isinstance(ev, EvidenceUnit):
                all_evidences.append(ev)
        
        if not all_evidences:
            logger.warning("No evidence extracted from any file")
            return None
        
        # Synthesize cluster metadata
        cluster = await self._synthesize_cluster(
            query=user_query,
            evidences=all_evidences,
            file_paths=file_paths,
        )
        
        return cluster
    
    async def _read_file_content(self, path: Path) -> Optional[str]:
        """Read file content, handling various formats."""
        try:
            # Try text formats first
            text_extensions = {'.txt', '.md', '.py', '.js', '.json', '.yaml', '.yml', '.xml', '.html', '.css'}
            
            if path.suffix.lower() in text_extensions:
                return path.read_text(encoding='utf-8', errors='ignore')
            
            # For PDF, DOCX, etc., rely on ripgrep-all pre-extraction
            # or use kreuzberg for direct extraction
            try:
                import kreuzberg
                result = await asyncio.to_thread(
                    kreuzberg.extract_text, str(path)
                )
                return result
            except ImportError:
                # Fall back to raw read
                return path.read_text(encoding='utf-8', errors='ignore')
            except Exception:
                return path.read_text(encoding='utf-8', errors='ignore')
                
        except Exception as e:
            logger.error(f"Failed to read {path}: {e}")
            return None
    
    async def _llm_evaluate(self, prompt: str) -> str:
        """Wrapper for LLM evaluation."""
        if not self.llm:
            return "{}"
        
        try:
            response = await self.llm.generate(prompt)
            return response.content
        except Exception as e:
            logger.error(f"LLM evaluation failed: {e}")
            return "{}"
    
    async def _summarize_snippets(
        self,
        snippets: List[Dict[str, Any]],
        query: str,
    ) -> str:
        """Generate a summary of snippets using LLM or fallback."""
        if not snippets:
            return "No relevant content found."
        
        # Combine top snippets
        combined = "\n---\n".join([s.get("snippet", "")[:300] for s in snippets[:5]])
        
        if not self.llm:
            return combined[:500]
        
        try:
            prompt = f"""Summarize the following text snippets that are relevant to the query: "{query}"

Snippets:
{combined}

Provide a concise 2-3 sentence summary in the same language as the query."""
            
            response = await self.llm.generate(prompt)
            return response.content[:500]
        except Exception as e:
            logger.error(f"Summary generation failed: {e}")
            return combined[:500]
    
    async def _synthesize_cluster(
        self,
        query: str,
        evidences: List[EvidenceUnit],
        file_paths: List[str],
    ) -> KnowledgeCluster:
        """Synthesize a KnowledgeCluster from evidences."""
        
        # Generate cluster ID
        cluster_id = f"C{uuid4().hex[:8].upper()}"
        
        # Combine evidence summaries
        all_summaries = [ev.summary for ev in evidences if ev.summary]
        combined_evidence = "\n\n".join(all_summaries)
        
        # Generate name, description, content via LLM
        name = f"Knowledge: {query[:30]}..."
        description = combined_evidence[:200]
        content = combined_evidence
        
        if self.llm:
            try:
                from ..llm.prompts import EVIDENCE_SUMMARY
                
                prompt = EVIDENCE_SUMMARY.format(
                    user_input=query,
                    evidences=combined_evidence[:2000],
                )
                
                response = await self.llm.generate(prompt)
                text = response.content
                
                # Parse structured output
                name_match = re.search(r'<NAME>(.*?)</NAME>', text, re.DOTALL)
                desc_match = re.search(r'<DESCRIPTION>(.*?)</DESCRIPTION>', text, re.DOTALL)
                content_match = re.search(r'<CONTENT>(.*?)</CONTENT>', text, re.DOTALL)
                
                if name_match:
                    name = name_match.group(1).strip()[:50]
                if desc_match:
                    description = desc_match.group(1).strip()
                if content_match:
                    content = content_match.group(1).strip()
                    
            except Exception as e:
                logger.error(f"Cluster synthesis failed: {e}")
        
        return KnowledgeCluster(
            id=cluster_id,
            name=name,
            description=description,
            content=content,
            evidences=evidences,
            search_results=file_paths,
            queries=[query],
            confidence=self._calculate_confidence(evidences),
            lifecycle=Lifecycle.EMERGING,
            hotness=0.5,
        )
    
    def _calculate_confidence(self, evidences: List[EvidenceUnit]) -> float:
        """Calculate cluster confidence from evidences."""
        if not evidences:
            return 0.0
        
        # Average of evidence scores
        total_score = 0.0
        count = 0
        
        for ev in evidences:
            for snippet in ev.snippets:
                score = snippet.get("score", 0)
                if score > 0:
                    total_score += min(score / 10.0, 1.0)
                    count += 1
        
        if count == 0:
            return 0.3
        
        return min(total_score / count, 1.0)
