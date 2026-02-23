"""
RAG后台工作器
处理文档变更事件和索引任务
"""

import asyncio
from typing import Optional
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.database import get_async_db_session
from app.services.directory_watcher import (
    DirectoryWatcher, 
    FileChangeEvent, 
    get_watcher_manager
)
from app.services.indexing_service import get_indexing_service

logger = get_logger(__name__)


class RAGWorker:
    """
    RAG后台工作器
    
    职责：
    1. 监听目录变更事件
    2. 处理文档索引任务
    3. 管理索引队列
    """
    
    def __init__(self):
        self.watcher_manager = get_watcher_manager()
        self.indexing_service = get_indexing_service()
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._queue: asyncio.Queue = asyncio.Queue()
    
    async def start(self, watch_path: str, source_id: str):
        """启动工作器"""
        if self._running:
            return
        
        self._running = True
        
        # 添加目录监控
        watcher = self.watcher_manager.add_watcher(
            watch_id=source_id,
            watch_path=watch_path,
            callback=self._on_file_change,
        )
        
        # 启动监控
        await watcher.start()
        
        # 启动处理循环
        self._task = asyncio.create_task(self._process_loop())
        
        logger.info("rag_worker.started", watch_path=watch_path, source_id=source_id)
    
    async def stop(self):
        """停止工作器"""
        self._running = False
        
        # 停止所有监控
        await self.watcher_manager.stop_all()
        
        # 取消处理循环
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        
        logger.info("rag_worker.stopped")
    
    async def _on_file_change(self, event: FileChangeEvent):
        """文件变更回调"""
        logger.info(
            "rag_worker.file_change",
            type=event.event_type,
            path=event.file_path,
        )
        
        # 将事件放入队列
        await self._queue.put(event)
    
    async def _process_loop(self):
        """处理循环"""
        while self._running:
            try:
                # 获取事件
                event = await asyncio.wait_for(self._queue.get(), timeout=1.0)
                
                # 处理事件
                await self._handle_event(event)
                
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("rag_worker.process_error", error=str(e))
    
    async def _handle_event(self, event: FileChangeEvent):
        """处理文件变更事件"""
        async with get_async_db_session() as db:
            try:
                if event.event_type == "created":
                    await self._handle_created(event, db)
                elif event.event_type == "modified":
                    await self._handle_modified(event, db)
                elif event.event_type == "deleted":
                    await self._handle_deleted(event, db)
                
            except Exception as e:
                logger.error(
                    "rag_worker.handle_event_failed",
                    event_type=event.event_type,
                    path=event.file_path,
                    error=str(e),
                )
    
    async def _handle_created(self, event: FileChangeEvent, db: AsyncSession):
        """处理新增文件"""
        logger.info("rag_worker.processing_new_file", path=event.file_path)
        
        await self.indexing_service.process_document(
            file_path=event.file_path,
            source_id="watcher",  # TODO: 使用实际的source_id
            db=db,
        )
    
    async def _handle_modified(self, event: FileChangeEvent, db: AsyncSession):
        """处理修改文件"""
        logger.info("rag_worker.processing_modified_file", path=event.file_path)
        
        # 重新索引
        await self.indexing_service.process_document(
            file_path=event.file_path,
            source_id="watcher",
            db=db,
        )
    
    async def _handle_deleted(self, event: FileChangeEvent, db: AsyncSession):
        """处理删除文件"""
        logger.info("rag_worker.processing_deleted_file", path=event.file_path)
        
        from sqlalchemy import select
        from app.models.rag import RAGDocument
        
        # 查找文档
        result = await db.execute(
            select(RAGDocument).where(RAGDocument.source_path == event.file_path)
        )
        document = result.scalar_one_or_none()
        
        if document:
            await self.indexing_service.delete_document(document.id, db)
    
    async def trigger_full_index(
        self,
        watch_path: str,
        source_id: str,
    ):
        """
        触发全量索引
        
        扫描目录并索引所有文档
        """
        import os
        from pathlib import Path
        
        logger.info("rag_worker.full_index_start", path=watch_path)
        
        parser = get_indexing_service().parser
        
        async with get_async_db_session() as db:
            count = 0
            
            for root, dirs, files in os.walk(watch_path):
                # 跳过隐藏目录
                dirs[:] = [d for d in dirs if not d.startswith('.')]
                
                for filename in files:
                    if filename.startswith('.'):
                        continue
                    
                    file_path = os.path.join(root, filename)
                    
                    # 检查是否支持
                    if not parser.can_parse(file_path):
                        continue
                    
                    try:
                        await self.indexing_service.process_document(
                            file_path=file_path,
                            source_id=source_id,
                            db=db,
                        )
                        count += 1
                        
                    except Exception as e:
                        logger.error(
                            "rag_worker.full_index_file_failed",
                            path=file_path,
                            error=str(e),
                        )
            
            logger.info("rag_worker.full_index_complete", indexed_count=count)


# 全局工作器实例
_worker: Optional[RAGWorker] = None


def get_rag_worker() -> RAGWorker:
    """获取RAG工作器单例"""
    global _worker
    if _worker is None:
        _worker = RAGWorker()
    return _worker
