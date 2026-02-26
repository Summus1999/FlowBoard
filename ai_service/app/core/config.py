"""
配置管理模块
支持环境变量和.env文件配置
"""

from functools import lru_cache
from typing import List, Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用配置类"""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )
    
    # 应用基础配置
    APP_NAME: str = "FlowBoard AI Service"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = Field(default=False, description="调试模式")
    ENV: str = Field(default="development", description="运行环境")
    
    # API配置
    API_PREFIX: str = "/api/v1"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    
    # CORS配置
    CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"],
        description="允许的CORS源"
    )
    
    # 数据库配置
    DATABASE_URL: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/flowboard_ai",
        description="PostgreSQL连接字符串"
    )
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    
    # pgvector配置
    VECTOR_DIMENSION: int = 1024
    
    # Redis配置
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis连接字符串"
    )
    REDIS_PASSWORD: Optional[str] = None
    
    # LangSmith配置
    LANGSMITH_API_KEY: Optional[str] = None
    LANGSMITH_PROJECT: str = "flowboard-ai"
    LANGSMITH_ENDPOINT: str = "https://api.smith.langchain.com"
    LANGSMITH_TRACING: bool = True
    
    # 模型网关配置
    # Qwen配置
    QWEN_API_KEY: Optional[str] = None
    QWEN_BASE_URL: str = "https://dashscope.aliyuncs.com/api/v1"
    QWEN_DEFAULT_MODEL: str = "qwen-max"
    QWEN_EMBEDDING_MODEL: str = "text-embedding-v3"
    
    # Kimi配置
    KIMI_API_KEY: Optional[str] = None
    KIMI_BASE_URL: str = "https://api.moonshot.cn/v1"
    KIMI_DEFAULT_MODEL: str = "moonshot-v1-8k"
    
    # GLM配置
    GLM_API_KEY: Optional[str] = None
    GLM_BASE_URL: str = "https://open.bigmodel.cn/api/paas/v4"
    GLM_DEFAULT_MODEL: str = "glm-4-flash"
    
    # 默认模型路由
    DEFAULT_MODEL_PROVIDER: str = "qwen"  # qwen, kimi, glm
    FALLBACK_MODEL_PROVIDER: str = "kimi"
    
    # 模型成本配置（用于预算控制）
    MONTHLY_BUDGET_RMB: float = 150.0
    COST_WARNING_THRESHOLD: float = 0.8  # 80%预算时发出警告
    
    # 性能配置
    REQUEST_TIMEOUT: int = 60
    STREAM_CHUNK_SIZE: int = 64
    MAX_RETRIES: int = 3
    
    # RAG配置
    RAG_CHUNK_SIZE: int = 500
    RAG_CHUNK_OVERLAP: int = 100
    RAG_TOP_K: int = 8
    RAG_RERANK_TOP_K: int = 5
    RAG_CONFIDENCE_THRESHOLD: float = 0.9
    RAG_RETRIEVAL_TIMEOUT_MS: int = 1800
    RAG_DEGRADE_ON_TIMEOUT: bool = True
    
    # 文档目录配置
    DOCS_BASE_PATH: str = "./docs"
    INDEX_VERSION_RETENTION: int = 5  # 保留的索引版本数
    
    # 安全配置
    SECRET_KEY: str = Field(default="change-me-in-production", description="用于签名等")
    API_TOKEN: Optional[str] = Field(default=None, description="Bearer token for remote access; if empty, only localhost is allowed")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7天
    SECURITY_SOURCE_WHITELIST: List[str] = Field(default_factory=list)

    # Idempotency配置
    IDEMPOTENCY_TTL_SECONDS: int = 24 * 60 * 60
    IDEMPOTENCY_ENFORCE_POST: bool = True
    IDEMPOTENCY_EXEMPT_POST_PATHS: List[str] = Field(
        default_factory=lambda: [
            "/api/v1/chat/stream",
            "/api/v1/chat/evaluate-confidence",
            "/api/v1/chat/evaluate-answer",
            "/api/v1/chat/rag-query",
            "/api/v1/rag/search",
            "/api/v1/eval/retrieval/evaluate",
            "/api/v1/eval/qa/evaluate",
            "/api/v1/eval/run-batch",
            "/api/v1/eval/offline/run",
        ]
    )

    # Prompt和评测配置
    PROMPT_REGISTRY_PATH: str = "data/prompt_versions.json"
    EVAL_REPORT_DIR: str = "data/eval_reports"

    @property
    def PROJECT_NAME(self) -> str:
        return self.APP_NAME

    @property
    def VERSION(self) -> str:
        return self.APP_VERSION

    @property
    def API_V1_STR(self) -> str:
        return self.API_PREFIX

    @property
    def HOST(self) -> str:
        return self.API_HOST

    @property
    def PORT(self) -> int:
        return self.API_PORT
    
    def get_database_url(self) -> str:
        """获取数据库连接URL"""
        return self.DATABASE_URL
    
    def get_async_database_url(self) -> str:
        """获取异步数据库连接URL"""
        return self.DATABASE_URL.replace(
            "postgresql://", "postgresql+asyncpg://"
        )


@lru_cache()
def get_settings() -> Settings:
    """获取配置单例"""
    return Settings()


settings = get_settings()
