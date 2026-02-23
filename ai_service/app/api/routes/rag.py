"""
RAG API路由
处理文档索引、检索等
"""

import hashlib
import os
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.api.schemas import (
    RAGSourceRequest,
    RAGSourceResponse,
    RAGIndexRequest,
    RAGIndexResponse,
    RAGIndexVersionResponse,
)
from app.api.deps import get_db, get_trace_id, get_request_id
from app.models.rag import RAGDocument, RAGDocVersion, RAGIndexVersion, DocumentStatus

logger = get_logger(__name__)
router = APIRouter()


@router.post("/sources", response_model=RAGSourceResponse)
async def add_source(
    request: RAGSourceRequest,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    添加RAG数据源
    
    支持本地目录
    """
    if request.source_type == "local_dir":
        # 验证路径存在
        if not os.path.exists(request.path):
            raise HTTPException(status_code=400, detail="路径不存在")
        
        if not os.path.isdir(request.path):
            raise HTTPException(status_code=400, detail="路径不是目录")
        
        # 创建文档记录
        doc = RAGDocument(
            id=str(uuid4()),
            source_type=request.source_type,
            source_path=request.path,
            file_name=os.path.basename(request.path),
            file_size=0,  # 目录大小稍后计算
            file_hash="",  # 目录hash稍后计算
            mime_type="inode/directory",
            status=DocumentStatus.PENDING.value,
        )
        
        db.add(doc)
        await db.commit()
        await db.refresh(doc)
        
        logger.info(
            "rag.source_added",
            source_id=doc.id,
            path=request.path,
        )
        
        return RAGSourceResponse(
            trace_id=trace_id,
            request_id=request_id,
            source_id=doc.id,
            source_type=request.source_type,
            path=request.path,
            status=doc.status,
        )
    else:
        raise HTTPException(status_code=400, detail="不支持的source_type")


@router.post("/index-jobs", response_model=RAGIndexResponse)
async def create_index_job(
    request: RAGIndexRequest,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    触发索引任务
    
    全量或增量索引
    """
    job_id = str(uuid4())
    
    logger.info(
        "rag.index_job_created",
        job_id=job_id,
        mode=request.mode,
        source_id=request.source_id,
    )
    
    # TODO: 实际触发后台索引任务
    
    return RAGIndexResponse(
        trace_id=trace_id,
        request_id=request_id,
        job_id=job_id,
        status="queued",
        mode=request.mode,
    )


@router.get("/index-versions", response_model=RAGIndexVersionResponse)
async def list_index_versions(
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    列出所有索引版本
    """
    result = await db.execute(
        select(RAGIndexVersion).order_by(RAGIndexVersion.created_at.desc())
    )
    versions = result.scalars().all()
    
    active_version = None
    for v in versions:
        if v.is_active:
            active_version = v.id
            break
    
    return RAGIndexVersionResponse(
        trace_id=trace_id,
        request_id=request_id,
        versions=[
            {
                "id": v.id,
                "version_name": v.version_name,
                "is_active": v.is_active,
                "document_count": v.document_count,
                "chunk_count": v.chunk_count,
                "created_at": v.created_at.isoformat(),
            }
            for v in versions
        ],
        active_version=active_version,
    )


@router.post("/index-versions/{version_id}/activate")
async def activate_index_version(
    version_id: str,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    激活指定的索引版本
    """
    # 获取目标版本
    result = await db.execute(
        select(RAGIndexVersion).where(RAGIndexVersion.id == version_id)
    )
    version = result.scalar_one_or_none()
    
    if not version:
        raise HTTPException(status_code=404, detail="索引版本不存在")
    
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
    version.is_active = True
    version.activated_at = datetime.now()
    
    await db.commit()
    
    logger.info("rag.index_version_activated", version_id=version_id)
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "version_id": version_id,
        "activated": True,
    }


@router.get("/documents")
async def list_documents(
    status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    列出所有文档
    """
    query = select(RAGDocument).order_by(RAGDocument.created_at.desc())
    
    if status:
        query = query.where(RAGDocument.status == status)
    
    query = query.limit(limit).offset(offset)
    
    result = await db.execute(query)
    documents = result.scalars().all()
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "documents": [
            {
                "id": d.id,
                "file_name": d.file_name,
                "source_path": d.source_path,
                "status": d.status,
                "file_size": d.file_size,
                "created_at": d.created_at.isoformat(),
            }
            for d in documents
        ],
    }
