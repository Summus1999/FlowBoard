"""
Configuration module
Supports environment variables and .env files
"""

import os
from functools import lru_cache
from pathlib import Path
from typing import List, Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Default data directory: ai_service/local_data/
_DEFAULT_DATA_DIR = str(Path(__file__).resolve().parent.parent.parent / "local_data")


class Settings(BaseSettings):
    """Application settings"""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )
    
    # App
    APP_NAME: str = "FlowBoard AI Service"
    APP_VERSION: str = "0.2.0"
    DEBUG: bool = Field(default=False, description="Debug mode")
    ENV: str = Field(default="development", description="Runtime environment")
    
    # API
    API_PREFIX: str = "/api/v1"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    
    # CORS
    CORS_ORIGINS: List[str] = Field(
        default=["*"],
        description="Allowed CORS origins"
    )
    
    # Local data directory (SQLite DB + ChromaDB persistence)
    DATA_DIR: str = Field(default=_DEFAULT_DATA_DIR, description="Local data directory")
    
    # Database (SQLite)
    DATABASE_URL: Optional[str] = Field(
        default=None,
        description="SQLite connection string; auto-derived from DATA_DIR if not set"
    )
    
    # ChromaDB (embedded vector store)
    CHROMA_PERSIST_DIR: Optional[str] = Field(
        default=None,
        description="ChromaDB persistence directory; auto-derived from DATA_DIR if not set"
    )
    VECTOR_DIMENSION: int = 1024
    
    # LangSmith (optional)
    LANGSMITH_API_KEY: Optional[str] = None
    LANGSMITH_PROJECT: str = "flowboard-ai"
    LANGSMITH_ENDPOINT: str = "https://api.smith.langchain.com"
    LANGSMITH_TRACING: bool = False
    
    # Model gateway - Qwen
    QWEN_API_KEY: Optional[str] = None
    QWEN_BASE_URL: str = "https://dashscope.aliyuncs.com/api/v1"
    QWEN_DEFAULT_MODEL: str = "qwen-max"
    QWEN_EMBEDDING_MODEL: str = "text-embedding-v3"
    
    # Model gateway - Kimi
    KIMI_API_KEY: Optional[str] = None
    KIMI_BASE_URL: str = "https://api.moonshot.cn/v1"
    KIMI_DEFAULT_MODEL: str = "moonshot-v1-8k"
    
    # Model gateway - GLM
    GLM_API_KEY: Optional[str] = None
    GLM_BASE_URL: str = "https://open.bigmodel.cn/api/paas/v4"
    GLM_DEFAULT_MODEL: str = "glm-4-flash"
    
    # Model gateway - Silicon Flow
    SILFLOW_API_KEY: Optional[str] = None
    SILFLOW_BASE_URL: str = "https://api.siliconflow.cn/v1"
    SILFLOW_DEFAULT_MODEL: str = "Qwen/Qwen2.5-72B-Instruct"
    
    # Model routing
    DEFAULT_MODEL_PROVIDER: str = "qwen"
    FALLBACK_MODEL_PROVIDER: str = "kimi"
    
    # Budget
    MONTHLY_BUDGET_RMB: float = 150.0
    COST_WARNING_THRESHOLD: float = 0.8
    
    # Performance
    REQUEST_TIMEOUT: int = 60
    STREAM_CHUNK_SIZE: int = 64
    MAX_RETRIES: int = 3
    
    # RAG
    RAG_CHUNK_SIZE: int = 500
    RAG_CHUNK_OVERLAP: int = 100
    RAG_TOP_K: int = 8
    RAG_RERANK_TOP_K: int = 5
    RAG_CONFIDENCE_THRESHOLD: float = 0.9
    RAG_RETRIEVAL_TIMEOUT_MS: int = 1800
    RAG_DEGRADE_ON_TIMEOUT: bool = True
    
    # Docs
    DOCS_BASE_PATH: str = "./docs"
    INDEX_VERSION_RETENTION: int = 5
    
    # Security
    SECRET_KEY: str = Field(
        default_factory=lambda: os.environ.get("SECRET_KEY") or "dev-secret-key-not-for-production"
    )
    API_TOKEN: Optional[str] = Field(default=None, description="Bearer token for remote access")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    SECURITY_SOURCE_WHITELIST: List[str] = Field(default_factory=list)

    # Idempotency
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

    # Prompt and evaluation
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
    
    def get_data_dir(self) -> str:
        p = Path(self.DATA_DIR)
        p.mkdir(parents=True, exist_ok=True)
        return str(p)
    
    def get_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"sqlite:///{Path(self.get_data_dir()) / 'flowboard.db'}"
    
    def get_async_database_url(self) -> str:
        url = self.get_database_url()
        return url.replace("sqlite:///", "sqlite+aiosqlite:///")
    
    def get_chroma_persist_dir(self) -> str:
        if self.CHROMA_PERSIST_DIR:
            return self.CHROMA_PERSIST_DIR
        p = Path(self.get_data_dir()) / "chroma"
        p.mkdir(parents=True, exist_ok=True)
        return str(p)


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
