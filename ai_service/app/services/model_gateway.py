"""
模型网关服务
统一封装Qwen和Kimi模型的调用，支持路由、降级、成本统计
"""

import time
from enum import Enum
from typing import AsyncIterator, Dict, List, Optional, Any, Callable
from dataclasses import dataclass

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage
from langchain_core.language_models import BaseChatModel
from langchain_openai import ChatOpenAI

from app.core.config import settings
from app.core.logging import get_logger
from app.core.exceptions import BudgetExceededException, ModelException
from app.core.request_context import get_request_context

logger = get_logger(__name__)


class ModelProvider(str, Enum):
    """模型提供商"""
    QWEN = "qwen"
    KIMI = "kimi"


class ModelProfile(str, Enum):
    """模型配置档"""
    HIGH_QUALITY = "high_quality"  # 高质量（规划/拆解）
    BALANCED = "balanced"          # 平衡型（检索问答）
    COST_EFFECTIVE = "cost_effective"  # 低成本（结构化提取）
    EMBEDDING = "embedding"        # Embedding模型


@dataclass
class ModelResponse:
    """模型响应封装"""
    content: str
    model: str
    provider: ModelProvider
    latency_ms: float
    token_usage: Dict[str, int]
    finish_reason: Optional[str] = None


@dataclass
class StreamingDelta:
    """流式响应片段"""
    content: str
    is_finish: bool = False


class ModelGateway:
    """
    模型网关
    
    职责：
    1. 统一封装Qwen和Kimi模型调用
    2. 支持模型路由和降级策略
    3. 成本统计和预算控制
    4. 超时、重试、熔断
    """
    
    def __init__(self):
        self._clients: Dict[ModelProvider, BaseChatModel] = {}
        self._embedding_clients: Dict[ModelProvider, Any] = {}
        self._cost_stats: Dict[str, float] = {"monthly_total": 0.0}
        self._init_clients()
    
    def _init_clients(self):
        """初始化模型客户端"""
        # Qwen客户端
        if settings.QWEN_API_KEY:
            try:
                self._clients[ModelProvider.QWEN] = ChatOpenAI(
                    model=settings.QWEN_DEFAULT_MODEL,
                    api_key=settings.QWEN_API_KEY,
                    base_url=settings.QWEN_BASE_URL,
                    temperature=0.7,
                    timeout=settings.REQUEST_TIMEOUT,
                    max_retries=settings.MAX_RETRIES,
                )
                logger.info("model_gateway.qwen_initialized")
            except Exception as e:
                logger.error("model_gateway.qwen_init_failed", error=str(e))
        
        # Kimi客户端
        if settings.KIMI_API_KEY:
            try:
                self._clients[ModelProvider.KIMI] = ChatOpenAI(
                    model=settings.KIMI_DEFAULT_MODEL,
                    api_key=settings.KIMI_API_KEY,
                    base_url=settings.KIMI_BASE_URL,
                    temperature=0.7,
                    timeout=settings.REQUEST_TIMEOUT,
                    max_retries=settings.MAX_RETRIES,
                )
                logger.info("model_gateway.kimi_initialized")
            except Exception as e:
                logger.error("model_gateway.kimi_init_failed", error=str(e))
    
    def _get_model_for_profile(self, profile: ModelProfile, provider: ModelProvider) -> str:
        """根据配置档获取模型名称"""
        model_map = {
            (ModelProvider.QWEN, ModelProfile.HIGH_QUALITY): "qwen-max",
            (ModelProvider.QWEN, ModelProfile.BALANCED): "qwen-plus",
            (ModelProvider.QWEN, ModelProfile.COST_EFFECTIVE): "qwen-turbo",
            (ModelProvider.QWEN, ModelProfile.EMBEDDING): settings.QWEN_EMBEDDING_MODEL,
            (ModelProvider.KIMI, ModelProfile.HIGH_QUALITY): "moonshot-v1-32k",
            (ModelProvider.KIMI, ModelProfile.BALANCED): "moonshot-v1-8k",
            (ModelProvider.KIMI, ModelProfile.COST_EFFECTIVE): "moonshot-v1-8k",
        }
        return model_map.get((provider, profile), settings.QWEN_DEFAULT_MODEL)
    
    def _select_provider(self, preferred: Optional[ModelProvider] = None) -> ModelProvider:
        """选择模型提供商"""
        if preferred and preferred in self._clients:
            return preferred
        
        default = ModelProvider(settings.DEFAULT_MODEL_PROVIDER)
        if default in self._clients:
            return default
        
        # 降级策略
        fallback = ModelProvider(settings.FALLBACK_MODEL_PROVIDER)
        if fallback in self._clients:
            logger.warning("model_gateway.using_fallback", fallback=fallback.value)
            return fallback
        
        raise ModelException("没有可用的模型提供商")

    def _apply_budget_policy(self, model_profile: ModelProfile) -> ModelProfile:
        """Downgrade profile near budget and block when hard limit exceeded."""
        monthly_total = self._cost_stats["monthly_total"]
        budget = settings.MONTHLY_BUDGET_RMB
        if monthly_total >= budget:
            raise BudgetExceededException("monthly budget exceeded")

        warn_threshold = budget * settings.COST_WARNING_THRESHOLD
        if (
            monthly_total >= warn_threshold
            and model_profile in {ModelProfile.HIGH_QUALITY, ModelProfile.BALANCED}
        ):
            logger.warning(
                "model_gateway.profile_downgraded",
                from_profile=model_profile.value,
                to_profile=ModelProfile.COST_EFFECTIVE.value,
                monthly_cost=monthly_total,
                budget=budget,
            )
            return ModelProfile.COST_EFFECTIVE
        return model_profile

    def _build_run_metadata(
        self,
        model_profile: ModelProfile,
        route: Optional[str] = None,
        session_id: Optional[str] = None,
        is_replay: bool = False,
        retry_attempt: int = 0,
        idempotency_key: Optional[str] = None,
        user_id: Optional[str] = None,
        extra: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Build standard run metadata for observability."""
        ctx = get_request_context()
        metadata = {
            "trace_id": getattr(ctx, "trace_id", None),
            "request_id": getattr(ctx, "request_id", None),
            "session_id": session_id or getattr(ctx, "session_id", None),
            "retry_attempt": retry_attempt if retry_attempt else getattr(ctx, "retry_attempt", 0),
            "is_replay": is_replay if is_replay else getattr(ctx, "is_replay", False),
            "idempotency_key": idempotency_key or getattr(ctx, "idempotency_key", None),
            "user_id": user_id or getattr(ctx, "user_id", None),
            "route": route or getattr(ctx, "route", None),
            "model_profile": model_profile.value,
            "component": "model_gateway",
        }
        if extra:
            metadata.update(extra)
        return metadata
    
    async def generate(
        self,
        messages: List[BaseMessage],
        model_profile: ModelProfile = ModelProfile.BALANCED,
        provider: Optional[ModelProvider] = None,
        temperature: Optional[float] = None,
        tools: Optional[List[Dict]] = None,
        timeout_ms: Optional[int] = None,
        route: Optional[str] = None,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ModelResponse:
        """
        生成文本响应
        
        Args:
            messages: 消息列表
            model_profile: 模型配置档
            provider: 指定提供商（None则按路由策略）
            temperature: 温度参数
            tools: 工具定义
            timeout_ms: 超时时间
        
        Returns:
            ModelResponse: 模型响应
        """
        start_time = time.time()
        effective_profile = self._apply_budget_policy(model_profile)
        selected_provider = self._select_provider(provider)
        client = self._clients[selected_provider]
        
        # 根据profile选择模型
        model_name = self._get_model_for_profile(effective_profile, selected_provider)
        
        try:
            # 构建调用参数
            kwargs = {
                "model": model_name,
            }
            if temperature is not None:
                kwargs["temperature"] = temperature
            if tools:
                kwargs["tools"] = tools
            
            run_metadata = self._build_run_metadata(
                model_profile=effective_profile,
                route=route,
                session_id=session_id,
                extra=metadata,
            )
            try:
                response = await client.ainvoke(
                    messages,
                    config={"metadata": run_metadata},
                    **kwargs,
                )
            except TypeError:
                # Backward compatibility for clients not supporting config kwarg.
                response = await client.ainvoke(messages, **kwargs)
            
            latency_ms = (time.time() - start_time) * 1000
            
            # 统计token使用情况
            token_usage = {
                "prompt_tokens": response.usage_metadata.get("input_tokens", 0) if response.usage_metadata else 0,
                "completion_tokens": response.usage_metadata.get("output_tokens", 0) if response.usage_metadata else 0,
                "total_tokens": response.usage_metadata.get("total_tokens", 0) if response.usage_metadata else 0,
            }
            
            # 估算成本（简化计算，实际需要根据模型定价调整）
            cost = self._estimate_cost(model_name, token_usage)
            self._update_cost(cost)
            
            logger.info(
                "model_gateway.generate_success",
                provider=selected_provider.value,
                model=model_name,
                model_profile=effective_profile.value,
                latency_ms=latency_ms,
                token_usage=token_usage,
                cost=cost,
            )
            
            return ModelResponse(
                content=response.content,
                model=model_name,
                provider=selected_provider,
                latency_ms=latency_ms,
                token_usage=token_usage,
                finish_reason="stop",
            )
            
        except Exception as e:
            logger.error(
                "model_gateway.generate_failed",
                provider=selected_provider.value,
                model=model_name,
                error=str(e),
            )
            raise ModelException(f"模型生成失败: {str(e)}")
    
    async def generate_stream(
        self,
        messages: List[BaseMessage],
        model_profile: ModelProfile = ModelProfile.BALANCED,
        provider: Optional[ModelProvider] = None,
        temperature: Optional[float] = None,
        route: Optional[str] = None,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> AsyncIterator[StreamingDelta]:
        """
        流式生成文本响应
        
        Args:
            messages: 消息列表
            model_profile: 模型配置档
            provider: 指定提供商
            temperature: 温度参数
        
        Yields:
            StreamingDelta: 流式响应片段
        """
        start_time = time.time()
        effective_profile = self._apply_budget_policy(model_profile)
        selected_provider = self._select_provider(provider)
        client = self._clients[selected_provider]
        model_name = self._get_model_for_profile(effective_profile, selected_provider)
        
        try:
            run_metadata = self._build_run_metadata(
                model_profile=effective_profile,
                route=route,
                session_id=session_id,
                extra=metadata,
            )
            try:
                stream_iter = client.astream(
                    messages,
                    model=model_name,
                    temperature=temperature,
                    config={"metadata": run_metadata},
                )
            except TypeError:
                stream_iter = client.astream(
                    messages,
                    model=model_name,
                    temperature=temperature,
                )

            async for chunk in stream_iter:
                content = chunk.content if hasattr(chunk, 'content') else str(chunk)
                yield StreamingDelta(content=content, is_finish=False)
            
            latency_ms = (time.time() - start_time) * 1000
            logger.info(
                "model_gateway.stream_success",
                provider=selected_provider.value,
                model=model_name,
                latency_ms=latency_ms,
            )
            
            yield StreamingDelta(content="", is_finish=True)
            
        except Exception as e:
            logger.error(
                "model_gateway.stream_failed",
                provider=selected_provider.value,
                model=model_name,
                error=str(e),
            )
            raise ModelException(f"流式生成失败: {str(e)}")
    
    async def embed(
        self,
        texts: List[str],
        provider: Optional[ModelProvider] = None,
    ) -> List[List[float]]:
        """
        获取文本Embedding
        
        Args:
            texts: 文本列表
            provider: 指定提供商
        
        Returns:
            List[List[float]]: Embedding向量列表
        """
        selected_provider = self._select_provider(provider)
        
        try:
            # 使用OpenAI兼容接口调用Embedding模型
            import openai
            
            if selected_provider == ModelProvider.QWEN:
                client = openai.AsyncOpenAI(
                    api_key=settings.QWEN_API_KEY,
                    base_url=settings.QWEN_BASE_URL,
                )
                model = settings.QWEN_EMBEDDING_MODEL
            else:
                # Kimi暂不支持独立的embedding API，使用Qwen作为回退
                client = openai.AsyncOpenAI(
                    api_key=settings.QWEN_API_KEY,
                    base_url=settings.QWEN_BASE_URL,
                )
                model = settings.QWEN_EMBEDDING_MODEL
            
            response = await client.embeddings.create(
                model=model,
                input=texts,
            )
            
            embeddings = [item.embedding for item in response.data]
            
            logger.info(
                "model_gateway.embed_success",
                provider=selected_provider.value,
                model=model,
                count=len(texts),
            )
            
            return embeddings
            
        except Exception as e:
            logger.error("model_gateway.embed_failed", error=str(e))
            raise ModelException(f"Embedding生成失败: {str(e)}")
    
    async def rerank(
        self,
        query: str,
        passages: List[str],
        top_k: int = 5,
    ) -> List[tuple]:
        """
        重排序（使用Cross-Encoder或供应商rerank API）
        
        当前使用简化的实现，实际生产环境可以接入Cohere Rerank等
        
        Args:
            query: 查询文本
            passages: 候选段落
            top_k: 返回top_k结果
        
        Returns:
            List[tuple]: (索引, 分数)列表
        """
        # TODO: 实现真正的rerank，当前返回按索引排序
        logger.info("model_gateway.rerank", query_len=len(query), passages_count=len(passages))
        return [(i, 1.0 - i * 0.1) for i in range(min(top_k, len(passages)))]
    
    def _estimate_cost(self, model: str, token_usage: Dict[str, int]) -> float:
        """
        估算调用成本（RMB）
        
        注意：这里使用简化定价，实际应根据最新定价调整
        """
        # 每千token价格（元）
        pricing = {
            "qwen-max": {"input": 0.04, "output": 0.12},
            "qwen-plus": {"input": 0.004, "output": 0.012},
            "qwen-turbo": {"input": 0.002, "output": 0.006},
            "text-embedding-v3": {"input": 0.0005, "output": 0},
            "moonshot-v1-8k": {"input": 0.012, "output": 0.012},
            "moonshot-v1-32k": {"input": 0.024, "output": 0.024},
        }
        
        model_pricing = pricing.get(model, {"input": 0.01, "output": 0.03})
        
        input_cost = token_usage.get("prompt_tokens", 0) / 1000 * model_pricing["input"]
        output_cost = token_usage.get("completion_tokens", 0) / 1000 * model_pricing["output"]
        
        return input_cost + output_cost
    
    def _update_cost(self, cost: float):
        """更新成本统计"""
        self._cost_stats["monthly_total"] += cost
        
        # 检查预算
        if self._cost_stats["monthly_total"] > settings.MONTHLY_BUDGET_RMB * settings.COST_WARNING_THRESHOLD:
            logger.warning(
                "model_gateway.budget_warning",
                monthly_cost=self._cost_stats["monthly_total"],
                budget=settings.MONTHLY_BUDGET_RMB,
            )
        if self._cost_stats["monthly_total"] >= settings.MONTHLY_BUDGET_RMB:
            logger.warning(
                "model_gateway.budget_exhausted",
                monthly_cost=self._cost_stats["monthly_total"],
                budget=settings.MONTHLY_BUDGET_RMB,
            )
    
    def get_cost_stats(self) -> Dict[str, float]:
        """获取成本统计"""
        return self._cost_stats.copy()
    
    def check_budget(self) -> bool:
        """检查是否超出预算"""
        return self._cost_stats["monthly_total"] < settings.MONTHLY_BUDGET_RMB


# 全局单例
_model_gateway: Optional[ModelGateway] = None


def get_model_gateway() -> ModelGateway:
    """获取模型网关单例"""
    global _model_gateway
    if _model_gateway is None:
        _model_gateway = ModelGateway()
    return _model_gateway
