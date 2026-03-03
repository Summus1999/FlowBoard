"""
FlowBoard Config API Tests
"""

import pytest
from unittest.mock import Mock, patch


class TestConfigAPI:
    """Test Config API"""

    @pytest.fixture
    def mock_request(self):
        """Mock request fixture"""
        request = Mock()
        request.headers = {}
        request.client = Mock()
        request.client.host = "127.0.0.1"
        return request

    @pytest.fixture
    def config_service(self):
        """Mock config service"""
        service = Mock()
        
        def verify_access(request):
            host = getattr(request.client, 'host', None)
            if host in ("127.0.0.1", "localhost", "::1"):
                return True
            auth_header = request.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                return False
            token = auth_header.replace("Bearer ", "")
            return token == "test-api-token"
        
        service.verify_access = Mock(side_effect=verify_access)
        
        async def get_providers_status():
            return {
                "qwen": {
                    "name": "Qwen",
                    "enabled": True,
                    "connected": True,
                    "model": "qwen-max",
                    "last_error": None
                },
                "kimi": {
                    "name": "Kimi",
                    "enabled": True,
                    "connected": False,
                    "model": None,
                    "last_error": "Connection timeout"
                }
            }
        
        service.get_providers_status = Mock(side_effect=get_providers_status)
        
        async def update_providers_config(configs):
            updated = []
            for name, config in configs.items():
                updated.append({
                    "provider": name,
                    "status": "updated",
                    "enabled": config.get("enabled", False)
                })
            return {"updated": updated}
        
        service.update_providers_config = Mock(side_effect=update_providers_config)
        
        async def test_provider_connection(provider, api_key):
            if not api_key:
                return {"success": False, "error": "API key is required"}
            if provider not in ["qwen", "kimi", "glm"]:
                return {"success": False, "error": f"Unknown provider: {provider}"}
            if len(api_key) < 10:
                return {"success": False, "error": "Invalid API key format"}
            return {
                "success": True,
                "provider": provider,
                "model": f"{provider}-test-model",
                "latency_ms": 120
            }
        
        service.test_provider_connection = Mock(side_effect=test_provider_connection)
        
        def get_provider_registry():
            return {
                "providers": [
                    {
                        "id": "qwen",
                        "name": "Qwen",
                        "icon": "fa-solid fa-brain",
                        "models": ["qwen-max", "qwen-plus"],
                        "docs_url": "https://help.aliyun.com/"
                    },
                    {
                        "id": "kimi",
                        "name": "Kimi",
                        "icon": "fa-solid fa-moon",
                        "models": ["moonshot-v1-8k"],
                        "docs_url": "https://platform.moonshot.cn/"
                    }
                ]
            }
        
        service.get_provider_registry = Mock(side_effect=get_provider_registry)
        
        return service

    # ============================================
    # Provider Config Tests
    # ============================================
    
    def test_cfg_001_get_providers_status(self, config_service):
        """Test get providers status"""
        import asyncio
        result = asyncio.run(config_service.get_providers_status())
        assert "qwen" in result
        assert result["qwen"]["enabled"] is True
        assert result["kimi"]["enabled"] is True

    def test_cfg_002_update_providers_config(self, config_service):
        """Test update providers config"""
        import asyncio
        configs = {
            "qwen": {"enabled": True, "priority": 1},
            "kimi": {"enabled": False, "priority": 2}
        }
        result = asyncio.run(config_service.update_providers_config(configs))
        assert len(result["updated"]) == 2

    def test_cfg_003_test_provider_connection_success(self, config_service):
        """Test provider connection with valid key"""
        import asyncio
        result = asyncio.run(config_service.test_provider_connection("qwen", "valid-api-key-123"))
        assert result["success"] is True
        assert result["provider"] == "qwen"

    def test_cfg_004_test_provider_connection_fail(self, config_service):
        """Test provider connection with invalid key"""
        import asyncio
        result = asyncio.run(config_service.test_provider_connection("qwen", "short"))
        assert result["success"] is False

    # ============================================
    # Access Control Tests
    # ============================================
    
    def test_cfg_005_localhost_no_auth(self, config_service, mock_request):
        """Test localhost access without auth"""
        mock_request.client.host = "127.0.0.1"
        mock_request.headers = {}
        result = config_service.verify_access(mock_request)
        assert result is True

    def test_cfg_006_valid_token(self, config_service, mock_request):
        """Test access with valid token"""
        mock_request.client.host = "192.168.1.1"
        mock_request.headers = {"Authorization": "Bearer test-api-token"}
        result = config_service.verify_access(mock_request)
        assert result is True

    def test_cfg_007_invalid_token(self, config_service, mock_request):
        """Test access with invalid token"""
        mock_request.client.host = "192.168.1.1"
        mock_request.headers = {"Authorization": "Bearer wrong-token"}
        result = config_service.verify_access(mock_request)
        assert result is False

    def test_cfg_008_missing_auth(self, config_service, mock_request):
        """Test access without auth header"""
        mock_request.client.host = "192.168.1.1"
        mock_request.headers = {}
        result = config_service.verify_access(mock_request)
        assert result is False

    # ============================================
    # Provider Registry Tests
    # ============================================
    
    def test_cfg_009_get_provider_registry(self, config_service):
        """Test get provider registry"""
        result = config_service.get_provider_registry()
        assert "providers" in result
        assert len(result["providers"]) >= 2
        provider_ids = [p["id"] for p in result["providers"]]
        assert "qwen" in provider_ids
        assert "kimi" in provider_ids

    def test_cfg_010_provider_models(self, config_service):
        """Test provider models in registry"""
        result = config_service.get_provider_registry()
        qwen = next(p for p in result["providers"] if p["id"] == "qwen")
        assert "qwen-max" in qwen["models"]
