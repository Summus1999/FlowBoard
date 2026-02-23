"""
日志配置模块
使用structlog实现结构化日志
"""

import sys
import logging
from typing import Any, Dict

import structlog
from structlog.types import EventDict, WrappedLogger


def add_trace_info(
    logger: WrappedLogger,
    method_name: str,
    event_dict: EventDict
) -> EventDict:
    """添加trace信息到日志"""
    # 这里可以添加从contextvars获取的trace_id等信息
    return event_dict


def setup_logging(debug: bool = False) -> None:
    """配置结构化日志"""
    
    # 配置标准库logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.DEBUG if debug else logging.INFO,
    )
    
    # 配置structlog
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            add_trace_info,
            structlog.processors.dict_tracebacks,
            structlog.processors.JSONRenderer() if not debug else structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.DEBUG if debug else logging.INFO
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.BoundLogger:
    """获取logger实例"""
    return structlog.get_logger(name)
