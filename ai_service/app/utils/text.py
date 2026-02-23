"""
文本处理工具
"""

import re
from typing import List


def normalize_text(text: str) -> str:
    """
    标准化文本
    - 统一空白字符
    - 标准化标点
    """
    # 统一空白字符
    text = re.sub(r'\s+', ' ', text)
    
    # 标准化中英文标点（可选）
    # text = text.replace('，', ',').replace('。', '.')
    
    return text.strip()


def split_into_chunks(
    text: str,
    chunk_size: int = 500,
    overlap: int = 100,
) -> List[str]:
    """
    将文本切分为块
    
    简单的滑动窗口切分
    实际生产环境可能需要更复杂的语义切分
    """
    chunks = []
    start = 0
    
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk)
        start = end - overlap
    
    return chunks


def estimate_tokens(text: str) -> int:
    """
    估算token数量
    
    简化的估算方法：中文字符 + 英文单词数
    """
    # 中文字符数
    chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
    
    # 英文单词数（近似）
    english_words = len(re.findall(r'[a-zA-Z]+', text))
    
    # 简单估算：中文字符 + 英文单词 * 1.3
    return int(chinese_chars + english_words * 1.3)


def truncate_text(text: str, max_tokens: int = 4000) -> str:
    """截断文本到指定token数"""
    # 简单估算：平均每个token约1.5个字符
    max_chars = int(max_tokens * 1.5)
    
    if len(text) <= max_chars:
        return text
    
    return text[:max_chars] + "..."
