"""
文档解析器测试
"""

import os
import tempfile
import pytest

from app.services.document_parser import (
    get_parser_service,
    PDFParser,
    DOCXParser,
    TXTParser,
)


class TestTXTParser:
    """TXT解析器测试"""
    
    def test_parse_simple_txt(self):
        """测试解析简单文本文件"""
        parser = TXTParser()
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("这是一个测试文档。\n")
            f.write("第二行内容。\n")
            temp_path = f.name
        
        try:
            result = parser.parse(temp_path)
            
            assert result.file_name.endswith('.txt')
            assert "这是一个测试文档" in result.content
            assert result.mime_type == "text/plain"
            assert result.metadata["is_markdown"] is False
        finally:
            os.unlink(temp_path)
    
    def test_parse_markdown(self):
        """测试解析Markdown文件"""
        parser = TXTParser()
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
            f.write("---\n")
            f.write("title: 测试文档\n")
            f.write("author: Test\n")
            f.write("---\n")
            f.write("# 标题\n")
            f.write("正文内容\n")
            temp_path = f.name
        
        try:
            result = parser.parse(temp_path)
            
            assert result.mime_type == "text/markdown"
            assert result.metadata["is_markdown"] is True
            assert "# 标题" in result.content
        finally:
            os.unlink(temp_path)


class TestParserService:
    """解析服务测试"""
    
    def test_get_supported_extensions(self):
        """测试获取支持的扩展名"""
        service = get_parser_service()
        
        extensions = service.get_supported_extensions()
        
        assert '.txt' in extensions
        assert '.md' in extensions
        assert '.pdf' in extensions
        assert '.docx' in extensions
    
    def test_can_parse(self):
        """测试文件格式检查"""
        service = get_parser_service()
        
        assert service.can_parse("test.txt") is True
        assert service.can_parse("test.md") is True
        assert service.can_parse("test.pdf") is True
        assert service.can_parse("test.docx") is True
        assert service.can_parse("test.jpg") is False
