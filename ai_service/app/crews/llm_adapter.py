"""
FlowBoard LLM Adapter for CrewAI

This module provides an LLM adapter that wraps FlowBoard's ModelGateway
to be compatible with crewAI's LLM interface.

The adapter supports:
- Multiple model providers (Qwen, Kimi, GLM, SilFlow)
- Model profile selection (HIGH_QUALITY, BALANCED, COST_EFFECTIVE)
- Budget control and cost tracking
- Async-to-sync bridge for crewAI compatibility
"""

import asyncio
from typing import Any, Dict, List, Optional, Union
from functools import lru_cache

from crewai import LLM
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
)

from app.services.model_gateway import (
    ModelGateway,
    ModelProfile,
    ModelProvider,
    get_model_gateway,
)
from app.core.logging import get_logger

logger = get_logger(__name__)


class FlowBoardLLM(LLM):
    """
    CrewAI LLM adapter for FlowBoard's ModelGateway.
    
    This adapter bridges the gap between crewAI's LLM interface and
    FlowBoard's unified ModelGateway, allowing crewAI agents to use
    the same LLM infrastructure as the rest of the application.
    
    Features:
    - Automatic message format conversion
    - Model profile support (quality vs cost tradeoffs)
    - Provider fallback handling
    - Integration with FlowBoard's cost tracking
    
    Example:
        ```python
        from app.crews.llm_adapter import FlowBoardLLM
        from crewai import Agent
        
        llm = FlowBoardLLM(profile=ModelProfile.HIGH_QUALITY)
        agent = Agent(
            role="Planner",
            goal="Create learning plans",
            llm=llm,
        )
        ```
    """
    
    model: str = "flowboard-gateway"
    
    def __init__(
        self,
        profile: ModelProfile = ModelProfile.BALANCED,
        provider: Optional[ModelProvider] = None,
        temperature: float = 0.7,
        **kwargs,
    ):
        """
        Initialize the FlowBoard LLM adapter.
        
        Args:
            profile: Model quality profile (HIGH_QUALITY, BALANCED, COST_EFFECTIVE)
            provider: Specific model provider to use (None for auto-selection)
            temperature: Sampling temperature for generation
            **kwargs: Additional arguments passed to parent LLM class
        """
        super().__init__(**kwargs)
        self._profile = profile
        self._provider = provider
        self._temperature = temperature
        self._gateway: Optional[ModelGateway] = None
        
        logger.info(
            "flowboard_llm.initialized",
            profile=profile.value,
            provider=provider.value if provider else "auto",
            temperature=temperature,
        )
    
    @property
    def gateway(self) -> ModelGateway:
        """Lazy initialization of ModelGateway."""
        if self._gateway is None:
            self._gateway = get_model_gateway()
        return self._gateway
    
    def call(
        self,
        messages: Union[str, List[Dict[str, str]]],
        **kwargs,
    ) -> str:
        """
        Call the LLM with the given messages.
        
        This is the main entry point used by crewAI to interact with the LLM.
        It converts messages to LangChain format and uses ModelGateway for generation.
        
        Args:
            messages: Either a string prompt or list of message dicts with 'role' and 'content'
            **kwargs: Additional generation parameters
            
        Returns:
            Generated text response
        """
        # Convert to LangChain message format
        lc_messages = self._convert_messages(messages)
        
        # Get temperature from kwargs or use default
        temperature = kwargs.get("temperature", self._temperature)
        
        # Run async generation in sync context
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If there's already an event loop running, create a new one
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(
                        asyncio.run,
                        self._async_generate(lc_messages, temperature)
                    )
                    return future.result()
            else:
                return loop.run_until_complete(
                    self._async_generate(lc_messages, temperature)
                )
        except RuntimeError:
            # No event loop exists, create one
            return asyncio.run(self._async_generate(lc_messages, temperature))
    
    async def _async_generate(
        self,
        messages: List[BaseMessage],
        temperature: float,
    ) -> str:
        """
        Async generation using ModelGateway.
        
        Args:
            messages: LangChain format messages
            temperature: Sampling temperature
            
        Returns:
            Generated text
        """
        try:
            response = await self.gateway.generate(
                messages=messages,
                model_profile=self._profile,
                provider=self._provider,
                temperature=temperature,
            )
            
            logger.debug(
                "flowboard_llm.generated",
                model=response.model,
                provider=response.provider.value,
                latency_ms=response.latency_ms,
                tokens=response.token_usage.get("total_tokens", 0),
            )
            
            return response.content
            
        except Exception as e:
            logger.error("flowboard_llm.generation_failed", error=str(e))
            raise
    
    def _convert_messages(
        self,
        messages: Union[str, List[Dict[str, str]]],
    ) -> List[BaseMessage]:
        """
        Convert various message formats to LangChain BaseMessage list.
        
        Supports:
        - Simple string (converted to HumanMessage)
        - List of dicts with 'role' and 'content' keys
        - List of LangChain BaseMessage objects (pass-through)
        
        Args:
            messages: Input messages in various formats
            
        Returns:
            List of LangChain BaseMessage objects
        """
        if isinstance(messages, str):
            return [HumanMessage(content=messages)]
        
        if isinstance(messages, list):
            if len(messages) == 0:
                return []
            
            # Check if already LangChain messages
            if isinstance(messages[0], BaseMessage):
                return messages
            
            # Convert from dict format
            lc_messages = []
            for msg in messages:
                role = msg.get("role", "user").lower()
                content = msg.get("content", "")
                
                if role == "system":
                    lc_messages.append(SystemMessage(content=content))
                elif role == "assistant" or role == "ai":
                    lc_messages.append(AIMessage(content=content))
                else:  # user, human, or default
                    lc_messages.append(HumanMessage(content=content))
            
            return lc_messages
        
        # Fallback: try to convert to string
        return [HumanMessage(content=str(messages))]


class FlowBoardLLMHighQuality(FlowBoardLLM):
    """Pre-configured LLM for high-quality tasks like planning."""
    
    def __init__(self, **kwargs):
        super().__init__(
            profile=ModelProfile.HIGH_QUALITY,
            temperature=0.7,
            **kwargs,
        )


class FlowBoardLLMBalanced(FlowBoardLLM):
    """Pre-configured LLM for balanced quality/cost tasks."""
    
    def __init__(self, **kwargs):
        super().__init__(
            profile=ModelProfile.BALANCED,
            temperature=0.5,
            **kwargs,
        )


class FlowBoardLLMCostEffective(FlowBoardLLM):
    """Pre-configured LLM for cost-effective tasks like extraction."""
    
    def __init__(self, **kwargs):
        super().__init__(
            profile=ModelProfile.COST_EFFECTIVE,
            temperature=0.3,
            **kwargs,
        )


@lru_cache(maxsize=3)
def get_flowboard_llm(profile: str = "balanced") -> FlowBoardLLM:
    """
    Get a cached FlowBoardLLM instance.
    
    Args:
        profile: One of "high_quality", "balanced", "cost_effective"
        
    Returns:
        Cached FlowBoardLLM instance
    """
    profile_map = {
        "high_quality": ModelProfile.HIGH_QUALITY,
        "balanced": ModelProfile.BALANCED,
        "cost_effective": ModelProfile.COST_EFFECTIVE,
    }
    
    model_profile = profile_map.get(profile.lower(), ModelProfile.BALANCED)
    return FlowBoardLLM(profile=model_profile)
