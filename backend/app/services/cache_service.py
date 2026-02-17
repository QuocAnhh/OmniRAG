from typing import Optional, Any
import json
import hashlib
from app.db.redis import get_redis

class CacheService:
    def __init__(self):
        pass  # Redis client is accessed via dependency/global

    @property
    def redis(self):
        return get_redis()

    def _generate_key(self, prefix: str, data: Any) -> str:
        """Generate a unique cache key based on data content."""
        if isinstance(data, (dict, list)):
            data_str = json.dumps(data, sort_keys=True)
        else:
            data_str = str(data)
        
        hash_obj = hashlib.md5(data_str.encode())
        return f"{prefix}:{hash_obj.hexdigest()}"

    async def get(self, prefix: str, key_data: Any) -> Optional[Any]:
        """Retrieve data from cache."""
        key = self._generate_key(prefix, key_data)
        data = await self.redis.get(key)
        if data:
            return json.loads(data)
        return None

    async def set(self, prefix: str, key_data: Any, value: Any, ttl: int = 3600):
        """Set data in cache with TTL (default 1 hour)."""
        key = self._generate_key(prefix, key_data)
        await self.redis.set(key, json.dumps(value), ex=ttl)

    async def delete(self, prefix: str, key_data: Any):
        """Delete data from cache."""
        key = self._generate_key(prefix, key_data)
        await self.redis.delete(key)


    async def clear_prefix(self, prefix: str):
        """Clear all keys with specific prefix (Scan & Delete)."""
        redis = await self.get_redis()
        pattern = f"{prefix}:*"
        keys = []
        async for key in redis.scan_iter(match=pattern):
            keys.append(key)
        if keys:
            await redis.delete(*keys)

cache_service = CacheService()
