"""
文本处理服务
清洗、分块、质量评估
"""

import re
from dataclasses import dataclass
from typing import List, Optional, Tuple

from app.core.logging import get_logger
from app.core.config import settings

logger = get_logger(__name__)


@dataclass
class TextChunk:
    """文本块"""
    content: str
    chunk_index: int
    token_count: int
    char_count: int
    section_path: Optional[str] = None
    page_number: Optional[int] = None
    position_start: int = 0
    position_end: int = 0
    quality_score: float = 0.0


class TextCleaner:
    """文本清洗器"""
    
    def __init__(
        self,
        remove_headers_footers: bool = True,
        remove_page_numbers: bool = True,
        normalize_whitespace: bool = True,
        remove_url_noise: bool = True,
    ):
        self.remove_headers_footers = remove_headers_footers
        self.remove_page_numbers = remove_page_numbers
        self.normalize_whitespace = normalize_whitespace
        self.remove_url_noise = remove_url_noise
    
    def clean(self, text: str) -> str:
        """
        清洗文本
        
        处理规则：
        1. 去除页眉页脚
        2. 去除页码
        3. 规范化空白字符
        4. 去除URL噪声
        5. 标准化标点
        """
        original_length = len(text)
        
        # 去除页眉页脚标记
        if self.remove_headers_footers:
            text = self._remove_headers_footers(text)
        
        # 去除页码
        if self.remove_page_numbers:
            text = self._remove_page_numbers(text)
        
        # 规范化空白字符
        if self.normalize_whitespace:
            text = self._normalize_whitespace(text)
        
        # 去除URL噪声（保留URL文本，去除过长或无意义的）
        if self.remove_url_noise:
            text = self._remove_url_noise(text)
        
        # 标准化标点
        text = self._normalize_punctuation(text)
        
        # 去除过短的行（可能是噪声）
        text = self._remove_short_lines(text)
        
        cleaned_length = len(text)
        reduction = (original_length - cleaned_length) / original_length * 100 if original_length > 0 else 0
        
        logger.info(
            "text.cleaned",
            original_length=original_length,
            cleaned_length=cleaned_length,
            reduction_percent=round(reduction, 2),
        )
        
        return text.strip()
    
    def _remove_headers_footers(self, text: str) -> str:
        """去除页眉页脚"""
        # 去除常见的页眉页脚模式
        lines = text.split('\n')
        cleaned_lines = []
        
        for line in lines:
            # 跳过疑似页眉页脚的行（短且重复的模式）
            stripped = line.strip()
            if len(stripped) < 50:
                # 检查是否为页眉页脚模式
                if re.match(r'^(第\s*\d+\s*页|Page\s*\d+|\d+\s*/\s*\d+)$', stripped):
                    continue
            cleaned_lines.append(line)
        
        return '\n'.join(cleaned_lines)
    
    def _remove_page_numbers(self, text: str) -> str:
        """去除页码标记"""
        # 匹配常见的页码格式
        patterns = [
            r'\n\s*第\s*\d+\s*页\s*\n',
            r'\n\s*Page\s*\d+\s*\n',
            r'\n\s*\d+\s*/\s*\d+\s*\n',
            r'\n\s*---\s*Page\s*\d+\s*---\s*\n',
        ]
        
        for pattern in patterns:
            text = re.sub(pattern, '\n', text, flags=re.IGNORECASE)
        
        return text
    
    def _normalize_whitespace(self, text: str) -> str:
        """规范化空白字符"""
        # 统一换行符
        text = text.replace('\r\n', '\n').replace('\r', '\n')
        
        # 去除连续空白行
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        # 去除行首行尾空白
        lines = [line.strip() for line in text.split('\n')]
        
        return '\n'.join(lines)
    
    def _remove_url_noise(self, text: str) -> str:
        """去除URL噪声"""
        # 去除过长的URL（可能是数据噪声）
        url_pattern = r'https?://[^\s]{200,}'
        text = re.sub(url_pattern, '[URL]', text)
        
        return text
    
    def _normalize_punctuation(self, text: str) -> str:
        """标准化标点"""
        # 统一中英文标点（可选，根据需要开启）
        # text = text.replace('，', ', ').replace('。', '. ')
        # text = text.replace('"', '"').replace('"', '"')
        
        # 去除零宽字符
        zero_width_chars = '\u200b\u200c\u200d\ufeff'
        for char in zero_width_chars:
            text = text.replace(char, '')
        
        return text
    
    def _remove_short_lines(self, text: str) -> str:
        """去除过短的行（可能是噪声）"""
        lines = text.split('\n')
        cleaned_lines = []
        
        for line in lines:
            # 保留有意义的短行（如标题、列表项）
            stripped = line.strip()
            if len(stripped) < 3:
                # 检查是否为列表项或标题
                if not re.match(r'^[\*\-\+•]\s*\w', stripped) and not re.match(r'^#{1,6}\s', stripped):
                    continue
            cleaned_lines.append(line)
        
        return '\n'.join(cleaned_lines)


class TextChunker:
    """文本分块器"""
    
    def __init__(
        self,
        chunk_size: int = None,
        chunk_overlap: int = None,
        respect_paragraphs: bool = True,
        respect_sections: bool = True,
    ):
        self.chunk_size = chunk_size or settings.RAG_CHUNK_SIZE
        self.chunk_overlap = chunk_overlap or settings.RAG_CHUNK_OVERLAP
        self.respect_paragraphs = respect_paragraphs
        self.respect_sections = respect_sections
    
    def chunk(self, text: str, section_path: str = None) -> List[TextChunk]:
        """
        将文本分块
        
        策略：
        1. 优先按段落边界切分
        2. 如果段落过长，按句子切分
        3. 保持上下文重叠
        """
        chunks = []
        
        # 按章节切分（如果存在）
        if self.respect_sections:
            sections = self._split_by_sections(text)
        else:
            sections = [(section_path or "", text)]
        
        chunk_index = 0
        
        for section, section_text in sections:
            section_chunks = self._chunk_section(section_text, section, chunk_index)
            chunks.extend(section_chunks)
            chunk_index += len(section_chunks)
        
        logger.info(
            "text.chunked",
            total_chunks=len(chunks),
            avg_chunk_size=sum(c.char_count for c in chunks) / len(chunks) if chunks else 0,
        )
        
        return chunks
    
    def _split_by_sections(self, text: str) -> List[Tuple[str, str]]:
        """按章节切分文本"""
        # Markdown标题模式
        section_pattern = r'\n(#{1,6}\s+.+?)\n'
        
        parts = re.split(section_pattern, text)
        
        if len(parts) <= 1:
            # 没有章节，返回整体
            return [("", text)]
        
        sections = []
        current_section = ""
        current_content = parts[0]  # 开头的无标题内容
        
        for i in range(1, len(parts), 2):
            if current_content.strip():
                sections.append((current_section, current_content))
            
            current_section = parts[i].strip()
            if i + 1 < len(parts):
                current_content = parts[i + 1]
            else:
                current_content = ""
        
        if current_content.strip():
            sections.append((current_section, current_content))
        
        return sections
    
    def _chunk_section(self, text: str, section: str, start_index: int) -> List[TextChunk]:
        """对单个章节分块"""
        chunks = []
        
        # 按段落切分
        paragraphs = text.split('\n\n')
        
        current_chunk = []
        current_size = 0
        position = 0
        
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            
            para_size = len(para)
            
            # 如果当前块加上新段落超过限制，先保存当前块
            if current_size + para_size > self.chunk_size and current_chunk:
                chunk_text = '\n\n'.join(current_chunk)
                chunks.append(self._create_chunk(
                    chunk_text, start_index + len(chunks), section, position
                ))
                
                # 保留重叠部分
                overlap_text = self._get_overlap_text(current_chunk)
                current_chunk = [overlap_text, para] if overlap_text else [para]
                current_size = len(overlap_text) + para_size if overlap_text else para_size
                position += len(chunk_text) - len(overlap_text) if overlap_text else len(chunk_text)
            else:
                current_chunk.append(para)
                current_size += para_size
        
        # 保存最后一个块
        if current_chunk:
            chunk_text = '\n\n'.join(current_chunk)
            chunks.append(self._create_chunk(
                chunk_text, start_index + len(chunks), section, position
            ))
        
        return chunks
    
    def _get_overlap_text(self, chunks: List[str]) -> str:
        """获取重叠文本"""
        overlap_size = 0
        overlap_chunks = []
        
        # 从后往前累加，直到达到overlap大小
        for chunk in reversed(chunks):
            overlap_chunks.insert(0, chunk)
            overlap_size += len(chunk)
            if overlap_size >= self.chunk_overlap:
                break
        
        return '\n\n'.join(overlap_chunks)
    
    def _create_chunk(
        self,
        content: str,
        chunk_index: int,
        section_path: str,
        position_start: int,
    ) -> TextChunk:
        """创建文本块"""
        char_count = len(content)
        token_count = self._estimate_tokens(content)
        quality_score = self._calculate_quality(content)
        
        return TextChunk(
            content=content,
            chunk_index=chunk_index,
            token_count=token_count,
            char_count=char_count,
            section_path=section_path,
            position_start=position_start,
            position_end=position_start + char_count,
            quality_score=quality_score,
        )
    
    def _estimate_tokens(self, text: str) -> int:
        """估算token数量"""
        # 中文字符数 + 英文单词数 * 1.3
        chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
        english_words = len(re.findall(r'[a-zA-Z]+', text))
        return int(chinese_chars + english_words * 1.3)
    
    def _calculate_quality(self, content: str) -> float:
        """计算文本块质量分"""
        score = 1.0
        
        # 长度检查
        if len(content) < 50:
            score *= 0.5
        
        # 有效字符比例
        total_chars = len(content)
        valid_chars = len(re.findall(r'[\u4e00-\u9fffa-zA-Z0-9]', content))
        if total_chars > 0:
            valid_ratio = valid_chars / total_chars
            if valid_ratio < 0.5:
                score *= 0.7
        
        # 重复检查
        lines = content.split('\n')
        unique_lines = set(lines)
        if len(lines) > 0:
            duplicate_ratio = 1 - len(unique_lines) / len(lines)
            if duplicate_ratio > 0.3:
                score *= 0.6
        
        return round(score, 2)


class QualityFilter:
    """质量过滤器"""
    
    def __init__(
        self,
        min_length: int = 50,
        min_valid_ratio: float = 0.5,
        max_duplicate_ratio: float = 0.3,
    ):
        self.min_length = min_length
        self.min_valid_ratio = min_valid_ratio
        self.max_duplicate_ratio = max_duplicate_ratio
    
    def filter(self, chunks: List[TextChunk]) -> Tuple[List[TextChunk], List[TextChunk]]:
        """
        过滤低质量块
        
        Returns:
            (高质量块列表, 低质量块列表)
        """
        good_chunks = []
        bad_chunks = []
        
        for chunk in chunks:
            if self._is_quality_chunk(chunk):
                good_chunks.append(chunk)
            else:
                bad_chunks.append(chunk)
        
        logger.info(
            "quality.filter",
            total=len(chunks),
            good=len(good_chunks),
            bad=len(bad_chunks),
        )
        
        return good_chunks, bad_chunks
    
    def _is_quality_chunk(self, chunk: TextChunk) -> bool:
        """检查块质量"""
        # 长度检查
        if chunk.char_count < self.min_length:
            return False
        
        # 质量分检查
        if chunk.quality_score < 0.5:
            return False
        
        return True


class TextProcessor:
    """文本处理服务（整合清洗、分块、过滤）"""
    
    def __init__(
        self,
        cleaner: TextCleaner = None,
        chunker: TextChunker = None,
        quality_filter: QualityFilter = None,
    ):
        self.cleaner = cleaner or TextCleaner()
        self.chunker = chunker or TextChunker()
        self.quality_filter = quality_filter or QualityFilter()
    
    def process(self, raw_text: str, section_path: str = None) -> List[TextChunk]:
        """
        处理文本：清洗 -> 分块 -> 过滤
        
        Args:
            raw_text: 原始文本
            section_path: 章节路径
        
        Returns:
            高质量文本块列表
        """
        # 清洗
        cleaned_text = self.cleaner.clean(raw_text)
        
        if not cleaned_text.strip():
            logger.warning("text_processor.empty_after_clean")
            return []
        
        # 分块
        chunks = self.chunker.chunk(cleaned_text, section_path)
        
        # 过滤
        good_chunks, _ = self.quality_filter.filter(chunks)
        
        return good_chunks


# 全局处理服务实例
_processor: Optional[TextProcessor] = None


def get_text_processor() -> TextProcessor:
    """获取文本处理服务单例"""
    global _processor
    if _processor is None:
        _processor = TextProcessor()
    return _processor
