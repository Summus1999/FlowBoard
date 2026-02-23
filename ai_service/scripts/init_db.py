"""
数据库初始化脚本
创建表结构和初始数据
"""

import asyncio
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import init_db, create_tables, close_db
from app.core.logging import setup_logging, get_logger

setup_logging()
logger = get_logger(__name__)


def init_database():
    """初始化数据库"""
    logger.info("init_db.starting")
    
    try:
        # 初始化连接
        init_db()
        
        # 创建表
        create_tables()
        
        logger.info("init_db.completed")
        
    except Exception as e:
        logger.error("init_db.failed", error=str(e))
        raise
    finally:
        close_db()


async def init_database_async():
    """异步初始化数据库"""
    from app.core.database import create_tables_async
    
    logger.info("init_db.async_starting")
    
    try:
        init_db()
        await create_tables_async()
        logger.info("init_db.async_completed")
    except Exception as e:
        logger.error("init_db.async_failed", error=str(e))
        raise


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Initialize database")
    parser.add_argument("--async", action="store_true", help="Use async mode")
    args = parser.parse_args()
    
    if args.async_mode:
        asyncio.run(init_database_async())
    else:
        init_database()
