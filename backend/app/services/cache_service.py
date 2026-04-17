from typing import Optional, Any, Callable, Awaitable
import json
import hashlib
import asyncio
import structlog
import msgpack
from app.db.redis import get_redis
from app.core.metrics import CACHE_HITS, CACHE_MISSES

logger = structlog.get_logger()


class CacheService:
    """Async Redis cache with singleflight protection and binary support."""

    def __init__(self):
        pass

    @property
    def redis(self):
        return get_redis()

    def _generate_key(self, prefix: str, data: Any) -> str:
        if isinstance(data, (dict, list)):
            data_str = json.dumps(data, sort_keys=True)
        else:
            data_str = str(data)
        hash_obj = hashlib.sha256(data_str.encode())
        return f"{prefix}:{hash_obj.hexdigest()}"

    # ── Basic get/set/delete ───────────────────────────────────────────────

    async def get(self, prefix: str, key_data: Any) -> Optional[Any]:
        key = self._generate_key(prefix, key_data)
        data = await self.redis.get(key)
        if data:
            CACHE_HITS.labels(prefix=prefix).inc()
            return json.loads(data)
        CACHE_MISSES.labels(prefix=prefix).inc()
        return None

    async def set(self, prefix: str, key_data: Any, value: Any, ttl: int = 3600):
        key = self._generate_key(prefix, key_data)
        await self.redis.set(key, json.dumps(value), ex=ttl)

    async def delete(self, prefix: str, key_data: Any):
        key = self._generate_key(prefix, key_data)
        await self.redis.delete(key)

    # ── Singleflight get_or_set ────────────────────────────────────────────
    # Prevents dogpile / cache-stampede: only one caller computes the value,
    # others wait and reuse. Lock via SET NX EX on a separate key.

    async def get_or_set(
        self,
        prefix: str,
        key_data: Any,
        loader: Callable[[], Awaitable[Any]],
        ttl: int = 3600,
        lock_ttl: int = 15,
    ) -> Any:
        """Get from cache, or compute via loader with singleflight protection."""
        key = self._generate_key(prefix, key_data)
        redis = self.redis

        # Fast path: cache hit
        data = await redis.get(key)
        if data is not None:
            CACHE_HITS.labels(prefix=prefix).inc()
            return json.loads(data)

        # Slow path: acquire lock
        lock_key = f"{key}:lock"
        acquired = await redis.set(lock_key, "1", nx=True, ex=lock_ttl)
        if acquired:
            try:
                value = await loader()
                await redis.set(key, json.dumps(value), ex=ttl)
                CACHE_MISSES.labels(prefix=prefix).inc()
                return value
            finally:
                await redis.delete(lock_key)
        else:
            # Another caller is computing — poll until value appears or lock expires
            for _ in range(lock_ttl * 4):
                await asyncio.sleep(0.25)
                data = await redis.get(key)
                if data is not None:
                    CACHE_HITS.labels(prefix=prefix).inc()
                    return json.loads(data)
            # Fallback: compute ourselves if lock expired without value
            CACHE_MISSES.labels(prefix=prefix).inc()
            return await loader()

    # ── Binary (msgpack) for embedding vectors ─────────────────────────────

    async def get_binary(self, prefix: str, key_data: Any) -> Optional[bytes]:
        key = self._generate_key(prefix, key_data)
        data = await self.redis.get(key)
        if data is not None:
            CACHE_HITS.labels(prefix=prefix).inc()
            return msgpack.unpackb(data, raw=False) if isinstance(data, bytes) else data
        CACHE_MISSES.labels(prefix=prefix).inc()
        return None

    async def set_binary(self, prefix: str, key_data: Any, value: Any, ttl: int = 3600):
        key = self._generate_key(prefix, key_data)
        await self.redis.set(key, msgpack.packb(value, use_bin_type=True), ex=ttl)

    # ── Prefix scan & clear ────────────────────────────────────────────────

    async def clear_prefix(self, prefix: str):
        redis = self.redis
        pattern = f"{prefix}:*"
        keys = []
        async for key in redis.scan_iter(match=pattern):
            keys.append(key)
        if keys:
            await redis.delete(*keys)


cache_service = CacheService()
