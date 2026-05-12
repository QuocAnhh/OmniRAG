import logging
import redis.asyncio as redis
from app.core.config import settings

logger = logging.getLogger(__name__)

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
    logger.info("redis_connected")


async def close_redis_connection():
    """Close Redis connection"""
    if redis_client.client:
        await redis_client.client.close()
        logger.info("redis_disconnected")


def get_redis() -> redis.Redis:
    """Get Redis client"""
    return redis_client.client
