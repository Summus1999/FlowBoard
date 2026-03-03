"""
FlowBoard Pytest 配置和共享 Fixture
用于 ai_service 后端服务的单元测试
"""

import pytest
import asyncio
from typing import Generator
from unittest.mock import Mock, AsyncMock
import tempfile
import os

# ============================================
# 异步测试支持
# ============================================

@pytest.fixture(scope="session")
def event_loop():
    """创建事件循环供异步测试使用"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

# ============================================
# Mock 数据 Fixture
# ============================================

@pytest.fixture
def mock_qwen_config():
    """通义千问配置"""
    return {
        "api_key": "sk-test-qwen-key",
        "base_url": "https://dashscope.aliyuncs.com/api/v1",
        "model": "qwen-max",
        "enabled": True
    }

@pytest.fixture
def mock_kimi_config():
    """Kimi 配置"""
    return {
        "api_key": "sk-test-kimi-key",
        "base_url": "https://api.moonshot.cn/v1",
        "model": "moonshot-v1-8k",
        "enabled": True
    }

@pytest.fixture
def mock_glm_config():
    """智谱 GLM 配置"""
    return {
        "api_key": "test-glm-key",
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "model": "glm-4",
        "enabled": False
    }

@pytest.fixture
def mock_provider_configs(mock_qwen_config, mock_kimi_config, mock_glm_config):
    """所有 Provider 配置"""
    return {
        "qwen": mock_qwen_config,
        "kimi": mock_kimi_config,
        "glm": mock_glm_config
    }

@pytest.fixture
def mock_chat_messages():
    """模拟对话消息"""
    return [
        {"role": "user", "content": "你好"},
        {"role": "assistant", "content": "您好！有什么可以帮助您的吗？"},
        {"role": "user", "content": "帮我制定一个学习计划"}
    ]

@pytest.fixture
def mock_embedding_response():
    """模拟嵌入向量响应"""
    return [0.1] * 1024  # 1024维向量

@pytest.fixture
def mock_retrieval_chunks():
    """模拟检索到的文档块"""
    return [
        {
            "id": "chunk_001",
            "content": "JavaScript 闭包是指函数能够记住并访问它的词法作用域...",
            "metadata": {"doc_id": "doc_001", "section": "基础概念"},
            "score": 0.95
        },
        {
            "id": "chunk_002",
            "content": "闭包在实际开发中常用于数据封装和模块化...",
            "metadata": {"doc_id": "doc_001", "section": "应用场景"},
            "score": 0.88
        }
    ]

# ============================================
# 服务 Mock Fixture
# ============================================

@pytest.fixture
def mock_llm_client():
    """模拟 LLM 客户端"""
    client = Mock()
    client.generate = AsyncMock(return_value="这是生成的回答")
    client.generate_stream = AsyncMock(return_value=AsyncIteratorMock([
        {"choices": [{"delta": {"content": "这是"}}]},
        {"choices": [{"delta": {"content": "生成的"}}]},
        {"choices": [{"delta": {"content": "回答"}}]}
    ]))
    client.embed = AsyncMock(return_value=[0.1] * 1024)
    return client

@pytest.fixture
def mock_vector_store():
    """模拟向量存储"""
    store = Mock()
    store.upsert_embeddings = AsyncMock(return_value=True)
    store.query_similar = AsyncMock(return_value=[
        {"id": "chunk_001", "score": 0.95, "content": "测试内容"}
    ])
    store.delete_embeddings = AsyncMock(return_value=True)
    return store

@pytest.fixture
def mock_db_session():
    """模拟数据库会话"""
    session = Mock()
    session.add = Mock()
    session.commit = Mock()
    session.refresh = Mock()
    session.query = Mock(return_value=Mock(
        filter=Mock(return_value=Mock(
            first=Mock(return_value=None),
            all=Mock(return_value=[])
        ))
    ))
    return session

# ============================================
# 工具类
# ============================================

class AsyncIteratorMock:
    """用于模拟异步生成器的辅助类"""
    
    def __init__(self, items):
        self.items = items
        self.index = 0
    
    def __aiter__(self):
        return self
    
    async def __anext__(self):
        if self.index >= len(self.items):
            raise StopAsyncIteration
        item = self.items[self.index]
        self.index += 1
        return item

# ============================================
# 环境配置
# ============================================

@pytest.fixture(scope="session")
def test_db_path():
    """创建临时数据库文件"""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "test.db")
        yield db_path

@pytest.fixture
def test_env_vars():
    """设置测试环境变量"""
    original_env = dict(os.environ)
    os.environ.update({
        "DATABASE_URL": "sqlite:///./test.db",
        "QWEN_API_KEY": "sk-test-qwen",
        "KIMI_API_KEY": "sk-test-kimi",
        "GLM_API_KEY": "test-glm",
        "API_TOKEN": "test-api-token"
    })
    yield
    os.environ.clear()
    os.environ.update(original_env)

# ============================================
# Pytest 配置
# ============================================

def pytest_configure(config):
    """Pytest 配置"""
    config.addinivalue_line(
        "markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')"
    )
    config.addinivalue_line(
        "markers", "integration: marks tests as integration tests"
    )

def pytest_collection_modifyitems(config, items):
    """修改测试项"""
    pass
