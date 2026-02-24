"""
索引服务
管理文档索引的生命周期：解析、分块、向量化、存储
"""

import asyncio
from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import uuid4

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.core.database import get_async_db_session
from app.models.rag import (
    RAGDocument, RAGDocVersion, RAGChunk, RAGIndexVersion,
    DocumentStatus,
)
from app.services.document_parser import get_parser_service, ParsedDocument
from app.services.text_processor import get_text_processor, TextChunk
from app.services.model_gateway import get_model_gateway

logger = get_logger(__name__)


class IndexingService:
    """
    索引服务
    
    职责：
    1. 处理文档变更（新增、修改、删除）
    2. 解析文档并分块
    3. 生成embedding并存储
    4. 管理索引版本
    """
    
    def __init__(self):
        self.parser = get_parser_service()
        self.processor = get_text_processor()
        self.model_gateway = get_model_gateway()
    
    async def process_document(
        self,
        file_path: str,
        source_id: str,
        db: AsyncSession,
    ) -> Optional[RAGDocVersion]:
        """
        处理单个文档
        
        流程：
        1. 解析文档
        2. 清洗和分块
        3. 生成embedding
        4. 存储到数据库
        """
        logger.info("indexing.process_start", file_path=file_path)
        
        try:
            # 1. 解析文档
            parsed = self.parser.parse(file_path)
            
            # 2. 查找或创建文档记录
            document = await self._get_or_create_document(file_path, source_id, parsed, db)
            
            # 检查是否已存在相同版本
            existing_version = await self._check_existing_version(document.id, parsed, db)
            if existing_version:
                logger.info("indexing.version_exists", file_path=file_path)
                return existing_version
            
            # 3. 创建新版本
            version = await self._create_version(document.id, parsed, db)
            
            # 4. 清洗和分块
            chunks = self.processor.process(parsed.content)
            
            if not chunks:
                logger.warning("indexing.no_chunks", file_path=file_path)
                version.quality_score = 0.0
                await db.commit()
                return version
            
            # 5. 生成embedding并存储
            await self._index_chunks(version.id, chunks, db)
            
            # 6. 更新版本信息
            version.chunk_count = len(chunks)
            version.quality_score = sum(c.quality_score for c in chunks) / len(chunks)
            
            # 更新文档状态
            document.status = DocumentStatus.INDEXED.value
            document.active_version_id = version.id
            
            await db.commit()
            
            logger.info(
                "indexing.completed",
                file_path=file_path,
                version_id=version.id,
                chunk_count=len(chunks),
            )
            
            return version
            
        except Exception as e:
            logger.error("indexing.failed", file_path=file_path, error=str(e))
            
            # 更新文档错误状态
            document = await self._get_document_by_path(file_path, db)
            if document:
                document.status = DocumentStatus.FAILED.value
                document.error_message = str(e)
                await db.commit()
            
            raise
    
    async def _get_or_create_document(
        self,
        file_path: str,
        source_id: str,
        parsed: ParsedDocument,
        db: AsyncSession,
    ) -> RAGDocument:
        """获取或创建文档记录"""
        # 查找现有文档
        result = await db.execute(
            select(RAGDocument).where(RAGDocument.source_path == file_path)
        )
        document = result.scalar_one_or_none()
        
        if document:
            # 更新文档信息
            document.file_size = parsed.file_size
            document.file_hash = parsed.file_hash
            document.mime_type = parsed.mime_type
            document.status = DocumentStatus.PROCESSING.value
            document.error_message = None
        else:
            # 创建新文档
            document = RAGDocument(
                id=str(uuid4()),
                source_type="local_dir",
                source_path=file_path,
                file_name=parsed.file_name,
                file_size=parsed.file_size,
                file_hash=parsed.file_hash,
                mime_type=parsed.mime_type,
                status=DocumentStatus.PROCESSING.value,
                meta_info=parsed.metadata,
            )
            db.add(document)
        
        await db.flush()
        return document
    
    async def _check_existing_version(
        self,
        document_id: str,
        parsed: ParsedDocument,
        db: AsyncSession,
    ) -> Optional[RAGDocVersion]:
        """检查是否已存在相同hash的版本"""
        result = await db.execute(
            select(RAGDocVersion)
            .where(RAGDocVersion.document_id == document_id)
            .where(RAGDocVersion.file_hash == parsed.file_hash)
            .order_by(RAGDocVersion.created_at.desc())
        )
        return result.scalar_one_or_none()
    
    async def _create_version(
        self,
        document_id: str,
        parsed: ParsedDocument,
        db: AsyncSession,
    ) -> RAGDocVersion:
        """创建文档版本"""
        # 获取下一个版本号
        result = await db.execute(
            select(func.coalesce(func.max(RAGDocVersion.version_no), 0))
            .where(RAGDocVersion.document_id == document_id)
        )
        next_version = result.scalar() + 1
        
        version = RAGDocVersion(
            id=str(uuid4()),
            document_id=document_id,
            version_no=next_version,
            file_hash=parsed.file_hash,
            file_size=parsed.file_size,
            mtime=datetime.now(),
            raw_content=parsed.content[:10000],  # 只保存前10KB原始内容
            cleaned_content=None,  # 将在分块后清理
            quality_score=0.0,
            chunk_count=0,
        )
        
        db.add(version)
        await db.flush()
        
        return version
    
    async def _index_chunks(
        self,
        version_id: str,
        chunks: List[TextChunk],
        db: AsyncSession,
    ):
        """索引文本块"""
        # 批量生成embedding
        batch_size = 16
        
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i+batch_size]
            
            # 生成embedding
            texts = [c.content for c in batch]
            try:
                embeddings = await self.model_gateway.embed(texts)
            except Exception as e:
                logger.error("indexing.embedding_failed", error=str(e))
                # 失败时使用零向量
                embeddings = [[0.0] * 1024] * len(batch)
            
            # 创建chunk记录
            for j, (chunk, embedding) in enumerate(zip(batch, embeddings)):
                db_chunk = RAGChunk(
                    id=str(uuid4()),
                    doc_version_id=version_id,
                    chunk_index=chunk.chunk_index,
                    content=chunk.content,
                    embedding=embedding,
                    tsv=None,  # PostgreSQL将自动处理
                    lang=self._detect_language(chunk.content),
                    token_count=chunk.token_count,
                    quality_score=chunk.quality_score,
                    section_path=chunk.section_path,
                    page_number=chunk.page_number,
                    position_start=chunk.position_start,
                    position_end=chunk.position_end,
                )
                db.add(db_chunk)
            
            # 每批次提交
            await db.flush()
    
    def _detect_language(self, text: str) -> str:
        """检测文本语言"""
        import re
        chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
        total_chars = len(re.findall(r'[\u4e00-\u9fffa-zA-Z]', text))
        
        if total_chars == 0:
            return "unknown"
        
        chinese_ratio = chinese_chars / total_chars
        
        if chinese_ratio > 0.5:
            return "zh"
        elif chinese_ratio > 0.1:
            return "mix"
        else:
            return "en"
    
    async def delete_document(
        self,
        document_id: str,
        db: AsyncSession,
    ):
        """删除文档及其所有版本"""
        result = await db.execute(
            select(RAGDocument).where(RAGDocument.id == document_id)
        )
        document = result.scalar_one_or_none()
        
        if document:
            await db.delete(document)
            await db.commit()
            
            logger.info("indexing.document_deleted", document_id=document_id)
    
    async def get_document_stats(
        self,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        """获取文档统计信息"""
        # 文档总数
        result = await db.execute(select(func.count(RAGDocument.id)))
        total_docs = result.scalar()
        
        # 各状态数量
        result = await db.execute(
            select(RAGDocument.status, func.count(RAGDocument.id))
            .group_by(RAGDocument.status)
        )
        status_counts = {status: count for status, count in result.all()}
        
        # 分块总数
        result = await db.execute(select(func.count(RAGChunk.id)))
        total_chunks = result.scalar()
        
        return {
            "total_documents": total_docs,
            "status_breakdown": status_counts,
            "total_chunks": total_chunks,
        }


class IndexVersionManager:
    """索引版本管理器"""
    
    async def create_version(
        self,
        name: str,
        description: str,
        db: AsyncSession,
    ) -> RAGIndexVersion:
        """创建新索引版本"""
        # 获取当前统计
        result = await db.execute(select(func.count(RAGDocument.id)))
        doc_count = result.scalar()
        
        result = await db.execute(select(func.count(RAGChunk.id)))
        chunk_count = result.scalar()
        
        version = RAGIndexVersion(
            id=str(uuid4()),
            version_name=name,
            description=description,
            is_active=False,  # 默认不激活
            document_count=doc_count,
            chunk_count=chunk_count,
            config={
                "chunk_size": settings.RAG_CHUNK_SIZE,
                "chunk_overlap": settings.RAG_CHUNK_OVERLAP,
            },
        )
        
        db.add(version)
        await db.commit()
        await db.refresh(version)
        
        logger.info("index_version.created", version_id=version.id, name=name)
        
        return version
    
    async def activate_version(
        self,
        version_id: str,
        db: AsyncSession,
    ):
        """激活指定版本"""
        # 取消其他版本的激活状态
        await db.execute(
            select(RAGIndexVersion)
            .where(RAGIndexVersion.is_active == True)
        )
        result = await db.execute(
            select(RAGIndexVersion).where(RAGIndexVersion.is_active == True)
        )
        active_versions = result.scalars().all()
        for v in active_versions:
            v.is_active = False
        
        # 激活目标版本
        result = await db.execute(
            select(RAGIndexVersion).where(RAGIndexVersion.id == version_id)
        )
        version = result.scalar_one_or_none()
        
        if version:
            version.is_active = True
            version.activated_at = datetime.now()
            await db.commit()
            
            logger.info("index_version.activated", version_id=version_id)
        else:
            raise ValueError(f"版本不存在: {version_id}")
    
    async def cleanup_old_versions(
        self,
        db: AsyncSession,
        keep_count: int = None,
    ):
        """清理旧版本"""
        keep_count = keep_count or settings.INDEX_VERSION_RETENTION
        
        # 获取所有非激活版本，按创建时间排序
        result = await db.execute(
            select(RAGIndexVersion)
            .where(RAGIndexVersion.is_active == False)
            .order_by(RAGIndexVersion.created_at.desc())
            .offset(keep_count)
        )
        old_versions = result.scalars().all()
        
        for version in old_versions:
            await db.delete(version)
        
        await db.commit()
        
        logger.info("index_version.cleaned_up", removed_count=len(old_versions))


# 全局服务实例
_indexing_service: Optional[IndexingService] = None
_version_manager: Optional[IndexVersionManager] = None


def get_indexing_service() -> IndexingService:
    """获取索引服务单例"""
    global _indexing_service
    if _indexing_service is None:
        _indexing_service = IndexingService()
    return _indexing_service


def get_version_manager() -> IndexVersionManager:
    """获取版本管理器单例"""
    global _version_manager
    if _version_manager is None:
        _version_manager = IndexVersionManager()
    return _version_manager
