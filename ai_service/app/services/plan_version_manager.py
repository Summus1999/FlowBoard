"""
计划版本管理服务
实现计划版本管理和回滚
"""

import json
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import uuid4

from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.exceptions import VersionConflictException, ResourceNotFoundException
from app.models.plan import Plan, PlanVersion, Task, PlanStatus

logger = get_logger(__name__)


@dataclass
class VersionComparison:
    """版本比较结果"""
    version_a: int
    version_b: int
    added_tasks: List[str]
    removed_tasks: List[str]
    modified_tasks: List[Dict]
    summary: str


@dataclass
class VersionInfo:
    """版本信息"""
    version_no: int
    created_at: datetime
    confirmed_by_user: bool
    confirmed_at: Optional[datetime]
    change_summary: str
    task_count: int
    is_active: bool


class PlanVersionManager:
    """
    计划版本管理器
    
    功能：
    1. 版本历史管理
    2. 版本回滚
    3. 版本对比
    4. 版本清理
    """
    
    MAX_VERSIONS_TO_KEEP = 10  # 保留的最大版本数
    
    async def create_new_version(
        self,
        plan_id: str,
        content_md: str,
        content_json: Dict[str, Any],
        change_summary: str,
        created_by: str,
        db: AsyncSession,
    ) -> PlanVersion:
        """
        创建新版本
        
        Args:
            plan_id: 计划ID
            content_md: Markdown内容
            content_json: JSON内容
            change_summary: 变更摘要
            created_by: 创建者
            db: 数据库会话
        
        Returns:
            PlanVersion: 新版本
        """
        # 获取当前最大版本号
        result = await db.execute(
            select(func.coalesce(func.max(PlanVersion.version_no), 0))
            .where(PlanVersion.plan_id == plan_id)
        )
        max_version = result.scalar()
        new_version_no = max_version + 1
        
        # 创建新版本
        version = PlanVersion(
            id=str(uuid4()),
            plan_id=plan_id,
            version_no=new_version_no,
            content_md=content_md,
            content_json=content_json,
            change_summary=change_summary,
            confirmed_by_user=False,
            created_by_agent=created_by,
        )
        
        db.add(version)
        
        # 更新计划的当前版本
        result = await db.execute(
            select(Plan).where(Plan.id == plan_id)
        )
        plan = result.scalar_one_or_none()
        
        if plan:
            plan.current_version = new_version_no
            plan.status = PlanStatus.PROPOSED.value
        
        await db.commit()
        await db.refresh(version)
        
        logger.info(
            "plan_version.created",
            plan_id=plan_id,
            version_no=new_version_no,
        )
        
        return version
    
    async def get_version_history(
        self,
        plan_id: str,
        db: AsyncSession,
    ) -> List[VersionInfo]:
        """获取版本历史"""
        result = await db.execute(
            select(PlanVersion)
            .where(PlanVersion.plan_id == plan_id)
            .order_by(desc(PlanVersion.version_no))
        )
        versions = result.scalars().all()
        
        history = []
        for v in versions:
            task_count = len(v.content_json.get("tasks", [])) if v.content_json else 0
            
            history.append(VersionInfo(
                version_no=v.version_no,
                created_at=v.created_at,
                confirmed_by_user=v.confirmed_by_user,
                confirmed_at=v.confirmed_at,
                change_summary=v.change_summary or "",
                task_count=task_count,
                is_active=(v.version_no == self._get_plan_current_version(plan_id, versions)),
            ))
        
        return history
    
    def _get_plan_current_version(
        self,
        plan_id: str,
        versions: List[PlanVersion],
    ) -> int:
        """获取计划的当前版本号"""
        if not versions:
            return 0
        # 获取最新的确认版本，如果没有确认的则返回最新版本
        confirmed = [v for v in versions if v.confirmed_by_user]
        if confirmed:
            return confirmed[0].version_no
        return versions[0].version_no
    
    async def rollback_to_version(
        self,
        plan_id: str,
        target_version: int,
        reason: str,
        db: AsyncSession,
    ) -> PlanVersion:
        """
        回滚到指定版本
        
        Args:
            plan_id: 计划ID
            target_version: 目标版本号
            reason: 回滚原因
            db: 数据库会话
        
        Returns:
            PlanVersion: 新的当前版本
        """
        # 检查目标版本是否存在
        result = await db.execute(
            select(PlanVersion)
            .where(PlanVersion.plan_id == plan_id)
            .where(PlanVersion.version_no == target_version)
        )
        target = result.scalar_one_or_none()
        
        if not target:
            raise ResourceNotFoundException(f"版本 {target_version} 不存在")
        
        # 获取计划
        result = await db.execute(
            select(Plan).where(Plan.id == plan_id)
        )
        plan = result.scalar_one_or_none()
        
        if not plan:
            raise ResourceNotFoundException("计划不存在")
        
        # 创建新版本（基于目标版本的复制，但标记为回滚）
        new_version = await self.create_new_version(
            plan_id=plan_id,
            content_md=target.content_md,
            content_json=target.content_json,
            change_summary=f"回滚到版本 {target_version}。原因: {reason}",
            created_by="rollback_service",
            db=db,
        )
        
        # 更新任务状态
        await self._sync_tasks_from_version(plan_id, target, db)
        
        logger.info(
            "plan_version.rollback",
            plan_id=plan_id,
            from_version=plan.current_version,
            to_version=target_version,
            new_version=new_version.version_no,
        )
        
        return new_version
    
    async def _sync_tasks_from_version(
        self,
        plan_id: str,
        version: PlanVersion,
        db: AsyncSession,
    ):
        """从版本同步任务"""
        # 获取版本中的任务
        version_tasks = version.content_json.get("tasks", []) if version.content_json else []
        
        # 删除现有任务
        result = await db.execute(
            select(Task).where(Task.plan_id == plan_id)
        )
        existing_tasks = result.scalars().all()
        
        for task in existing_tasks:
            await db.delete(task)
        
        # 创建新任务
        for task_data in version_tasks:
            task = Task(
                id=str(uuid4()),
                plan_id=plan_id,
                title=task_data.get("title", ""),
                description=task_data.get("description", ""),
                status="pending",
                priority=task_data.get("priority", 1),
            )
            db.add(task)
        
        await db.commit()
    
    async def compare_versions(
        self,
        plan_id: str,
        version_a: int,
        version_b: int,
        db: AsyncSession,
    ) -> VersionComparison:
        """
        比较两个版本
        
        Args:
            plan_id: 计划ID
            version_a: 版本A
            version_b: 版本B
        
        Returns:
            VersionComparison: 比较结果
        """
        # 获取两个版本
        result = await db.execute(
            select(PlanVersion)
            .where(PlanVersion.plan_id == plan_id)
            .where(PlanVersion.version_no.in_([version_a, version_b]))
        )
        versions = result.scalars().all()
        
        version_map = {v.version_no: v for v in versions}
        
        if version_a not in version_map or version_b not in version_map:
            raise ResourceNotFoundException("指定的版本不存在")
        
        v_a = version_map[version_a]
        v_b = version_map[version_b]
        
        # 提取任务
        tasks_a = {t.get("title", ""): t for t in (v_a.content_json or {}).get("tasks", [])}
        tasks_b = {t.get("title", ""): t for t in (v_b.content_json or {}).get("tasks", [])}
        
        # 比较
        added = [t for t in tasks_b if t not in tasks_a]
        removed = [t for t in tasks_a if t not in tasks_b]
        
        modified = []
        for title in tasks_a:
            if title in tasks_b:
                task_a = tasks_a[title]
                task_b = tasks_b[title]
                
                changes = []
                if task_a.get("description") != task_b.get("description"):
                    changes.append("描述")
                if task_a.get("priority") != task_b.get("priority"):
                    changes.append("优先级")
                if task_a.get("estimated_hours") != task_b.get("estimated_hours"):
                    changes.append("预估时间")
                
                if changes:
                    modified.append({
                        "title": title,
                        "changes": changes,
                    })
        
        # 生成摘要
        summary_parts = []
        if added:
            summary_parts.append(f"新增 {len(added)} 个任务")
        if removed:
            summary_parts.append(f"删除 {len(removed)} 个任务")
        if modified:
            summary_parts.append(f"修改 {len(modified)} 个任务")
        
        summary = "，".join(summary_parts) if summary_parts else "无变化"
        
        return VersionComparison(
            version_a=version_a,
            version_b=version_b,
            added_tasks=added,
            removed_tasks=removed,
            modified_tasks=modified,
            summary=summary,
        )
    
    async def cleanup_old_versions(
        self,
        plan_id: str,
        db: AsyncSession,
        keep_count: int = None,
    ):
        """
        清理旧版本
        
        Args:
            plan_id: 计划ID
            keep_count: 保留的版本数（默认MAX_VERSIONS_TO_KEEP）
            db: 数据库会话
        """
        keep_count = keep_count or self.MAX_VERSIONS_TO_KEEP
        
        # 获取所有版本，按版本号降序
        result = await db.execute(
            select(PlanVersion)
            .where(PlanVersion.plan_id == plan_id)
            .order_by(desc(PlanVersion.version_no))
        )
        versions = result.scalars().all()
        
        if len(versions) <= keep_count:
            return
        
        # 保留最新的keep_count个版本
        versions_to_delete = versions[keep_count:]
        
        for version in versions_to_delete:
            # 如果版本已确认，谨慎删除
            if version.confirmed_by_user:
                continue
            
            await db.delete(version)
        
        await db.commit()
        
        logger.info(
            "plan_version.cleanup",
            plan_id=plan_id,
            deleted_count=len(versions_to_delete),
            remaining=min(len(versions), keep_count),
        )
    
    async def get_version_details(
        self,
        plan_id: str,
        version_no: int,
        db: AsyncSession,
    ) -> Optional[Dict[str, Any]]:
        """获取版本详情"""
        result = await db.execute(
            select(PlanVersion)
            .where(PlanVersion.plan_id == plan_id)
            .where(PlanVersion.version_no == version_no)
        )
        version = result.scalar_one_or_none()
        
        if not version:
            return None
        
        return {
            "version_no": version.version_no,
            "created_at": version.created_at.isoformat(),
            "confirmed_by_user": version.confirmed_by_user,
            "confirmed_at": version.confirmed_at.isoformat() if version.confirmed_at else None,
            "change_summary": version.change_summary,
            "content_md": version.content_md,
            "content_json": version.content_json,
            "created_by": version.created_by_agent,
        }
    
    async def confirm_version(
        self,
        plan_id: str,
        version_no: int,
        db: AsyncSession,
    ):
        """确认版本"""
        result = await db.execute(
            select(PlanVersion)
            .where(PlanVersion.plan_id == plan_id)
            .where(PlanVersion.version_no == version_no)
        )
        version = result.scalar_one_or_none()
        
        if not version:
            raise ResourceNotFoundException(f"版本 {version_no} 不存在")
        
        version.confirmed_by_user = True
        version.confirmed_at = datetime.now()
        
        # 更新计划状态
        result = await db.execute(
            select(Plan).where(Plan.id == plan_id)
        )
        plan = result.scalar_one_or_none()
        
        if plan:
            plan.status = PlanStatus.CONFIRMED.value
        
        await db.commit()
        
        logger.info("plan_version.confirmed", plan_id=plan_id, version_no=version_no)


# 全局服务实例
_version_manager: Optional[PlanVersionManager] = None


def get_plan_version_manager() -> PlanVersionManager:
    """获取版本管理器单例"""
    global _version_manager
    if _version_manager is None:
        _version_manager = PlanVersionManager()
    return _version_manager
