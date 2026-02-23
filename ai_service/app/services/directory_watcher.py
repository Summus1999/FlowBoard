"""
目录监控服务
监控本地文档目录，检测文件变化
"""

import asyncio
import hashlib
import os
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Callable, Dict, List, Optional, Set
import threading
import time

from app.core.logging import get_logger
from app.core.config import settings

logger = get_logger(__name__)


@dataclass
class FileSnapshot:
    """文件快照"""
    path: str
    size: int
    mtime: float
    hash: str
    
    def to_tuple(self) -> tuple:
        """转换为元组用于比较"""
        return (self.path, self.size, self.mtime, self.hash)


@dataclass
class FileChangeEvent:
    """文件变更事件"""
    event_type: str  # created, modified, deleted, moved
    file_path: str
    old_path: Optional[str] = None  # 用于moved事件
    snapshot: Optional[FileSnapshot] = None


class DirectoryWatcher:
    """
    目录监控器
    
    功能：
    1. 扫描目录获取文件快照
    2. 检测新增、修改、删除的文件
    3. 支持增量同步
    """
    
    def __init__(
        self,
        watch_path: str,
        supported_extensions: List[str] = None,
        poll_interval: int = 30,
    ):
        self.watch_path = Path(watch_path).resolve()
        self.supported_extensions = set(supported_extensions or ['.pdf', '.docx', '.txt', '.md', '.markdown'])
        self.poll_interval = poll_interval
        
        self._snapshots: Dict[str, FileSnapshot] = {}
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._callbacks: List[Callable[[FileChangeEvent], None]] = []
        self._lock = threading.Lock()
    
    def add_callback(self, callback: Callable[[FileChangeEvent], None]):
        """添加变更回调"""
        self._callbacks.append(callback)
    
    def remove_callback(self, callback: Callable[[FileChangeEvent], None]):
        """移除变更回调"""
        if callback in self._callbacks:
            self._callbacks.remove(callback)
    
    async def start(self):
        """启动监控"""
        if self._running:
            return
        
        self._running = True
        
        # 初始扫描
        await self._initial_scan()
        
        # 启动监控循环
        self._task = asyncio.create_task(self._watch_loop())
        
        logger.info("watcher.started", path=str(self.watch_path))
    
    async def stop(self):
        """停止监控"""
        self._running = False
        
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        
        logger.info("watcher.stopped", path=str(self.watch_path))
    
    async def _initial_scan(self):
        """初始扫描"""
        logger.info("watcher.initial_scan", path=str(self.watch_path))
        
        snapshots = await self._scan_directory()
        
        with self._lock:
            self._snapshots = snapshots
        
        logger.info("watcher.initial_scan_complete", file_count=len(snapshots))
    
    async def _watch_loop(self):
        """监控循环"""
        while self._running:
            try:
                await self._check_changes()
                await asyncio.sleep(self.poll_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("watcher.loop_error", error=str(e))
                await asyncio.sleep(self.poll_interval)
    
    async def _check_changes(self):
        """检查变更"""
        current_snapshots = await self._scan_directory()
        
        with self._lock:
            old_snapshots = dict(self._snapshots)
        
        # 检测变更
        changes = self._detect_changes(old_snapshots, current_snapshots)
        
        if changes:
            logger.info("watcher.changes_detected", count=len(changes))
            
            # 更新快照
            with self._lock:
                self._snapshots = current_snapshots
            
            # 触发回调
            for change in changes:
                await self._notify_change(change)
    
    async def _scan_directory(self) -> Dict[str, FileSnapshot]:
        """扫描目录获取文件快照"""
        snapshots = {}
        
        if not self.watch_path.exists():
            logger.warning("watcher.path_not_exist", path=str(self.watch_path))
            return snapshots
        
        try:
            for file_path in self._get_supported_files():
                try:
                    stat = os.stat(file_path)
                    
                    # 计算文件hash（前4KB）
                    file_hash = await self._calculate_file_hash(file_path)
                    
                    snapshot = FileSnapshot(
                        path=file_path,
                        size=stat.st_size,
                        mtime=stat.st_mtime,
                        hash=file_hash,
                    )
                    
                    snapshots[file_path] = snapshot
                    
                except Exception as e:
                    logger.warning("watcher.file_scan_failed", path=file_path, error=str(e))
        
        except Exception as e:
            logger.error("watcher.scan_error", error=str(e))
        
        return snapshots
    
    def _get_supported_files(self) -> List[str]:
        """获取支持的文件列表"""
        files = []
        
        for root, dirs, filenames in os.walk(self.watch_path):
            # 跳过隐藏目录和常见非文档目录
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['node_modules', '__pycache__', 'venv']]
            
            for filename in filenames:
                if filename.startswith('.'):
                    continue
                
                ext = Path(filename).suffix.lower()
                if ext in self.supported_extensions:
                    file_path = os.path.join(root, filename)
                    files.append(file_path)
        
        return files
    
    async def _calculate_file_hash(self, file_path: str, max_size: int = 4096) -> str:
        """计算文件hash（前max_size字节）"""
        try:
            sha256 = hashlib.sha256()
            
            # 使用线程池执行IO操作
            loop = asyncio.get_event_loop()
            
            def read_file():
                with open(file_path, 'rb') as f:
                    data = f.read(max_size)
                    sha256.update(data)
                    
                    # 如果文件大于max_size，添加文件大小到hash
                    f.seek(0, 2)
                    file_size = f.tell()
                    if file_size > max_size:
                        sha256.update(str(file_size).encode())
                
                return sha256.hexdigest()
            
            return await loop.run_in_executor(None, read_file)
            
        except Exception as e:
            logger.warning("watcher.hash_failed", path=file_path, error=str(e))
            return ""
    
    def _detect_changes(
        self,
        old_snapshots: Dict[str, FileSnapshot],
        new_snapshots: Dict[str, FileSnapshot],
    ) -> List[FileChangeEvent]:
        """检测文件变更"""
        changes = []
        
        old_paths = set(old_snapshots.keys())
        new_paths = set(new_snapshots.keys())
        
        # 新增文件
        for path in new_paths - old_paths:
            changes.append(FileChangeEvent(
                event_type="created",
                file_path=path,
                snapshot=new_snapshots[path],
            ))
        
        # 删除文件
        for path in old_paths - new_paths:
            changes.append(FileChangeEvent(
                event_type="deleted",
                file_path=path,
            ))
        
        # 修改文件
        for path in old_paths & new_paths:
            old = old_snapshots[path]
            new = new_snapshots[path]
            
            # 检查大小、修改时间或hash
            if (old.size != new.size or 
                old.mtime != new.mtime or 
                old.hash != new.hash):
                changes.append(FileChangeEvent(
                    event_type="modified",
                    file_path=path,
                    snapshot=new,
                ))
        
        return changes
    
    async def _notify_change(self, change: FileChangeEvent):
        """通知变更"""
        logger.info(
            "watcher.change",
            type=change.event_type,
            path=change.file_path,
        )
        
        for callback in self._callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(change)
                else:
                    callback(change)
            except Exception as e:
                logger.error("watcher.callback_error", error=str(e))
    
    def get_current_snapshots(self) -> Dict[str, FileSnapshot]:
        """获取当前快照"""
        with self._lock:
            return dict(self._snapshots)
    
    def get_file_count(self) -> int:
        """获取文件数量"""
        with self._lock:
            return len(self._snapshots)


class WatcherManager:
    """监控管理器（管理多个目录）"""
    
    def __init__(self):
        self._watchers: Dict[str, DirectoryWatcher] = {}
    
    def add_watcher(
        self,
        watch_id: str,
        watch_path: str,
        callback: Callable[[FileChangeEvent], None],
        supported_extensions: List[str] = None,
    ) -> DirectoryWatcher:
        """添加监控"""
        if watch_id in self._watchers:
            raise ValueError(f"Watcher {watch_id} already exists")
        
        watcher = DirectoryWatcher(
            watch_path=watch_path,
            supported_extensions=supported_extensions,
        )
        watcher.add_callback(callback)
        
        self._watchers[watch_id] = watcher
        
        logger.info("watcher_manager.added", watch_id=watch_id, path=watch_path)
        
        return watcher
    
    def remove_watcher(self, watch_id: str):
        """移除监控"""
        if watch_id in self._watchers:
            watcher = self._watchers.pop(watch_id)
            # 注意：不在这里stop，由调用者控制生命周期
            logger.info("watcher_manager.removed", watch_id=watch_id)
    
    def get_watcher(self, watch_id: str) -> Optional[DirectoryWatcher]:
        """获取监控器"""
        return self._watchers.get(watch_id)
    
    async def start_all(self):
        """启动所有监控"""
        for watch_id, watcher in self._watchers.items():
            await watcher.start()
    
    async def stop_all(self):
        """停止所有监控"""
        for watch_id, watcher in self._watchers.items():
            await watcher.stop()


# 全局管理器实例
_watcher_manager: Optional[WatcherManager] = None


def get_watcher_manager() -> WatcherManager:
    """获取监控管理器单例"""
    global _watcher_manager
    if _watcher_manager is None:
        _watcher_manager = WatcherManager()
    return _watcher_manager
