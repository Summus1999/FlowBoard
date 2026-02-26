"""
Database connection management (SQLite)
Supports sync and async operations
"""

from contextlib import asynccontextmanager, contextmanager
from typing import AsyncGenerator, Generator

from sqlalchemy import create_engine, Engine, event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
    AsyncEngine,
)
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.logging import get_logger
from app.models.base import Base

logger = get_logger(__name__)

_engine: Engine | None = None
_async_engine: AsyncEngine | None = None
_SessionLocal: sessionmaker | None = None
_AsyncSessionLocal: async_sessionmaker | None = None

# Re-export for backward compatibility
engine = None


def _enable_sqlite_fk(dbapi_conn, connection_record):
    """Enable foreign key support in SQLite."""
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()


def init_db():
    global _engine, _async_engine, _SessionLocal, _AsyncSessionLocal, engine

    db_url = settings.get_database_url()
    async_db_url = settings.get_async_database_url()

    _engine = create_engine(db_url, echo=settings.DEBUG)
    event.listen(_engine, "connect", _enable_sqlite_fk)

    _async_engine = create_async_engine(async_db_url, echo=settings.DEBUG)

    _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    _AsyncSessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=_async_engine)

    engine = _async_engine
    logger.info("database.initialized", url=db_url)


def get_engine() -> Engine:
    if _engine is None:
        init_db()
    return _engine


def get_async_engine() -> AsyncEngine:
    if _async_engine is None:
        init_db()
    return _async_engine


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    if _SessionLocal is None:
        init_db()
    session = _SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@asynccontextmanager
async def get_async_db_session() -> AsyncGenerator[AsyncSession, None]:
    if _AsyncSessionLocal is None:
        init_db()
    session = _AsyncSessionLocal()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: async database session"""
    async with get_async_db_session() as session:
        yield session


def create_tables():
    from app.models import session, memory, plan, rag  # noqa: F401
    e = get_engine()
    Base.metadata.create_all(bind=e)
    logger.info("database.tables_created")


async def create_tables_async():
    from app.models import session, memory, plan, rag  # noqa: F401
    e = get_async_engine()
    async with e.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("database.tables_created_async")


def close_db():
    global _engine, _async_engine, engine
    if _engine:
        _engine.dispose()
        _engine = None
    _async_engine = None
    engine = None
    logger.info("database.closed")
