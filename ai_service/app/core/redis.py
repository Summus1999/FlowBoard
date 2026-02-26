"""
In-memory cache (replaces Redis for lightweight local mode)
TTL-based dict cache, suitable for single-process desktop usage
"""

import json
import time
from typing import Any, Optional

from app.core.logging import get_logger

logger = get_logger(__name__)


class _MemoryStore:
    """Simple in-memory key-value store with TTL support."""

    def __init__(self):
        self._data: dict[str, tuple[Any, float | None]] = {}

    def _is_expired(self, key: str) -> bool:
        if key not in self._data:
            return True
        _, expires_at = self._data[key]
        if expires_at is not None and time.time() > expires_at:
            del self._data[key]
            return True
        return False

    async def get(self, key: str) -> Optional[str]:
        if self._is_expired(key):
            return None
        value, _ = self._data[key]
        return value

    async def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        expires_at = (time.time() + ex) if ex else None
        self._data[key] = (value, expires_at)
        return True

    async def delete(self, key: str) -> int:
        if key in self._data:
            del self._data[key]
            return 1
        return 0

    async def exists(self, key: str) -> int:
        return 0 if self._is_expired(key) else 1

    async def expire(self, key: str, seconds: int) -> bool:
        if key in self._data:
            value, _ = self._data[key]
            self._data[key] = (value, time.time() + seconds)
            return True
        return False


_store = _MemoryStore()


async def init_redis():
    """No-op: in-memory store needs no initialization."""
    logger.info("cache.memory_store_ready")
    return _store


async def get_redis():
    """Return the in-memory store (same interface as aioredis.Redis)."""
    return _store


async def close_redis():
    """No-op."""
    pass


class RedisCache:
    """Cache wrapper (same API as before, backed by in-memory store)."""
    
    def __init__(self, prefix: str = "fb"):
        self.prefix = prefix
    
    def _key(self, key: str) -> str:
        return f"{self.prefix}:{key}"
    
    async def get(self, key: str) -> Optional[Any]:
        value = await _store.get(self._key(key))
        if value:
            try:
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                return value
        return None
    
    async def set(self, key: str, value: Any, expire: Optional[int] = None) -> bool:
        if not isinstance(value, (str, bytes)):
            value = json.dumps(value, ensure_ascii=False)
        return await _store.set(self._key(key), value, ex=expire)
    
    async def delete(self, key: str) -> bool:
        return (await _store.delete(self._key(key))) > 0
    
    async def exists(self, key: str) -> bool:
        return (await _store.exists(self._key(key))) > 0
    
    async def expire(self, key: str, seconds: int) -> bool:
        return await _store.expire(self._key(key), seconds)
    
    async def get_or_set(self, key: str, factory, expire: Optional[int] = None) -> Any:
        value = await self.get(key)
        if value is None:
            value = await factory()
            if value is not None:
                await self.set(key, value, expire)
        return value


cache = RedisCache()
