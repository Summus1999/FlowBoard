"""
GrepRetriever - ripgrep-all based text retrieval.

A Python wrapper for ripgrep-all (rga), providing high-performance
full-text search across 100+ file formats including PDF, Word, Excel, etc.
"""

import asyncio
import json
import re
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Union

from loguru import logger

from app.sirchmunk.utils.rga_finder import get_cached_rga_path, check_rga_available

# Concurrent limit for ripgrep-all processes
GREP_CONCURRENT_LIMIT = 4
RGA_SEMAPHORE = asyncio.Semaphore(value=GREP_CONCURRENT_LIMIT)


class GrepRetriever:
    """
    A Python wrapper for ripgrep-all (rga), exposing its functionality via methods.
    
    All search methods return parsed JSON results. Shell injection is mitigated
    by using subprocess with shell=False and explicit argument lists.
    """

    def __init__(self, work_path: Union[str, Path] = None, **kwargs):
        self.work_path: Path = Path(work_path or "~/.flowboard/sirchmunk").expanduser().resolve()
        self.rga_cache: Path = self.work_path / ".cache" / "rga"
        self.rga_cache.mkdir(parents=True, exist_ok=True)

    async def retrieve(
        self,
        terms: Union[str, List[str]],
        path: Union[str, Path, List[str], List[Path], None] = None,
        logic: Literal["and", "or", "not"] = "or",
        *,
        case_sensitive: bool = False,
        whole_word: bool = False,
        literal: bool = False,
        max_depth: Optional[int] = None,
        include: Optional[List[str]] = None,
        exclude: Optional[List[str]] = None,
        file_type: Optional[str] = None,
        count_only: bool = False,
        line_number: bool = True,
        with_filename: bool = True,
        rank: bool = True,
        timeout: float = 60.0,
    ) -> List[Dict[str, Any]]:
        """
        Search for terms in files using ripgrep-all.

        Args:
            terms: Single pattern or list of patterns.
            path: Path(s) to search in.
            logic: "or" (any term), "and" (all terms), "not" (first, not rest).
            case_sensitive: Enable case-sensitive search.
            whole_word: Match whole words only.
            literal: Treat patterns as literal strings.
            max_depth: Maximum directory depth.
            include: Glob patterns to include.
            exclude: Glob patterns to exclude.
            file_type: Search only files of given type.
            count_only: Only output match counts per file.
            line_number: Show line numbers.
            with_filename: Show filenames.
            rank: If True, rerank results by relevance score.
            timeout: Maximum time in seconds.

        Returns:
            List of match objects from rga --json.
        """
        results: List[Dict[str, Any]] = []

        if isinstance(terms, str):
            terms = [terms]
        if not terms:
            return results

        rga_cache_path = str(self.rga_cache.resolve())

        if logic == "or":
            results, _ = await self._retrieve_or(
                terms=terms,
                path=path,
                case_sensitive=case_sensitive,
                whole_word=whole_word,
                literal=literal,
                max_depth=max_depth,
                include=include,
                exclude=exclude,
                file_type=file_type,
                count_only=count_only,
                line_number=line_number,
                with_filename=with_filename,
                rga_cache_path=rga_cache_path,
                timeout=timeout,
            )
        elif logic == "and":
            results = await self._retrieve_and(
                terms=terms,
                path=path,
                case_sensitive=case_sensitive,
                whole_word=whole_word,
                literal=literal,
                max_depth=max_depth,
                include=include,
                exclude=exclude,
                file_type=file_type,
                count_only=count_only,
                line_number=line_number,
                with_filename=with_filename,
                rga_cache_path=rga_cache_path,
                timeout=timeout,
            )
        elif logic == "not":
            if len(terms) < 2:
                raise ValueError("logic='not' requires at least two terms")
            results = await self._retrieve_not(
                positive=terms[0],
                negatives=terms[1:],
                path=path,
                case_sensitive=case_sensitive,
                whole_word=whole_word,
                literal=literal,
                max_depth=max_depth,
                include=include,
                exclude=exclude,
                file_type=file_type,
                count_only=count_only,
                line_number=line_number,
                with_filename=with_filename,
                rga_cache_path=rga_cache_path,
                timeout=timeout,
            )
        else:
            raise ValueError(f"Unsupported logic: {logic}")

        if rank and not count_only and results:
            results = self._rerank_results(results, terms, case_sensitive, whole_word)

        return results

    async def _retrieve_or(
        self,
        terms: List[str],
        path: Union[str, Path, List[str], List[Path], None] = None,
        **kwargs,
    ) -> tuple:
        """OR logic: Match any term."""
        literal = kwargs.get("literal", False)
        timeout = kwargs.get("timeout", 60.0)
        
        if literal:
            if len(terms) == 1:
                result = await self._retrieve_single(pattern=terms[0], path=path, **kwargs)
                return result, terms[0]
            
            # Concurrent search for each term
            async def _search_one(term: str):
                return await self._retrieve_single(pattern=term, path=path, **kwargs)
            
            results_lists = await asyncio.gather(*[_search_one(t) for t in terms])
            combined: List[Dict[str, Any]] = []
            for rl in results_lists:
                combined.extend(rl)
            return combined, " | ".join(terms)
        else:
            # Use regex OR pattern
            pattern = "|".join(f"({re.escape(t)})" for t in terms)
            result = await self._retrieve_single(pattern=pattern, path=path, **kwargs)
            return result, pattern

    async def _retrieve_and(
        self,
        terms: List[str],
        path: Union[str, Path, List[str], List[Path], None] = None,
        **kwargs,
    ) -> List[Dict[str, Any]]:
        """AND logic: Match all terms in same file."""
        if len(terms) == 1:
            return await self._retrieve_single(pattern=terms[0], path=path, **kwargs)

        # First pass: get files matching first term
        first_results = await self._retrieve_single(pattern=terms[0], path=path, **kwargs)
        
        if not first_results:
            return []

        # Extract unique files
        files = set()
        for r in first_results:
            if r.get("type") == "begin":
                file_path = r.get("data", {}).get("path", {}).get("text", "")
                if file_path:
                    files.add(file_path)

        # Filter files by remaining terms
        for term in terms[1:]:
            if not files:
                break
            
            term_results = await self._retrieve_single(pattern=term, path=path, **kwargs)
            term_files = set()
            for r in term_results:
                if r.get("type") == "begin":
                    file_path = r.get("data", {}).get("path", {}).get("text", "")
                    if file_path:
                        term_files.add(file_path)
            
            files &= term_files

        # Final search in qualifying files
        if not files:
            return []

        final_results = []
        for r in first_results:
            if r.get("type") == "begin":
                file_path = r.get("data", {}).get("path", {}).get("text", "")
                if file_path in files:
                    final_results.append(r)
            elif r.get("type") in ("match", "end"):
                final_results.append(r)

        return final_results

    async def _retrieve_not(
        self,
        positive: str,
        negatives: List[str],
        path: Union[str, Path, List[str], List[Path], None] = None,
        **kwargs,
    ) -> List[Dict[str, Any]]:
        """NOT logic: Match positive term but not negative terms."""
        # First pass: get files matching positive term
        pos_results = await self._retrieve_single(pattern=positive, path=path, **kwargs)
        
        if not pos_results:
            return []

        pos_files = set()
        for r in pos_results:
            if r.get("type") == "begin":
                file_path = r.get("data", {}).get("path", {}).get("text", "")
                if file_path:
                    pos_files.add(file_path)

        # Exclude files matching negative terms
        for neg in negatives:
            neg_results = await self._retrieve_single(pattern=neg, path=path, **kwargs)
            for r in neg_results:
                if r.get("type") == "begin":
                    file_path = r.get("data", {}).get("path", {}).get("text", "")
                    if file_path:
                        pos_files.discard(file_path)

        # Filter original results
        final_results = []
        current_file = None
        include_current = False

        for r in pos_results:
            if r.get("type") == "begin":
                current_file = r.get("data", {}).get("path", {}).get("text", "")
                include_current = current_file in pos_files
                if include_current:
                    final_results.append(r)
            elif r.get("type") == "end":
                if include_current:
                    final_results.append(r)
                current_file = None
                include_current = False
            elif include_current:
                final_results.append(r)

        return final_results

    async def _retrieve_single(
        self,
        pattern: str,
        path: Union[str, Path, List[str], List[Path], None] = None,
        **kwargs,
    ) -> List[Dict[str, Any]]:
        """Execute single pattern search."""
        args = self._build_args(pattern, path, **kwargs)
        result = await self._run_rga_async(args, timeout=kwargs.get("timeout", 60.0))
        return result.get("stdout", []) if isinstance(result.get("stdout"), list) else []

    def _build_args(
        self,
        pattern: str,
        path: Union[str, Path, List[str], List[Path], None] = None,
        **kwargs,
    ) -> List[str]:
        """Build ripgrep-all command arguments."""
        args = []

        # Search options
        if kwargs.get("case_sensitive"):
            args.append("-s")
        else:
            args.append("-i")

        if kwargs.get("whole_word"):
            args.append("-w")

        if kwargs.get("literal"):
            args.append("-F")

        if kwargs.get("line_number", True):
            args.append("-n")

        if kwargs.get("with_filename", True):
            args.append("-H")

        if kwargs.get("count_only"):
            args.append("-c")

        # Max depth
        max_depth = kwargs.get("max_depth")
        if max_depth is not None:
            args.extend(["--max-depth", str(max_depth)])

        # Include/exclude patterns
        include = kwargs.get("include")
        if include:
            for pattern_glob in include:
                args.extend(["-g", pattern_glob])

        exclude = kwargs.get("exclude")
        if exclude:
            for pattern_glob in exclude:
                args.extend(["-g", f"!{pattern_glob}"])

        # File type
        file_type = kwargs.get("file_type")
        if file_type:
            args.extend(["-t", file_type])

        # RGA cache settings
        rga_cache_path = kwargs.get("rga_cache_path")
        if rga_cache_path:
            args.extend(["--rga-cache-path", rga_cache_path])

        # Pattern and path
        args.append(pattern)

        if path is not None:
            if isinstance(path, (str, Path)):
                args.append(str(path))
            else:
                args.extend([str(p) for p in path])

        return args

    @staticmethod
    async def _run_rga_async(
        args: List[str], json_output: bool = True, timeout: float = 60.0
    ) -> Dict[str, Any]:
        """Run ripgrep-all asynchronously."""
        # Use bundled rga binary if available, otherwise fall back to system PATH
        try:
            rga_path = str(get_cached_rga_path())
        except FileNotFoundError:
            rga_path = "rga"  # Fall back to system PATH
        
        cmd = [rga_path, "--no-config"]
        if json_output:
            cmd.append("--json")
        cmd.extend(args)

        try:
            await asyncio.wait_for(RGA_SEMAPHORE.acquire(), timeout=timeout)
        except asyncio.TimeoutError:
            raise RuntimeError(f"rga search timed out waiting for queue slot ({timeout}s)")

        try:
            try:
                process = await asyncio.create_subprocess_exec(
                    *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
                )
            except FileNotFoundError:
                raise RuntimeError(
                    "ripgrep-all ('rga') not found. Please run:\n"
                    "  python ai_service/scripts/download_rga.py\n"
                    "Or install rga manually: https://github.com/phiresky/ripgrep-all#installation"
                )

            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(), timeout=timeout
                )

                stdout_str = stdout.decode().strip()
                stderr_str = stderr.decode().strip()
                returncode = process.returncode

                if returncode != 0 and returncode > 1:
                    if not stdout_str:
                        raise RuntimeError(f"rga failed with code {returncode}: {stderr_str}")
                    logger.warning(f"rga returned exit code {returncode}: {stderr_str[:300]}")

                parsed_stdout = stdout_str
                if json_output and returncode in (0, 1, 2) and stdout_str:
                    try:
                        parsed_stdout = [
                            json.loads(line) for line in stdout_str.splitlines() if line
                        ]
                    except json.JSONDecodeError as e:
                        logger.error(f"JSON parse error: {e}")
                        parsed_stdout = []

                return {
                    "stdout": parsed_stdout,
                    "stderr": stderr_str,
                    "returncode": returncode,
                }

            except asyncio.TimeoutError:
                process.kill()
                raise RuntimeError(f"rga search timed out after {timeout}s")

        finally:
            RGA_SEMAPHORE.release()

    def _rerank_results(
        self,
        results: List[Dict[str, Any]],
        terms: List[str],
        case_sensitive: bool,
        whole_word: bool,
    ) -> List[Dict[str, Any]]:
        """Rerank search results by relevance score."""
        def extract_text(match: Dict) -> str:
            try:
                return match["data"]["lines"]["text"]
            except (KeyError, TypeError):
                return ""

        grouped: List[List[Dict]] = []
        current_group: List[Dict] = []

        for item in results:
            item_type = item.get("type")
            if item_type == "begin":
                if current_group:
                    grouped.append(current_group)
                current_group = [item]
            elif item_type == "end":
                current_group.append(item)
                grouped.append(current_group)
                current_group = []
            elif item_type == "match":
                if current_group:
                    current_group.append(item)

        if current_group:
            grouped.append(current_group)

        new_results: List[Dict] = []

        for group in grouped:
            if not group:
                continue

            match_items = [g for g in group if g.get("type") == "match"]

            scored_matches = []
            for m in match_items:
                text = extract_text(m)
                score = self._calculate_relevance_score(
                    text, terms, case_sensitive, whole_word
                )
                scored_matches.append((score, {**m, "score": score}))

            scored_matches.sort(key=lambda x: x[0], reverse=True)
            reranked_matches = [item for _, item in scored_matches]

            rebuilt_group = []
            match_iter = iter(reranked_matches)
            for item in group:
                if item.get("type") == "match":
                    try:
                        rebuilt_group.append(next(match_iter))
                    except StopIteration:
                        pass
                else:
                    rebuilt_group.append(item)

            new_results.extend(rebuilt_group)

        return new_results

    @staticmethod
    def _calculate_relevance_score(
        text: str,
        terms: List[str],
        case_sensitive: bool = False,
        whole_word: bool = False,
    ) -> float:
        """Calculate relevance score for a text match."""
        if not text or not terms:
            return 0.0

        if not case_sensitive:
            text = text.lower()
            terms = [t.lower() for t in terms]

        score = 0.0
        for term in terms:
            if whole_word:
                pattern = rf"\b{re.escape(term)}\b"
                matches = len(re.findall(pattern, text))
            else:
                matches = text.count(term)

            if matches > 0:
                # TF with saturation
                tf_score = 1.0 + (0.5 * min(matches - 1, 5))
                # IDF approximation based on term length
                idf_score = min(len(term) / 3, 3.0)
                score += tf_score * idf_score

        # Length normalization
        text_len = len(text)
        if text_len > 100:
            score /= (1 + (text_len - 100) / 500)

        return round(score, 4)
