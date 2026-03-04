"""
RAG API路由
处理文档索引、检索等
支持传统检索和Sirchmunk代理式检索
"""

import hashlib
import os
from datetime import datetime
from typing import Optional, List, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
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
from app.models.rag import RAGDocument, RAGDocVersion, RAGChunk, RAGIndexVersion, DocumentStatus
from app.services.rag_worker import get_rag_worker
from app.services.indexing_service import get_indexing_service, get_version_manager
from app.services.retrieval_service import get_retrieval_service
from app.security.input_filter import validate_user_input
from app.security.retrieval_isolation import enforce_source_whitelist

logger = get_logger(__name__)
router = APIRouter()


@router.post("/sources", response_model=RAGSourceResponse)
async def add_source(
    request: RAGSourceRequest,
    background_tasks: BackgroundTasks,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    添加RAG数据源
    
    支持本地目录，会自动启动监控
    """
    if request.source_type == "local_dir":
        # 验证路径存在
        if not os.path.exists(request.path):
            raise HTTPException(status_code=400, detail="路径不存在")
        
        if not os.path.isdir(request.path):
            raise HTTPException(status_code=400, detail="路径不是目录")
        enforce_source_whitelist(request.path)
        
        # 创建文档记录
        source_id = str(uuid4())
        doc = RAGDocument(
            id=source_id,
            source_type=request.source_type,
            source_path=request.path,
            file_name=os.path.basename(request.path),
            file_size=0,
            file_hash="",
            mime_type="inode/directory",
            status=DocumentStatus.PENDING.value,
        )
        
        db.add(doc)
        await db.commit()
        await db.refresh(doc)
        
        # 如果启用自动同步，启动监控
        if request.auto_sync:
            worker = get_rag_worker()
            await worker.start(watch_path=request.path, source_id=source_id)
            
            # 后台触发全量索引
            background_tasks.add_task(
                worker.trigger_full_index,
                watch_path=request.path,
                source_id=source_id,
            )
        
        logger.info(
            "rag.source_added",
            source_id=source_id,
            path=request.path,
        )
        
        return RAGSourceResponse(
            trace_id=trace_id,
            request_id=request_id,
            source_id=source_id,
            source_type=request.source_type,
            path=request.path,
            status=doc.status,
        )
    else:
        raise HTTPException(status_code=400, detail="不支持的source_type")


@router.post("/index-jobs", response_model=RAGIndexResponse)
async def create_index_job(
    request: RAGIndexRequest,
    background_tasks: BackgroundTasks,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    触发索引任务
    
    全量或增量索引
    """
    job_id = str(uuid4())
    
    if request.mode == "full":
        # 全量索引
        if request.source_id:
            # 获取源路径
            result = await db.execute(
                select(RAGDocument).where(RAGDocument.id == request.source_id)
            )
            source = result.scalar_one_or_none()
            
            if not source:
                raise HTTPException(status_code=404, detail="数据源不存在")
            
            # 后台执行全量索引
            worker = get_rag_worker()
            background_tasks.add_task(
                worker.trigger_full_index,
                watch_path=source.source_path,
                source_id=request.source_id,
            )
        else:
            raise HTTPException(status_code=400, detail="全量索引需要source_id")
    
    elif request.mode == "incremental":
        # 增量索引由watcher自动处理
        pass
    
    logger.info(
        "rag.index_job_created",
        job_id=job_id,
        mode=request.mode,
        source_id=request.source_id,
    )
    
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
                "created_at": v.created_at.isoformat() if v.created_at else None,
            }
            for v in versions
        ],
        active_version=active_version,
    )


@router.post("/index-versions")
async def create_index_version(
    name: str,
    description: str = "",
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    创建新的索引版本
    """
    manager = get_version_manager()
    
    version = await manager.create_version(
        name=name,
        description=description,
        db=db,
    )
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "version_id": version.id,
        "version_name": version.version_name,
        "document_count": version.document_count,
        "chunk_count": version.chunk_count,
    }


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
    manager = get_version_manager()
    
    try:
        await manager.activate_version(version_id=version_id, db=db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "version_id": version_id,
        "activated": True,
    }


@router.get("/documents")
async def list_documents(
    status: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
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
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in documents
        ],
    }


@router.post("/search")
async def search_documents(
    query: str,
    top_k: int = Query(5, ge=1, le=20),
    mode: Literal["FAST", "DEEP", "FILENAME_ONLY", "traditional"] = Query(
        default="traditional",
        description="搜索模式: traditional(传统检索), FAST/DEEP/FILENAME_ONLY(Sirchmunk模式)"
    ),
    paths: Optional[List[str]] = Query(
        default=None,
        description="知识库路径列表（仅Sirchmunk模式）"
    ),
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    session_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    搜索文档
    
    支持两种检索模式：
    - traditional: 传统混合检索（稀疏检索 + 稠密检索 + RRF融合）
    - FAST/DEEP/FILENAME_ONLY: Sirchmunk代理式检索
    """
    validate_user_input(query)
    
    use_sirchmunk = getattr(settings, 'USE_SIRCHMUNK', False)
    
    # 如果指定了Sirchmunk模式且已启用
    if mode != "traditional" and use_sirchmunk:
        try:
            from app.services.sirchmunk_retrieval_service import SirchmunkRetrievalService
            
            sirchmunk_service = SirchmunkRetrievalService()
            await sirchmunk_service.initialize()
            
            result = await sirchmunk_service.search(
                query=query,
                paths=paths,
                mode=mode,
                top_k_files=top_k,
            )
            
            return {
                "trace_id": trace_id,
                "request_id": request_id,
                "query": query,
                "mode": mode,
                "results": [
                    {
                        "file_path": f.get("path", ""),
                        "file_name": f.get("file_name", ""),
                        "relevance_score": f.get("relevance_score", 0.0),
                        "evidence": f.get("evidence", []),
                        "summary": f.get("summary", ""),
                    }
                    for f in result.files
                ],
                "summary": result.summary,
                "confidence": result.confidence if hasattr(result, 'confidence') else 0.8,
                "result_count": len(result.files),
                "search_engine": "sirchmunk",
            }
        except Exception as e:
            logger.error("rag.sirchmunk_search_failed", error=str(e))
            # 降级到传统检索
            logger.warning("rag.falling_back_to_traditional_search")
    
    # 传统检索
    retrieval_service = get_retrieval_service()
    
    results = await retrieval_service.retrieve(
        query=query,
        db=db,
        session_id=session_id,
        trace_id=trace_id,
        top_k=top_k,
    )
    
    # 评估置信度
    confidence = await retrieval_service.evaluate_confidence(query, results)
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "query": query,
        "mode": "traditional",
        "results": [
            {
                "chunk_id": r.chunk_id,
                "content": r.content,
                "score": r.score,
                "doc_name": r.doc_name,
                "section_path": r.section_path,
                "page_number": r.page_number,
                "source_path": r.source_path,
                "rank": r.rank,
            }
            for r in results
        ],
        "confidence": confidence,
        "result_count": len(results),
        "search_engine": "traditional",
    }


@router.get("/stats")
async def get_stats(
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
    db: AsyncSession = Depends(get_db),
):
    """
    获取RAG统计信息
    """
    indexing_service = get_indexing_service()
    stats = await indexing_service.get_document_stats(db)
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "stats": stats,
    }
