"""
RAG相关模型 - 文档、分块、索引版本
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import String, Text, ForeignKey, Integer, Numeric, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, VECTOR

from app.models.base import Base


class DocumentStatus(str, Enum):
    """文档状态"""
    PENDING = "pending"
    PROCESSING = "processing"
    INDEXED = "indexed"
    FAILED = "failed"
    ARCHIVED = "archived"


class RAGDocument(Base):
    """RAG文档元数据表"""
    
    __tablename__ = "rag_documents"
    
    # 文档基本信息
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)  # local_dir, upload
    source_path: Mapped[str] = mapped_column(String(512), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)  # sha256
    
    # 文档类型
    mime_type: Mapped[str] = mapped_column(String(128), nullable=False)
    
    # 状态
    status: Mapped[str] = mapped_column(
        String(32),
        default=DocumentStatus.PENDING.value,
        nullable=False,
    )
    
    # 当前激活版本
    active_version_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    
    # 元数据
    meta_info: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    
    # 错误信息
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # 关系
    versions: Mapped[list["RAGDocVersion"]] = relationship(
        "RAGDocVersion",
        back_populates="document",
        cascade="all, delete-orphan",
    )
    
    __table_args__ = (
        Index("idx_rag_docs_status", "status"),
        Index("idx_rag_docs_source", "source_type", "source_path"),
    )


class RAGDocVersion(Base):
    """RAG文档版本表"""
    
    __tablename__ = "rag_doc_versions"
    
    document_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("rag_documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # 文件快照信息
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    mtime: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    
    # 提取的原始内容
    raw_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # 清洗后的内容
    cleaned_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # 质量评分
    quality_score: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    
    # 分块数量
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # 关联的索引版本
    index_version_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    
    # 关系
    document: Mapped["RAGDocument"] = relationship("RAGDocument", back_populates="versions")
    chunks: Mapped[list["RAGChunk"]] = relationship(
        "RAGChunk",
        back_populates="doc_version",
        cascade="all, delete-orphan",
    )
    
    __table_args__ = (
        Index("idx_doc_versions_doc_version", "document_id", "version_no", unique=True),
    )


class RAGChunk(Base):
    """RAG文档分块表 - 包含向量索引"""
    
    __tablename__ = "rag_chunks"
    
    doc_version_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("rag_doc_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    # 分块序号
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # 分块内容
    content: Mapped[str] = mapped_column(Text, nullable=False)
    
    # 向量嵌入 - 维度由配置决定
    embedding: Mapped[Optional[list]] = mapped_column(
        VECTOR(1024),  # 使用配置的VECTOR_DIMENSION
        nullable=True,
    )
    
    # 全文检索向量
    tsv: Mapped[Optional[object]] = mapped_column(TSVECTOR, nullable=True)
    
    # 语言
    lang: Mapped[str] = mapped_column(String(8), default="zh")
    
    # Token数
    token_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # 质量分
    quality_score: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    
    # 章节路径（如：第一章/第一节）
    section_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    
    # 页码/位置信息
    page_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    position_start: Mapped[int] = mapped_column(Integer, default=0)
    position_end: Mapped[int] = mapped_column(Integer, default=0)
    
    # 关系
    doc_version: Mapped["RAGDocVersion"] = relationship("RAGDocVersion", back_populates="chunks")
    
    __table_args__ = (
        Index("idx_chunks_doc_version_index", "doc_version_id", "chunk_index", unique=True),
        # pgvector索引通过SQL迁移脚本创建
    )


class RAGIndexVersion(Base):
    """RAG索引版本表"""
    
    __tablename__ = "rag_index_versions"
    
    # 版本号
    version_name: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    
    # 版本描述
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # 是否激活
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # 包含的文档数量
    document_count: Mapped[int] = mapped_column(Integer, default=0)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # 索引配置
    config: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    
    # 激活时间
    activated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    __table_args__ = (
        Index("idx_index_versions_active", "is_active"),
    )


class RetrievalLog(Base):
    """检索日志表 - 用于监控和评测"""
    
    __tablename__ = "retrieval_logs"
    
    # 查询信息
    query: Mapped[str] = mapped_column(Text, nullable=False)
    query_normalized: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # 会话/追踪信息
    session_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    trace_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    
    # 使用的索引版本
    index_version_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    
    # 检索结果
    retrieval_results: Mapped[list] = mapped_column(JSONB, nullable=False)
    
    # 性能指标
    latency_ms: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    
    # 命中评估（可人工标注）
    hit_accurate: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    
    __table_args__ = (
        Index("idx_retrieval_logs_created", "created_at"),
    )
