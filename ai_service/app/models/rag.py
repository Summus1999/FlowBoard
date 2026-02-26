"""
RAG models - documents, chunks, index versions
Embeddings are stored in ChromaDB, not in the SQL database.
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class DocumentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    INDEXED = "indexed"
    FAILED = "failed"
    ARCHIVED = "archived"


class RAGDocument(Base):
    __tablename__ = "rag_documents"
    
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)
    source_path: Mapped[str] = mapped_column(String(512), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    mime_type: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), default=DocumentStatus.PENDING.value, nullable=False,
    )
    active_version_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    meta_info: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    versions: Mapped[list["RAGDocVersion"]] = relationship(
        "RAGDocVersion", back_populates="document", cascade="all, delete-orphan",
    )
    
    __table_args__ = (
        Index("idx_rag_docs_status", "status"),
        Index("idx_rag_docs_source", "source_type", "source_path"),
    )


class RAGDocVersion(Base):
    __tablename__ = "rag_doc_versions"
    
    document_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("rag_documents.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    mtime: Mapped[datetime] = mapped_column(DateTime(), nullable=False)
    raw_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cleaned_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    quality_score: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    index_version_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    
    document: Mapped["RAGDocument"] = relationship("RAGDocument", back_populates="versions")
    chunks: Mapped[list["RAGChunk"]] = relationship(
        "RAGChunk", back_populates="doc_version", cascade="all, delete-orphan",
    )
    
    __table_args__ = (
        Index("idx_doc_versions_doc_version", "document_id", "version_no", unique=True),
    )


class RAGChunk(Base):
    """
    RAG chunk table.
    Embedding vectors are stored in ChromaDB (keyed by chunk id),
    not in this SQL table.
    """
    __tablename__ = "rag_chunks"
    
    doc_version_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("rag_doc_versions.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    lang: Mapped[str] = mapped_column(String(8), default="zh")
    token_count: Mapped[int] = mapped_column(Integer, default=0)
    quality_score: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    section_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    page_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    position_start: Mapped[int] = mapped_column(Integer, default=0)
    position_end: Mapped[int] = mapped_column(Integer, default=0)
    
    doc_version: Mapped["RAGDocVersion"] = relationship("RAGDocVersion", back_populates="chunks")
    
    __table_args__ = (
        Index("idx_chunks_doc_version_index", "doc_version_id", "chunk_index", unique=True),
    )


class RAGIndexVersion(Base):
    __tablename__ = "rag_index_versions"
    
    version_name: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    document_count: Mapped[int] = mapped_column(Integer, default=0)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    activated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(), nullable=True)
    
    __table_args__ = (
        Index("idx_index_versions_active", "is_active"),
    )


class RetrievalLog(Base):
    __tablename__ = "retrieval_logs"
    
    query: Mapped[str] = mapped_column(Text, nullable=False)
    query_normalized: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    session_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    trace_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    index_version_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    retrieval_results: Mapped[list] = mapped_column(JSON, nullable=False)
    latency_ms: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    hit_accurate: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    
    __table_args__ = (
        Index("idx_retrieval_logs_created", "created_at"),
    )
