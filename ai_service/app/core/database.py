"""
数据库连接管理
支持同步和异步操作
"""

from contextlib import asynccontextmanager, contextmanager
from typing import AsyncGenerator, Generator

from sqlalchemy import create_engine, Engine
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
    AsyncEngine,
)
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# 同步引擎
_engine: Engine | None = None
# 异步引擎
_async_engine: AsyncEngine | None = None
# 会话工厂
_SessionLocal: sessionmaker | None = None
_AsyncSessionLocal: async_sessionmaker | None = None


def init_db():
    """初始化数据库连接"""
    global _engine, _async_engine, _SessionLocal, _AsyncSessionLocal
    
    # 同步引擎
    _engine = create_engine(
        settings.get_database_url(),
        pool_size=settings.DATABASE_POOL_SIZE,
        max_overflow=settings.DATABASE_MAX_OVERFLOW,
        pool_pre_ping=True,
        echo=settings.DEBUG,
    )
    
    # 异步引擎
    _async_engine = create_async_engine(
        settings.get_async_database_url(),
        pool_size=settings.DATABASE_POOL_SIZE,
        max_overflow=settings.DATABASE_MAX_OVERFLOW,
        pool_pre_ping=True,
        echo=settings.DEBUG,
    )
    
    # 会话工厂
    _SessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=_engine,
    )
    
    _AsyncSessionLocal = async_sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=_async_engine,
    )
    
    logger.info("database.initialized")


def get_engine() -> Engine:
    """获取同步引擎"""
    if _engine is None:
        init_db()
    return _engine


def get_async_engine() -> AsyncEngine:
    """获取异步引擎"""
    if _async_engine is None:
        init_db()
    return _async_engine


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    """获取同步数据库会话（上下文管理器）"""
    if _SessionLocal is None:
        init_db()
    
    session = _SessionLocal()
    try:
        yield session
        session.commit()
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()


@asynccontextmanager
async def get_async_db_session() -> AsyncGenerator[AsyncSession, None]:
    """获取异步数据库会话（异步上下文管理器）"""
    if _AsyncSessionLocal is None:
        init_db()
    
    session = _AsyncSessionLocal()
    try:
        yield session
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise e
    finally:
        await session.close()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI依赖：获取数据库会话"""
    async with get_async_db_session() as session:
        yield session


def create_tables():
    """创建所有表（同步）"""
    from app.models.base import Base
    from app.models import session, memory, plan, rag  # noqa: F401
    
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    logger.info("database.tables_created")


async def create_tables_async():
    """创建所有表（异步）"""
    from app.models.base import Base
    from app.models import session, memory, plan, rag  # noqa: F401
    
    engine = get_async_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("database.tables_created_async")


def drop_tables():
    """删除所有表（危险操作！）"""
    from app.models.base import Base
    
    engine = get_engine()
    Base.metadata.drop_all(bind=engine)
    logger.warning("database.tables_dropped")


def close_db():
    """关闭数据库连接"""
    global _engine, _async_engine
    
    if _engine:
        _engine.dispose()
        _engine = None
    
    if _async_engine:
        # 异步引擎在异步上下文中关闭
        _async_engine = None
    
    logger.info("database.closed")
