"""
引用格式化工具
生成规范的可解释引用
"""

import re
from dataclasses import dataclass
from typing import List, Optional, Dict, Any
from urllib.parse import quote


@dataclass
class CitationFormat:
    """引用格式"""
    ref_id: str  # [ref-1]
    source: str  # 文件名
    section: Optional[str]  # 章节路径
    page: Optional[int]  # 页码
    line_start: Optional[int]  # 起始行号
    line_end: Optional[int]  # 结束行号
    version: Optional[str]  # 版本号
    preview: str  # 内容预览
    source_path: Optional[str] = None  # 源文件路径


class CitationFormatter:
    """
    引用格式化器
    
    生成规范的引用格式，支持UI回溯
    """
    
    def __init__(self, max_preview_length: int = 150):
        self.max_preview_length = max_preview_length
    
    def format_inline(self, ref_id: str) -> str:
        """格式化行内引用标记"""
        return f"[{ref_id}]"
    
    def format_reference(
        self,
        citation: CitationFormat,
        style: str = "standard",
    ) -> str:
        """
        格式化引用条目
        
        Args:
            citation: 引用信息
            style: 格式风格 (standard, minimal, detailed)
        
        Returns:
            格式化的引用文本
        """
        if style == "standard":
            return self._format_standard(citation)
        elif style == "minimal":
            return self._format_minimal(citation)
        elif style == "detailed":
            return self._format_detailed(citation)
        else:
            raise ValueError(f"Unknown citation style: {style}")
    
    def _format_standard(self, citation: CitationFormat) -> str:
        """标准格式"""
        parts = [f"[{citation.ref_id}] {citation.source}"]
        
        if citation.section:
            parts.append(f"#{citation.section}")
        
        if citation.page:
            parts.append(f" 第{citation.page}页")
        
        # 构建回溯链接
        backlink = self._build_backlink(citation)
        if backlink:
            parts.append(f" [{backlink}]")
        
        return "".join(parts)
    
    def _format_minimal(self, citation: CitationFormat) -> str:
        """简洁格式"""
        return f"[{citation.ref_id}] {citation.source}"
    
    def _format_detailed(self, citation: CitationFormat) -> str:
        """详细格式"""
        lines = [f"[{citation.ref_id}] {citation.source}"]
        
        if citation.section:
            lines.append(f"  章节: {citation.section}")
        
        if citation.page:
            lines.append(f"  页码: {citation.page}")
        
        if citation.line_start:
            line_info = f"  行号: {citation.line_start}"
            if citation.line_end and citation.line_end != citation.line_start:
                line_info += f"-{citation.line_end}"
            lines.append(line_info)
        
        if citation.version:
            lines.append(f"  版本: {citation.version}")
        
        if citation.preview:
            preview = citation.preview[:self.max_preview_length]
            if len(citation.preview) > self.max_preview_length:
                preview += "..."
            lines.append(f"  预览: {preview}")
        
        return "\n".join(lines)
    
    def _build_backlink(self, citation: CitationFormat) -> Optional[str]:
        """构建回溯链接"""
        # 这里可以根据需要构建不同的链接格式
        # 例如：file://path/to/doc#section 或 vscode://file/...
        
        if not citation.source_path:
            return None
        
        # 简化处理，返回路径信息
        return f"路径:{citation.source_path}"
    
    def format_citation_block(
        self,
        citations: List[CitationFormat],
        style: str = "standard",
    ) -> str:
        """
        格式化引用块
        
        用于在回答末尾显示所有引用
        """
        if not citations:
            return ""
        
        lines = ["\n\n---", "## 引用来源\n"]
        
        for citation in citations:
            lines.append(self.format_reference(citation, style))
            lines.append("")  # 空行
        
        return "\n".join(lines)
    
    def parse_citations_from_text(self, text: str) -> List[str]:
        """
        从文本中解析引用标记
        
        提取所有 [ref-N] 格式的引用
        """
        pattern = r'\[ref-(\d+)\]'
        matches = re.findall(pattern, text)
        return [f"ref-{m}" for m in matches]
    
    def build_citation_map(
        self,
        citations: List[CitationFormat],
    ) -> Dict[str, Dict[str, Any]]:
        """
        构建引用映射表
        
        用于前端UI点击引用时回溯到原文
        """
        return {
            c.ref_id: {
                "source": c.source,
                "source_path": c.source_path,
                "section": c.section,
                "page": c.page,
                "line_start": c.line_start,
                "line_end": c.line_end,
                "version": c.version,
                "preview": c.preview[:200] if c.preview else None,
            }
            for c in citations
        }


def format_citation_for_frontend(
    chunk_id: str,
    doc_name: str,
    source_path: str,
    section: Optional[str] = None,
    page: Optional[int] = None,
    content: str = "",
    rank: int = 1,
) -> Dict[str, Any]:
    """
    格式化引用供前端使用
    
    Returns:
        前端友好的引用格式
    """
    ref_id = f"ref-{rank}"
    
    # 生成内容预览
    preview = content[:150] + "..." if len(content) > 150 else content
    
    # 构建回溯URL
    backlink = None
    if source_path:
        # 可以构建vscode链接或其他协议链接
        # backlink = f"vscode://file/{quote(source_path)}"
        backlink = source_path
    
    return {
        "ref_id": ref_id,
        "chunk_id": chunk_id,
        "source": doc_name,
        "source_path": source_path,
        "section": section,
        "page": page,
        "preview": preview,
        "backlink": backlink,
        "rank": rank,
    }


def validate_citations_in_answer(
    answer: str,
    available_citations: List[str],
) -> tuple:
    """
    验证回答中的引用是否有效
    
    Returns:
        (有效引用列表, 无效引用列表)
    """
    formatter = CitationFormatter()
    used_citations = formatter.parse_citations_from_text(answer)
    
    valid = [c for c in used_citations if c in available_citations]
    invalid = [c for c in used_citations if c not in available_citations]
    
    return valid, invalid


class CitationValidator:
    """引用验证器"""
    
    def __init__(self, min_citation_ratio: float = 0.3):
        self.min_citation_ratio = min_citation_ratio
    
    def validate_answer_citations(
        self,
        answer: str,
        citations: List[CitationFormat],
    ) -> Dict[str, Any]:
        """
        验证回答的引用质量
        
        检查：
        1. 是否有引用
        2. 引用数量是否合理
        3. 是否有无效引用
        """
        formatter = CitationFormatter()
        used_refs = formatter.parse_citations_from_text(answer)
        available_refs = [c.ref_id for c in citations]
        
        # 检查是否有引用
        has_citations = len(used_refs) > 0
        
        # 检查无效引用
        invalid_refs = [r for r in used_refs if r not in available_refs]
        
        # 计算引用密度（段落数/引用数）
        paragraphs = [p for p in answer.split('\n\n') if p.strip()]
        citation_density = len(used_refs) / len(paragraphs) if paragraphs else 0
        
        # 评估质量
        quality_score = 1.0
        if not has_citations:
            quality_score *= 0.3
        if invalid_refs:
            quality_score *= 0.7
        if citation_density < self.min_citation_ratio:
            quality_score *= 0.8
        
        return {
            "has_citations": has_citations,
            "citation_count": len(used_refs),
            "unique_citation_count": len(set(used_refs)),
            "invalid_citations": invalid_refs,
            "citation_density": citation_density,
            "quality_score": round(quality_score, 2),
            "is_valid": quality_score >= 0.5 and not invalid_refs,
        }
