"""
LLM Adapter for FlowBoard.

Adapts FlowBoard's model_gateway to the interface expected by Sirchmunk components.
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from loguru import logger


@dataclass
class LLMResponse:
    """Standard LLM response format."""
    content: str
    model: str
    usage: Dict[str, int]
    latency_ms: float = 0.0


class FlowBoardLLMAdapter:
    """
    Adapts FlowBoard's model_gateway to Sirchmunk's LLM interface.
    
    This adapter allows Sirchmunk components to use FlowBoard's existing
    LLM infrastructure without modification.
    """

    def __init__(self, model_gateway=None, model_name: str = None):
        """
        Initialize the LLM adapter.

        Args:
            model_gateway: Optional pre-configured model gateway instance.
            model_name: Optional model name override.
        """
        self._gateway = model_gateway
        self._model_name = model_name
        self._initialized = False

    def _ensure_gateway(self):
        """Lazily initialize the model gateway."""
        if self._gateway is None:
            try:
                from app.services.model_gateway import get_model_gateway
                self._gateway = get_model_gateway()
                self._initialized = True
            except ImportError:
                logger.warning("model_gateway not available, using fallback")
                self._gateway = None

    async def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs,
    ) -> LLMResponse:
        """
        Send chat completion request.

        Args:
            messages: List of message dicts with 'role' and 'content' keys.
            temperature: Sampling temperature.
            max_tokens: Maximum tokens in response.
            **kwargs: Additional arguments passed to the gateway.

        Returns:
            LLMResponse with content, model, and usage info.
        """
        self._ensure_gateway()

        if self._gateway is None:
            # Fallback: return empty response
            logger.warning("No LLM gateway available")
            return LLMResponse(
                content="[LLM not configured]",
                model="none",
                usage={"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            )

        try:
            # Convert messages to LangChain format
            from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

            lc_messages = []
            for msg in messages:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                
                if role == "system":
                    lc_messages.append(SystemMessage(content=content))
                elif role == "assistant":
                    lc_messages.append(AIMessage(content=content))
                else:
                    lc_messages.append(HumanMessage(content=content))

            # Call gateway
            from app.services.model_gateway import ModelProfile
            
            response = await self._gateway.generate(
                messages=lc_messages,
                model_profile=ModelProfile.BALANCED,
                temperature=temperature,
                max_tokens=max_tokens,
            )

            return LLMResponse(
                content=response.content,
                model=response.model,
                usage={
                    "prompt_tokens": response.prompt_tokens or 0,
                    "completion_tokens": response.completion_tokens or 0,
                    "total_tokens": (response.prompt_tokens or 0) + (response.completion_tokens or 0),
                },
                latency_ms=response.latency_ms or 0.0,
            )

        except Exception as e:
            logger.error(f"LLM chat failed: {e}")
            return LLMResponse(
                content=f"[Error: {str(e)}]",
                model="error",
                usage={"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            )

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        **kwargs,
    ) -> LLMResponse:
        """
        Generate completion for a single prompt.

        Args:
            prompt: The user prompt.
            system_prompt: Optional system prompt.
            **kwargs: Additional arguments passed to chat().

        Returns:
            LLMResponse with generated content.
        """
        messages = []
        
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        
        messages.append({"role": "user", "content": prompt})
        
        return await self.chat(messages, **kwargs)

    async def embed(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for texts.

        Args:
            texts: List of texts to embed.

        Returns:
            List of embedding vectors.
        """
        self._ensure_gateway()

        if self._gateway is None:
            # Return zero vectors as fallback
            return [[0.0] * 384 for _ in texts]

        try:
            embeddings = await self._gateway.embed(texts)
            return embeddings
        except Exception as e:
            logger.error(f"Embedding failed: {e}")
            return [[0.0] * 384 for _ in texts]
