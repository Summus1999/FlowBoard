"""
Redis连接管理
用于缓存、队列和分布式锁
"""

import json
from typing import Any, Optional, Union

import redis.asyncio as aioredis

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_redis_pool: Optional[aioredis.Redis] = None


async def init_redis() -> aioredis.Redis:
    """初始化Redis连接"""
    global _redis_pool
    
    if _redis_pool is None:
        _redis_pool = aioredis.from_url(
            settings.REDIS_URL,
            password=settings.REDIS_PASSWORD,
            decode_responses=True,
        )
        logger.info("redis.initialized")
    
    return _redis_pool


async def get_redis() -> aioredis.Redis:
    """获取Redis连接"""
    if _redis_pool is None:
        return await init_redis()
    return _redis_pool


async def close_redis():
    """关闭Redis连接"""
    global _redis_pool
    if _redis_pool:
        await _redis_pool.close()
        _redis_pool = None
        logger.info("redis.closed")


class RedisCache:
    """Redis缓存封装"""
    
    def __init__(self, prefix: str = "fb"):
        self.prefix = prefix
    
    def _key(self, key: str) -> str:
        """生成带前缀的key"""
        return f"{self.prefix}:{key}"
    
    async def get(self, key: str) -> Optional[Any]:
        """获取缓存值"""
        r = await get_redis()
        value = await r.get(self._key(key))
        if value:
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value
        return None
    
    async def set(
        self,
        key: str,
        value: Any,
        expire: Optional[int] = None,
    ) -> bool:
        """设置缓存值"""
        r = await get_redis()
        if not isinstance(value, (str, bytes)):
            value = json.dumps(value, ensure_ascii=False)
        
        result = await r.set(self._key(key), value, ex=expire)
        return result
    
    async def delete(self, key: str) -> bool:
        """删除缓存值"""
        r = await get_redis()
        result = await r.delete(self._key(key))
        return result > 0
    
    async def exists(self, key: str) -> bool:
        """检查key是否存在"""
        r = await get_redis()
        return await r.exists(self._key(key)) > 0
    
    async def expire(self, key: str, seconds: int) -> bool:
        """设置过期时间"""
        r = await get_redis()
        return await r.expire(self._key(key), seconds)
    
    async def get_or_set(
        self,
        key: str,
        factory,
        expire: Optional[int] = None,
    ) -> Any:
        """获取或设置缓存"""
        value = await self.get(key)
        if value is None:
            value = await factory()
            if value is not None:
                await self.set(key, value, expire)
        return value


# 全局缓存实例
cache = RedisCache()
