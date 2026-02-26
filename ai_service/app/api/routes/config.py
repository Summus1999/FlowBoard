"""
AI 配置管理 API
管理模型提供商配置和热更新
"""

from typing import Dict, Optional
from enum import Enum
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Request, status
import time
import os

from app.core.config import settings
from app.core.logging import get_logger
from app.services.model_gateway import (
    get_model_gateway, 
    ModelProvider, 
    PROVIDER_REGISTRY,
    ModelProfile
)

logger = get_logger(__name__)

router = APIRouter(prefix="/config", tags=["config"])


class ProviderConfig(BaseModel):
    """提供商配置"""
    api_key: str = Field(..., description="API Key")
    enabled: bool = Field(default=True, description="是否启用")


class ProvidersConfigRequest(BaseModel):
    """更新提供商配置请求"""
    providers: Dict[str, ProviderConfig] = Field(..., description="各提供商配置")
    default_provider: str = Field(default="qwen", description="默认提供商")
    fallback_provider: str = Field(default="kimi", description="降级提供商")
    monthly_budget: float = Field(default=150.0, description="月度预算(元)")


class ProviderStatus(BaseModel):
    """提供商状态"""
    enabled: bool
    connected: bool
    model: str


class ProvidersStatusResponse(BaseModel):
    """提供商状态响应"""
    providers: Dict[str, ProviderStatus]
    default_provider: str
    fallback_provider: str
    monthly_budget: float
    cost_used: float


class TestProviderRequest(BaseModel):
    """测试提供商请求"""
    provider: str = Field(..., description="提供商名称")
    api_key: str = Field(..., description="API Key")


class TestProviderResponse(BaseModel):
    """测试提供商响应"""
    provider: str
    success: bool
    latency_ms: float
    error: Optional[str] = None


class UpdateProvidersResponse(BaseModel):
    """更新提供商配置响应"""
    status: str
    active_providers: list[str]


def is_localhost_request(request: Request) -> bool:
    """检查请求是否来自本地"""
    client_host = request.client.host if request.client else None
    forwarded_for = request.headers.get("x-forwarded-for")
    
    # 允许 localhost 和 127.0.0.1
    allowed_hosts = {"127.0.0.1", "localhost", "::1"}
    
    if client_host and client_host in allowed_hosts:
        return True
    if forwarded_for and any(h in forwarded_for for h in allowed_hosts):
        return True
    
    return False


@router.post(
    "/providers",
    response_model=UpdateProvidersResponse,
    summary="更新提供商配置",
    description="更新模型提供商配置并热更新 ModelGateway"
)
async def update_providers(
    request: Request,
    config: ProvidersConfigRequest
):
    """更新提供商配置并热更新"""
    # 安全限制：只允许本地请求
    if not is_localhost_request(request):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only localhost requests are allowed"
        )
    
    try:
        gateway = get_model_gateway()
        
        # 构建 provider_configs
        provider_configs = {}
        for provider_name, provider_cfg in config.providers.items():
            try:
                provider = ModelProvider(provider_name)
                provider_configs[provider] = {
                    "api_key": provider_cfg.api_key,
                    "enabled": provider_cfg.enabled
                }
            except ValueError:
                logger.warning(f"Unknown provider: {provider_name}")
                continue
        
        # 热更新 ModelGateway
        await gateway.reload_clients(provider_configs)
        
        # 更新环境变量（供后续重启使用）
        for provider_name, provider_cfg in config.providers.items():
            registry_info = PROVIDER_REGISTRY.get(ModelProvider(provider_name))
            if registry_info:
                env_key = f"{registry_info['config_key_prefix']}_API_KEY"
                os.environ[env_key] = provider_cfg.api_key
        
        # 更新路由配置
        os.environ["DEFAULT_MODEL_PROVIDER"] = config.default_provider
        os.environ["FALLBACK_MODEL_PROVIDER"] = config.fallback_provider
        os.environ["MONTHLY_BUDGET_RMB"] = str(config.monthly_budget)
        
        # 获取活跃的提供商
        active_providers = [p.value for p in gateway._clients.keys()]
        
        logger.info(
            "config.providers_updated",
            active_providers=active_providers,
            default_provider=config.default_provider,
            fallback_provider=config.fallback_provider
        )
        
        return UpdateProvidersResponse(
            status="ok",
            active_providers=active_providers
        )
        
    except Exception as e:
        logger.error("config.update_providers_failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update providers: {str(e)}"
        )


@router.get(
    "/providers",
    response_model=ProvidersStatusResponse,
    summary="获取提供商状态",
    description="查询当前各提供商的连接状态和配置"
)
async def get_providers_status(request: Request):
    """获取提供商状态"""
    # 安全限制：只允许本地请求
    if not is_localhost_request(request):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only localhost requests are allowed"
        )
    
    try:
        gateway = get_model_gateway()
        
        # 构建提供商状态
        providers_status = {}
        for provider in ModelProvider:
            registry_info = PROVIDER_REGISTRY.get(provider)
            if registry_info:
                # 获取该提供商的默认模型（BALANCED profile）
                default_model = registry_info["profiles"].get(
                    ModelProfile.BALANCED, 
                    "unknown"
                )
                
                # 检查是否已连接
                is_connected = provider in gateway._clients
                
                # 检查是否启用（从环境变量判断是否有 API Key）
                env_key = f"{registry_info['config_key_prefix']}_API_KEY"
                is_enabled = bool(os.environ.get(env_key))
                
                providers_status[provider.value] = ProviderStatus(
                    enabled=is_enabled,
                    connected=is_connected,
                    model=default_model
                )
        
        return ProvidersStatusResponse(
            providers=providers_status,
            default_provider=settings.DEFAULT_MODEL_PROVIDER,
            fallback_provider=settings.FALLBACK_MODEL_PROVIDER,
            monthly_budget=settings.MONTHLY_BUDGET_RMB,
            cost_used=gateway.get_cost_stats().get("monthly_total", 0.0)
        )
        
    except Exception as e:
        logger.error("config.get_providers_status_failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get providers status: {str(e)}"
        )


@router.post(
    "/providers/test",
    response_model=TestProviderResponse,
    summary="测试提供商连接",
    description="测试指定提供商的 API Key 是否有效"
)
async def test_provider(
    request: Request,
    test_req: TestProviderRequest
):
    """测试提供商连接"""
    # 安全限制：只允许本地请求
    if not is_localhost_request(request):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only localhost requests are allowed"
        )
    
    try:
        provider = ModelProvider(test_req.provider)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown provider: {test_req.provider}"
        )
    
    try:
        gateway = get_model_gateway()
        result = await gateway.test_connection(provider, test_req.api_key)
        
        return TestProviderResponse(
            provider=test_req.provider,
            success=result["success"],
            latency_ms=result["latency_ms"],
            error=result.get("error")
        )
        
    except Exception as e:
        logger.error("config.test_provider_failed", provider=test_req.provider, error=str(e))
        return TestProviderResponse(
            provider=test_req.provider,
            success=False,
            latency_ms=0.0,
            error=str(e)
        )


@router.get(
    "/providers/registry",
    summary="获取提供商注册表",
    description="获取所有支持的提供商配置信息（不含敏感信息）"
)
async def get_provider_registry(request: Request):
    """获取提供商注册表"""
    # 安全限制：只允许本地请求
    if not is_localhost_request(request):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only localhost requests are allowed"
        )
    
    registry_info = {}
    for provider, config in PROVIDER_REGISTRY.items():
        registry_info[provider.value] = {
            "name": config["name"],
            "default_base_url": config["default_base_url"],
            "profiles": {k.value: v for k, v in config["profiles"].items()},
            "pricing": config["pricing"]
        }
    
    return registry_info
