"""
模型网关测试
"""

import pytest
from app.services.model_gateway import ModelGateway, ModelProvider, ModelProfile


class TestModelGateway:
    """模型网关测试类"""
    
    def test_singleton(self):
        """测试单例模式"""
        from app.services.model_gateway import get_model_gateway
        
        gateway1 = get_model_gateway()
        gateway2 = get_model_gateway()
        
        assert gateway1 is gateway2
    
    def test_provider_selection(self):
        """测试提供商选择"""
        gateway = ModelGateway()
        
        # 没有配置API key时应该抛出异常
        with pytest.raises(Exception):
            gateway._select_provider()
    
    def test_model_profile_mapping(self):
        """测试模型配置档映射"""
        gateway = ModelGateway()
        
        model = gateway._get_model_for_profile(ModelProfile.HIGH_QUALITY, ModelProvider.QWEN)
        assert model == "qwen-max"
        
        model = gateway._get_model_for_profile(ModelProfile.BALANCED, ModelProvider.QWEN)
        assert model == "qwen-plus"
        
        model = gateway._get_model_for_profile(ModelProfile.COST_EFFECTIVE, ModelProvider.QWEN)
        assert model == "qwen-turbo"


@pytest.mark.asyncio
async def test_cost_estimation():
    """测试成本估算"""
    gateway = ModelGateway()
    
    token_usage = {
        "prompt_tokens": 1000,
        "completion_tokens": 500,
    }
    
    cost = gateway._estimate_cost("qwen-max", token_usage)
    assert cost > 0
    
    # 测试预算检查
    assert gateway.check_budget() is True
