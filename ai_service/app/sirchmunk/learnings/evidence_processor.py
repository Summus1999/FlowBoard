"""
Monte Carlo Evidence Sampling for Sirchmunk.

Implements intelligent evidence extraction from documents using a combination
of fuzzy matching and random exploration strategies.
"""

import asyncio
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from loguru import logger

try:
    from rapidfuzz import fuzz
except ImportError:
    fuzz = None
    logger.warning("rapidfuzz not available, falling back to basic matching")


@dataclass
class EvidenceSample:
    """A single evidence sample from a document."""
    source: str
    content: str
    start: int
    end: int
    score: float = 0.0
    reasoning: str = ""


@dataclass
class MonteCarloEvidenceSampling:
    """
    Monte Carlo Evidence Sampling algorithm.
    
    Combines fuzzy anchor matching with random exploration to find
    relevant evidence snippets in documents.
    """
    
    # Configuration
    max_rounds: int = 3
    fuzz_candidates_num: int = 5
    random_exploration_num: int = 2
    samples_per_round: int = 5
    top_k_seeds: int = 2
    min_snippet_len: int = 100
    max_snippet_len: int = 1000
    
    # Internal state
    _paragraphs: List[Tuple[int, int, str]] = field(default_factory=list)
    _source: str = ""
    
    def set_document(self, content: str, source: str):
        """
        Set the document to sample from.
        
        Args:
            content: Full document text.
            source: Source identifier (file path or URL).
        """
        self._source = source
        self._paragraphs = self._split_into_paragraphs(content)
        
    def _split_into_paragraphs(self, content: str) -> List[Tuple[int, int, str]]:
        """Split content into paragraphs with position info."""
        paragraphs = []
        
        # Split by double newlines or single newlines with indentation
        pattern = r'\n\s*\n|\n(?=\s{2,})'
        parts = re.split(pattern, content)
        
        pos = 0
        for part in parts:
            part = part.strip()
            if len(part) >= self.min_snippet_len:
                # Truncate if too long
                if len(part) > self.max_snippet_len:
                    part = part[:self.max_snippet_len] + "..."
                
                start = content.find(part[:50], pos)
                if start == -1:
                    start = pos
                end = start + len(part)
                
                paragraphs.append((start, end, part))
                pos = end
        
        # If we got few paragraphs, try splitting by sentences
        if len(paragraphs) < 5:
            paragraphs = []
            sentences = re.split(r'(?<=[.!?])\s+', content)
            
            pos = 0
            current_chunk = ""
            chunk_start = 0
            
            for sent in sentences:
                if len(current_chunk) + len(sent) < self.max_snippet_len:
                    if not current_chunk:
                        chunk_start = pos
                    current_chunk += sent + " "
                else:
                    if len(current_chunk) >= self.min_snippet_len:
                        paragraphs.append((chunk_start, pos, current_chunk.strip()))
                    current_chunk = sent + " "
                    chunk_start = pos
                
                pos += len(sent) + 1
            
            # Don't forget last chunk
            if len(current_chunk) >= self.min_snippet_len:
                paragraphs.append((chunk_start, pos, current_chunk.strip()))
        
        return paragraphs
    
    async def get_fuzzy_anchors(
        self,
        query: str,
        keywords: List[str],
        threshold: float = 10.0,
    ) -> List[EvidenceSample]:
        """
        Get initial anchor samples using fuzzy matching.
        
        Args:
            query: User query.
            keywords: Keywords to match against.
            threshold: Minimum fuzzy match score.
            
        Returns:
            List of EvidenceSample objects.
        """
        if not self._paragraphs:
            return []
        
        samples = []
        
        for start, end, text in self._paragraphs:
            score = self._calculate_fuzzy_score(text, keywords)
            
            if score >= threshold:
                samples.append(EvidenceSample(
                    source=self._source,
                    content=text,
                    start=start,
                    end=end,
                    score=score,
                ))
        
        # Sort by score and return top candidates
        samples.sort(key=lambda x: x.score, reverse=True)
        return samples[:self.fuzz_candidates_num]
    
    def _calculate_fuzzy_score(self, text: str, keywords: List[str]) -> float:
        """Calculate fuzzy match score for text against keywords."""
        if not keywords:
            return 0.0
        
        text_lower = text.lower()
        total_score = 0.0
        
        for kw in keywords:
            kw_lower = kw.lower()
            
            # Direct substring match bonus
            if kw_lower in text_lower:
                total_score += 20.0
            
            # Fuzzy matching
            if fuzz:
                ratio = fuzz.partial_ratio(kw_lower, text_lower)
                total_score += ratio / 10.0  # Scale to 0-10
            else:
                # Fallback: simple substring similarity
                if kw_lower in text_lower:
                    total_score += 10.0
        
        return total_score / len(keywords)
    
    def sample_stratified_supplement(self, count: int) -> List[EvidenceSample]:
        """
        Sample random paragraphs for exploration.
        
        Implements stratified sampling across the document.
        """
        if not self._paragraphs or count <= 0:
            return []
        
        import random
        
        n = len(self._paragraphs)
        if n <= count:
            return [
                EvidenceSample(
                    source=self._source,
                    content=text,
                    start=start,
                    end=end,
                    score=0.0,
                )
                for start, end, text in self._paragraphs
            ]
        
        # Stratified sampling: divide into regions
        samples = []
        region_size = n // count
        
        for i in range(count):
            region_start = i * region_size
            region_end = min((i + 1) * region_size, n)
            
            idx = random.randint(region_start, region_end - 1)
            start, end, text = self._paragraphs[idx]
            
            samples.append(EvidenceSample(
                source=self._source,
                content=text,
                start=start,
                end=end,
                score=0.0,
            ))
        
        return samples
    
    def sample_gaussian(
        self,
        seeds: List[EvidenceSample],
        round_num: int,
    ) -> List[EvidenceSample]:
        """
        Sample around high-scoring seeds using Gaussian distribution.
        
        Args:
            seeds: High-scoring seed samples from previous round.
            round_num: Current round number (affects spread).
            
        Returns:
            New samples focused around seed locations.
        """
        import random
        
        if not seeds or not self._paragraphs:
            return []
        
        samples = []
        n = len(self._paragraphs)
        
        # Decreasing spread with each round
        sigma = max(2, n // (4 * round_num))
        
        for seed in seeds:
            # Find seed's paragraph index
            seed_idx = -1
            for i, (start, end, _) in enumerate(self._paragraphs):
                if start <= seed.start < end:
                    seed_idx = i
                    break
            
            if seed_idx < 0:
                continue
            
            # Sample around seed
            samples_per_seed = self.samples_per_round // len(seeds)
            for _ in range(samples_per_seed):
                idx = int(random.gauss(seed_idx, sigma))
                idx = max(0, min(n - 1, idx))
                
                start, end, text = self._paragraphs[idx]
                samples.append(EvidenceSample(
                    source=self._source,
                    content=text,
                    start=start,
                    end=end,
                    score=0.0,
                ))
        
        return samples
    
    async def get_roi(
        self,
        query: str,
        keywords: Dict[str, float] = None,
        llm_evaluator=None,
    ) -> List[EvidenceSample]:
        """
        Get Region of Interest (ROI) samples using Monte Carlo algorithm.
        
        Args:
            query: User query.
            keywords: Dictionary of keywords with IDF weights.
            llm_evaluator: Optional async function to evaluate samples with LLM.
            
        Returns:
            List of high-quality EvidenceSample objects.
        """
        if not self._paragraphs:
            return []
        
        keywords = keywords or {}
        keyword_list = list(keywords.keys())
        
        all_candidates: List[EvidenceSample] = []
        top_seeds: List[EvidenceSample] = []
        
        for r in range(1, self.max_rounds + 1):
            current_samples = []
            
            if r == 1:
                # Round 1: Fuzzy anchors + random exploration
                fuzz_samples = await self.get_fuzzy_anchors(
                    query=query,
                    keywords=keyword_list,
                    threshold=10.0,
                )
                current_samples.extend(fuzz_samples)
                
                # Random supplement
                needed_random = max(0, self.samples_per_round - len(fuzz_samples))
                if needed_random > 0:
                    random_samples = self.sample_stratified_supplement(needed_random)
                    current_samples.extend(random_samples)
            else:
                # Later rounds: Gaussian focusing around high-scoring seeds
                valid_seeds = [s for s in top_seeds if s.score >= 4.0]
                if valid_seeds:
                    current_samples = self.sample_gaussian(valid_seeds, r)
                else:
                    # Fall back to random if no good seeds
                    current_samples = self.sample_stratified_supplement(self.samples_per_round)
            
            # Evaluate samples
            if llm_evaluator and current_samples:
                # Use LLM for evaluation
                evaluated = await self._evaluate_batch_with_llm(
                    current_samples, query, llm_evaluator
                )
                all_candidates.extend(evaluated)
            else:
                # Use keyword-based scoring
                for sample in current_samples:
                    sample.score = self._calculate_fuzzy_score(sample.content, keyword_list)
                all_candidates.extend(current_samples)
            
            # Select top seeds for next round
            all_candidates.sort(key=lambda x: x.score, reverse=True)
            top_seeds = all_candidates[:self.top_k_seeds]
        
        # Return deduplicated top results
        seen = set()
        results = []
        for sample in all_candidates:
            key = (sample.start, sample.end)
            if key not in seen:
                seen.add(key)
                results.append(sample)
        
        results.sort(key=lambda x: x.score, reverse=True)
        return results[:self.samples_per_round * 2]
    
    async def _evaluate_batch_with_llm(
        self,
        samples: List[EvidenceSample],
        query: str,
        llm_evaluator,
    ) -> List[EvidenceSample]:
        """Evaluate samples using LLM."""
        from ..llm.prompts import EVALUATE_EVIDENCE_SAMPLE
        
        async def evaluate_one(sample: EvidenceSample) -> EvidenceSample:
            try:
                prompt = EVALUATE_EVIDENCE_SAMPLE.format(
                    query=query,
                    sample_source=sample.source,
                    sample_content=sample.content[:500],
                )
                
                response = await llm_evaluator(prompt)
                
                # Parse JSON response
                try:
                    result = json.loads(response)
                    sample.score = float(result.get("score", 0))
                    sample.reasoning = result.get("reasoning", "")
                except json.JSONDecodeError:
                    # Try to extract score from text
                    match = re.search(r'"score"\s*:\s*(\d+(?:\.\d+)?)', response)
                    if match:
                        sample.score = float(match.group(1))
                
            except Exception as e:
                logger.warning(f"LLM evaluation failed: {e}")
            
            return sample
        
        # Evaluate concurrently
        evaluated = await asyncio.gather(*[evaluate_one(s) for s in samples])
        return list(evaluated)
