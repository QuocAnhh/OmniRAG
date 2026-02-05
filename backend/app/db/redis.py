import redis.asyncio as redis
from app.core.config import settings

class RedisClient:
    client: redis.Redis = None

redis_client = RedisClient()


async def connect_to_redis():
    """Connect to Redis"""
    redis_client.client = await redis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True
    )
    print(f"Connected to Redis at {settings.REDIS_URL}")


async def close_redis_connection():
    """Close Redis connection"""
    if redis_client.client:
        await redis_client.client.close()
        print("Closed Redis connection")


def get_redis() -> redis.Redis:
    """Get Redis client"""
    return redis_client.client
