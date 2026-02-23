"""
自定义异常类
统一API错误码和异常处理
"""

from typing import Any, Dict, Optional
from fastapi import HTTPException


class AIErrorCode:
    """错误码定义"""
    # 4xx 客户端错误
    INVALID_PARAMS = "AI-4001"
    UNAUTHORIZED = "AI-4010"
    UNCONFIRMED_HIGH_RISK = "AI-4010"  # 未确认高风险操作
    FORBIDDEN = "AI-4030"
    RESOURCE_NOT_FOUND = "AI-4040"
    VERSION_CONFLICT = "AI-4090"
    REQUEST_ID_CONFLICT = "AI-4091"
    BUDGET_EXCEEDED = "AI-4290"
    
    # 5xx 服务端错误
    MODEL_ERROR = "AI-5001"
    RETRIEVAL_TIMEOUT = "AI-5002"
    TOOL_EXECUTION_FAILED = "AI-5003"
    INTERNAL_ERROR = "AI-5000"


class AIException(Exception):
    """基础AI异常类"""
    
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None
    ):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "code": self.code,
            "message": self.message,
            "details": self.details,
        }


class InvalidParamsException(AIException):
    """参数非法异常"""
    def __init__(self, message: str = "参数非法", details: Optional[Dict[str, Any]] = None):
        super().__init__(AIErrorCode.INVALID_PARAMS, message, 400, details)


class UnconfirmedRiskException(AIException):
    """未确认高风险操作异常"""
    def __init__(self, message: str = "未确认高风险操作", details: Optional[Dict[str, Any]] = None):
        super().__init__(AIErrorCode.UNCONFIRMED_HIGH_RISK, message, 403, details)


class ResourceNotFoundException(AIException):
    """资源不存在异常"""
    def __init__(self, message: str = "资源不存在", details: Optional[Dict[str, Any]] = None):
        super().__init__(AIErrorCode.RESOURCE_NOT_FOUND, message, 404, details)


class VersionConflictException(AIException):
    """版本冲突异常"""
    def __init__(self, message: str = "版本冲突", details: Optional[Dict[str, Any]] = None):
        super().__init__(AIErrorCode.VERSION_CONFLICT, message, 409, details)


class RequestIdConflictException(AIException):
    """Request ID冲突异常"""
    def __init__(self, message: str = "request_id冲突，payload不一致", details: Optional[Dict[str, Any]] = None):
        super().__init__(AIErrorCode.REQUEST_ID_CONFLICT, message, 409, details)


class BudgetExceededException(AIException):
    """预算超限异常"""
    def __init__(self, message: str = "月度预算已超限", details: Optional[Dict[str, Any]] = None):
        super().__init__(AIErrorCode.BUDGET_EXCEEDED, message, 429, details)


class ModelException(AIException):
    """模型调用异常"""
    def __init__(self, message: str = "模型调用失败", details: Optional[Dict[str, Any]] = None):
        super().__init__(AIErrorCode.MODEL_ERROR, message, 502, details)


class RetrievalTimeoutException(AIException):
    """检索超时异常"""
    def __init__(self, message: str = "检索超时", details: Optional[Dict[str, Any]] = None):
        super().__init__(AIErrorCode.RETRIEVAL_TIMEOUT, message, 504, details)


class ToolExecutionException(AIException):
    """工具执行异常"""
    def __init__(self, message: str = "工具执行失败", details: Optional[Dict[str, Any]] = None):
        super().__init__(AIErrorCode.TOOL_EXECUTION_FAILED, message, 502, details)
