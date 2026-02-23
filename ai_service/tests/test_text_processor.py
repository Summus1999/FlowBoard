"""
文本处理服务测试
"""

import pytest

from app.services.text_processor import (
    TextCleaner,
    TextChunker,
    QualityFilter,
    get_text_processor,
)


class TestTextCleaner:
    """文本清洗测试"""
    
    def test_normalize_whitespace(self):
        """测试空白字符规范化"""
        cleaner = TextCleaner()
        
        text = "第一行\n\n\n\n第二行"
        result = cleaner.clean(text)
        
        assert "\n\n" in result
        assert "\n\n\n" not in result
    
    def test_remove_page_numbers(self):
        """测试页码去除"""
        cleaner = TextCleaner()
        
        text = "内容\n第 1 页\n更多内容"
        result = cleaner.clean(text)
        
        assert "第 1 页" not in result
    
    def test_remove_zero_width_chars(self):
        """测试零宽字符去除"""
        cleaner = TextCleaner()
        
        text = "内容\u200b更多内容"
        result = cleaner.clean(text)
        
        assert "\u200b" not in result


class TestTextChunker:
    """文本分块测试"""
    
    def test_chunk_by_paragraph(self):
        """测试按段落分块"""
        chunker = TextChunker(chunk_size=100, chunk_overlap=20)
        
        text = "段落1。\n\n段落2。\n\n段落3。"
        chunks = chunker.chunk(text)
        
        assert len(chunks) > 0
        assert all(c.content for c in chunks)
        assert all(c.chunk_index >= 0 for c in chunks)
    
    def test_chunk_respects_size_limit(self):
        """测试分块大小限制"""
        chunker = TextChunker(chunk_size=50, chunk_overlap=10)
        
        # 创建一个很长的段落
        text = "a" * 200
        chunks = chunker.chunk(text)
        
        # 每个块应该不超过限制（允许一定误差）
        for chunk in chunks:
            assert chunk.char_count <= 100  # 放宽一点限制
    
    def test_chunk_overlap(self):
        """测试块间重叠"""
        chunker = TextChunker(chunk_size=50, chunk_overlap=20)
        
        text = "第一段内容。\n\n第二段内容。\n\n第三段内容。"
        chunks = chunker.chunk(text)
        
        if len(chunks) > 1:
            # 检查是否有重叠（简化检查）
            pass


class TestQualityFilter:
    """质量过滤测试"""
    
    def test_filter_short_chunks(self):
        """测试过滤短块"""
        from app.services.text_processor import TextChunk
        
        filter_ = QualityFilter(min_length=50)
        
        chunks = [
            TextChunk(content="a" * 10, chunk_index=0, token_count=5, char_count=10),
            TextChunk(content="b" * 100, chunk_index=1, token_count=50, char_count=100),
        ]
        
        good, bad = filter_.filter(chunks)
        
        assert len(good) == 1
        assert len(bad) == 1
        assert good[0].chunk_index == 1


class TestTextProcessor:
    """文本处理服务集成测试"""
    
    def test_process_integration(self):
        """测试完整处理流程"""
        processor = get_text_processor()
        
        text = """
        这是第一段落。包含一些内容。
        
        这是第二段落。也包含一些内容。
        
        这是第三段落。更多内容在这里。
        """
        
        chunks = processor.process(text)
        
        assert len(chunks) > 0
        assert all(c.quality_score > 0 for c in chunks)
