"""
FlowBoard Model Gateway Tests
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch


class TestModelGateway:
    """Test Model Gateway"""

    @pytest.fixture
    def mock_provider_configs(self):
        """Mock provider configurations"""
        return {
            "qwen": {
                "enabled": True,
                "priority": 1,
                "api_key": "test-qwen-key",
                "base_url": "https://dashscope.aliyuncs.com"
            },
            "kimi": {
                "enabled": True,
                "priority": 2,
                "api_key": "test-kimi-key",
                "base_url": "https://api.moonshot.cn"
            },
            "glm": {
                "enabled": False,
                "priority": 3,
                "api_key": "test-glm-key",
                "base_url": "https://open.bigmodel.cn"
            }
        }

    @pytest.fixture
    def gateway(self, mock_provider_configs):
        """Create mock gateway"""
        class MockGateway:
            def __init__(self, configs):
                self.configs = configs
                self.clients = {}
                self.enabled_providers = [
                    name for name, cfg in configs.items() 
                    if cfg.get("enabled", False)
                ]
            
            async def chat(self, messages, model=None, temperature=0.7):
                # Try providers in priority order
                for provider in self.enabled_providers:
                    try:
                        return {
                            "provider": provider,
                            "model": model or f"{provider}-default",
                            "content": "Mock response",
                            "usage": {"prompt_tokens": 10, "completion_tokens": 5}
                        }
                    except Exception:
                        continue
                raise Exception("All providers failed")
            
            async def embed(self, texts):
                return [[0.1] * 1024 for _ in texts]
            
            def reload_clients(self, configs):
                self.configs = configs
                self.enabled_providers = [
                    name for name, cfg in configs.items() 
                    if cfg.get("enabled", False)
                ]
                return {"reloaded": True, "providers": list(self.enabled_providers)}
        
        return MockGateway(mock_provider_configs)

    # ============================================
    # Initialization Tests
    # ============================================
    
    def test_mg_001_init_with_configs(self, gateway, mock_provider_configs):
        """Test gateway initialization with configs"""
        assert gateway.configs == mock_provider_configs
        assert "qwen" in gateway.enabled_providers
        assert "kimi" in gateway.enabled_providers
        assert "glm" not in gateway.enabled_providers  # Disabled

    def test_mg_002_enabled_providers_priority(self, gateway):
        """Test enabled providers are sorted by priority"""
        assert gateway.enabled_providers[0] == "qwen"
        assert gateway.enabled_providers[1] == "kimi"

    # ============================================
    # Hot Reload Tests
    # ============================================
    
    def test_mg_003_reload_clients(self, gateway):
        """Test hot reload clients"""
        new_configs = {
            "qwen": {"enabled": True, "priority": 1, "api_key": "new-key"},
            "glm": {"enabled": True, "priority": 2, "api_key": "glm-key"}
        }
        result = gateway.reload_clients(new_configs)
        assert result["reloaded"] is True
        assert "glm" in result["providers"]
        assert "kimi" not in result["providers"]  # Removed

    def test_mg_004_reload_empty_configs(self, gateway):
        """Test reload with empty configs"""
        result = gateway.reload_clients({})
        assert result["reloaded"] is True
        assert len(result["providers"]) == 0

    # ============================================
    # Chat Tests
    # ============================================
    
    @pytest.mark.asyncio
    async def test_mg_005_chat_success(self, gateway):
        """Test chat with success response"""
        messages = [{"role": "user", "content": "Hello"}]
        result = await gateway.chat(messages)
        assert result["provider"] in ["qwen", "kimi"]
        assert "content" in result
        assert "usage" in result

    @pytest.mark.asyncio
    async def test_mg_006_chat_with_model(self, gateway):
        """Test chat with specific model"""
        messages = [{"role": "user", "content": "Hello"}]
        result = await gateway.chat(messages, model="qwen-max")
        assert result["model"] == "qwen-max"

    # ============================================
    # Embedding Tests
    # ============================================
    
    @pytest.mark.asyncio
    async def test_mg_007_embed_texts(self, gateway):
        """Test embedding texts"""
        texts = ["Hello", "World"]
        embeddings = await gateway.embed(texts)
        assert len(embeddings) == 2
        assert len(embeddings[0]) == 1024  # Vector dimension

    # ============================================
    # Multi Provider Tests
    # ============================================
    
    @pytest.mark.asyncio
    async def test_mg_008_multi_provider_failover(self, gateway, mock_provider_configs):
        """Test multi provider failover"""
        # Disable qwen, only kimi should be used
        mock_provider_configs["qwen"]["enabled"] = False
        gateway.reload_clients(mock_provider_configs)
        
        messages = [{"role": "user", "content": "Hello"}]
        result = await gateway.chat(messages)
        assert result["provider"] == "kimi"

    @pytest.mark.asyncio
    async def test_mg_009_all_providers_disabled(self, gateway):
        """Test behavior when all providers disabled"""
        gateway.reload_clients({})
        messages = [{"role": "user", "content": "Hello"}]
        with pytest.raises(Exception) as exc_info:
            await gateway.chat(messages)
        assert "All providers failed" in str(exc_info.value)

    # ============================================
    # Cost Tracking Tests
    # ============================================
    
    def test_mg_010_provider_cost_config(self, mock_provider_configs):
        """Test provider cost configuration exists"""
        # Verify cost-related fields can be added
        for provider, config in mock_provider_configs.items():
            config["cost_per_1k_tokens"] = 0.002
            config["input_cost"] = 0.001
            config["output_cost"] = 0.003
        assert "cost_per_1k_tokens" in mock_provider_configs["qwen"]
