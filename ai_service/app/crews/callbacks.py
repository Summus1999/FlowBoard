"""
SSE Callback Handler for CrewAI

This module provides callback handlers that convert crewAI events
to Server-Sent Events (SSE) format compatible with FlowBoard's
streaming API.
"""

import asyncio
import json
from typing import Any, Dict, Optional, Callable
from dataclasses import dataclass
from enum import Enum

from app.core.logging import get_logger

logger = get_logger(__name__)


class SSEEventType(str, Enum):
    """SSE event types matching FlowBoard's protocol."""
    META = "meta"
    TOKEN = "token"
    AGENT_ACTION = "agent_action"
    TASK_START = "task_start"
    TASK_COMPLETE = "task_complete"
    CITATION = "citation"
    RISK = "risk"
    DONE = "done"
    ERROR = "error"


@dataclass
class SSEEvent:
    """SSE event data structure."""
    event_type: SSEEventType
    data: Dict[str, Any]
    
    def to_sse_string(self) -> str:
        """Convert to SSE wire format."""
        data_json = json.dumps(self.data, ensure_ascii=False)
        return f"event: {self.event_type.value}\ndata: {data_json}\n\n"


class SSECallbackHandler:
    """
    Callback handler that converts crewAI events to SSE format.
    
    This handler captures events from crewAI execution and converts
    them to FlowBoard's SSE protocol for real-time streaming.
    
    Usage:
        ```python
        queue = asyncio.Queue()
        handler = SSECallbackHandler(queue)
        
        # Use with crew
        crew.kickoff(callbacks=[handler])
        
        # Consume events
        async for event in handler.stream():
            yield event.to_sse_string()
        ```
    """
    
    def __init__(
        self,
        queue: Optional[asyncio.Queue] = None,
        trace_id: Optional[str] = None,
        request_id: Optional[str] = None,
    ):
        """
        Initialize the callback handler.
        
        Args:
            queue: Async queue for event streaming
            trace_id: Request trace ID for logging
            request_id: Request ID for logging
        """
        self._queue = queue or asyncio.Queue()
        self._trace_id = trace_id
        self._request_id = request_id
        self._is_finished = False
        self._current_agent = None
        self._current_task = None
        self._token_buffer = ""
        
    @property
    def queue(self) -> asyncio.Queue:
        """Get the event queue."""
        return self._queue
    
    async def _emit(self, event: SSEEvent):
        """Emit an event to the queue."""
        await self._queue.put(event)
    
    def _emit_sync(self, event: SSEEvent):
        """Synchronous emit for use in sync callbacks."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(self._emit(event))
            else:
                loop.run_until_complete(self._emit(event))
        except RuntimeError:
            # No event loop, create one
            asyncio.run(self._emit(event))
    
    # CrewAI callback methods
    
    def on_crew_start(self, crew: Any, **kwargs):
        """Called when crew execution starts."""
        logger.info(
            "sse_callback.crew_start",
            trace_id=self._trace_id,
        )
        
        self._emit_sync(SSEEvent(
            event_type=SSEEventType.META,
            data={
                "trace_id": self._trace_id,
                "request_id": self._request_id,
                "status": "crew_started",
                "agent_count": len(crew.agents) if hasattr(crew, 'agents') else 0,
            }
        ))
    
    def on_crew_end(self, crew: Any, output: Any, **kwargs):
        """Called when crew execution completes."""
        logger.info(
            "sse_callback.crew_end",
            trace_id=self._trace_id,
        )
        
        # Flush any remaining tokens
        if self._token_buffer:
            self._emit_sync(SSEEvent(
                event_type=SSEEventType.TOKEN,
                data={"text": self._token_buffer}
            ))
            self._token_buffer = ""
        
        self._emit_sync(SSEEvent(
            event_type=SSEEventType.DONE,
            data={
                "trace_id": self._trace_id,
                "request_id": self._request_id,
                "status": "completed",
            }
        ))
        
        self._is_finished = True
    
    def on_agent_start(self, agent: Any, task: Any, **kwargs):
        """Called when an agent starts working on a task."""
        agent_role = getattr(agent, 'role', 'unknown')
        task_desc = str(task.description)[:100] if hasattr(task, 'description') else 'unknown'
        
        self._current_agent = agent_role
        self._current_task = task_desc
        
        logger.info(
            "sse_callback.agent_start",
            agent=agent_role,
            trace_id=self._trace_id,
        )
        
        self._emit_sync(SSEEvent(
            event_type=SSEEventType.AGENT_ACTION,
            data={
                "agent": agent_role,
                "action": "started",
                "task_preview": task_desc,
            }
        ))
    
    def on_agent_end(self, agent: Any, output: Any, **kwargs):
        """Called when an agent completes a task."""
        agent_role = getattr(agent, 'role', 'unknown')
        
        logger.info(
            "sse_callback.agent_end",
            agent=agent_role,
            trace_id=self._trace_id,
        )
        
        self._emit_sync(SSEEvent(
            event_type=SSEEventType.AGENT_ACTION,
            data={
                "agent": agent_role,
                "action": "completed",
            }
        ))
        
        self._current_agent = None
    
    def on_task_start(self, task: Any, **kwargs):
        """Called when a task starts execution."""
        task_desc = str(task.description)[:100] if hasattr(task, 'description') else 'unknown'
        
        logger.info(
            "sse_callback.task_start",
            task=task_desc,
            trace_id=self._trace_id,
        )
        
        self._emit_sync(SSEEvent(
            event_type=SSEEventType.TASK_START,
            data={
                "task": task_desc,
                "agent": self._current_agent,
            }
        ))
    
    def on_task_end(self, task: Any, output: Any, **kwargs):
        """Called when a task completes."""
        task_desc = str(task.description)[:100] if hasattr(task, 'description') else 'unknown'
        
        logger.info(
            "sse_callback.task_end",
            task=task_desc,
            trace_id=self._trace_id,
        )
        
        self._emit_sync(SSEEvent(
            event_type=SSEEventType.TASK_COMPLETE,
            data={
                "task": task_desc,
                "output_preview": str(output)[:200] if output else None,
            }
        ))
    
    def on_llm_start(self, serialized: Dict, prompts: list, **kwargs):
        """Called when LLM generation starts."""
        pass  # Usually too noisy to emit
    
    def on_llm_end(self, response: Any, **kwargs):
        """Called when LLM generation completes."""
        # Extract content and emit as tokens
        content = ""
        if hasattr(response, 'generations'):
            for gen in response.generations:
                if gen and len(gen) > 0:
                    content += gen[0].text if hasattr(gen[0], 'text') else str(gen[0])
        elif hasattr(response, 'content'):
            content = response.content
        
        if content:
            self._emit_sync(SSEEvent(
                event_type=SSEEventType.TOKEN,
                data={"text": content}
            ))
    
    def on_llm_new_token(self, token: str, **kwargs):
        """Called for each new token during streaming."""
        # Buffer tokens to reduce event frequency
        self._token_buffer += token
        
        # Emit when buffer reaches threshold or contains newline
        if len(self._token_buffer) >= 50 or '\n' in self._token_buffer:
            self._emit_sync(SSEEvent(
                event_type=SSEEventType.TOKEN,
                data={"text": self._token_buffer}
            ))
            self._token_buffer = ""
    
    def on_tool_start(self, tool: Any, input_str: str, **kwargs):
        """Called when a tool starts execution."""
        tool_name = getattr(tool, 'name', str(tool))
        
        logger.debug(
            "sse_callback.tool_start",
            tool=tool_name,
            trace_id=self._trace_id,
        )
    
    def on_tool_end(self, output: str, **kwargs):
        """Called when a tool completes."""
        pass  # Tool outputs usually incorporated into agent response
    
    def on_tool_error(self, error: Exception, **kwargs):
        """Called when a tool encounters an error."""
        logger.warning(
            "sse_callback.tool_error",
            error=str(error),
            trace_id=self._trace_id,
        )
    
    def on_chain_error(self, error: Exception, **kwargs):
        """Called when the chain encounters an error."""
        logger.error(
            "sse_callback.chain_error",
            error=str(error),
            trace_id=self._trace_id,
        )
        
        self._emit_sync(SSEEvent(
            event_type=SSEEventType.ERROR,
            data={
                "code": "CREW-5001",
                "message": str(error),
                "trace_id": self._trace_id,
                "request_id": self._request_id,
            }
        ))
        
        self._is_finished = True
    
    # Async streaming interface
    
    async def stream(self):
        """
        Async generator for streaming SSE events.
        
        Yields:
            SSEEvent objects until crew execution completes
        """
        while not self._is_finished:
            try:
                event = await asyncio.wait_for(
                    self._queue.get(),
                    timeout=30.0,
                )
                yield event
                
                if event.event_type in (SSEEventType.DONE, SSEEventType.ERROR):
                    break
                    
            except asyncio.TimeoutError:
                # Emit heartbeat to keep connection alive
                yield SSEEvent(
                    event_type=SSEEventType.META,
                    data={"heartbeat": True}
                )
    
    def emit_risk_warning(self, confidence: float, message: str):
        """
        Emit a risk warning event.
        
        Args:
            confidence: Confidence score (0-1)
            message: Warning message
        """
        self._emit_sync(SSEEvent(
            event_type=SSEEventType.RISK,
            data={
                "confidence": confidence,
                "message": message,
            }
        ))


class CrewSSEAdapter:
    """
    Adapter for running crewAI crews with SSE streaming.
    
    This adapter wraps crew execution and provides an async
    generator interface compatible with FastAPI's StreamingResponse.
    """
    
    def __init__(
        self,
        trace_id: Optional[str] = None,
        request_id: Optional[str] = None,
    ):
        """
        Initialize the adapter.
        
        Args:
            trace_id: Request trace ID
            request_id: Request ID
        """
        self.trace_id = trace_id
        self.request_id = request_id
        self._handler: Optional[SSECallbackHandler] = None
    
    async def execute_and_stream(
        self,
        crew: Any,
        inputs: Optional[Dict[str, Any]] = None,
    ):
        """
        Execute a crew and stream events as SSE.
        
        Args:
            crew: CrewAI Crew instance
            inputs: Input parameters for crew.kickoff()
            
        Yields:
            SSE formatted strings
        """
        import concurrent.futures
        
        # Create callback handler
        self._handler = SSECallbackHandler(
            trace_id=self.trace_id,
            request_id=self.request_id,
        )
        
        # Start crew in background thread (crewAI is synchronous)
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        
        def run_crew():
            try:
                return crew.kickoff(inputs=inputs or {})
            except Exception as e:
                logger.error("crew_sse_adapter.execution_error", error=str(e))
                raise
        
        # Submit crew execution
        future = executor.submit(run_crew)
        
        # Stream events while crew is running
        async for event in self._handler.stream():
            yield event.to_sse_string()
        
        # Get final result
        try:
            result = future.result(timeout=300)  # 5 minute timeout
            
            # Emit final result as done event if not already emitted
            if not self._handler._is_finished:
                yield SSEEvent(
                    event_type=SSEEventType.DONE,
                    data={
                        "trace_id": self.trace_id,
                        "request_id": self.request_id,
                        "result": str(result)[:500] if result else None,
                    }
                ).to_sse_string()
                
        except Exception as e:
            yield SSEEvent(
                event_type=SSEEventType.ERROR,
                data={
                    "code": "CREW-5002",
                    "message": str(e),
                    "trace_id": self.trace_id,
                    "request_id": self.request_id,
                }
            ).to_sse_string()
        
        finally:
            executor.shutdown(wait=False)


def create_sse_callback_handler(
    trace_id: Optional[str] = None,
    request_id: Optional[str] = None,
) -> SSECallbackHandler:
    """
    Factory function to create an SSE callback handler.
    
    Args:
        trace_id: Request trace ID
        request_id: Request ID
        
    Returns:
        Configured SSECallbackHandler
    """
    return SSECallbackHandler(
        trace_id=trace_id,
        request_id=request_id,
    )
