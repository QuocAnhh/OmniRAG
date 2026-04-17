"""Async facade over sync QdrantClient.

Wraps all Qdrant calls in `asyncio.to_thread` with a bounded semaphore
to prevent thread-pool starvation under burst load. When AsyncQdrantClient
reaches feature parity, swap this module to use it directly — no other file
needs to change.
"""
import asyncio
import structlog
from app.core.config import settings

logger = structlog.get_logger()

_semaphore = asyncio.Semaphore(32)


class QdrantGateway:
    def __init__(self):
        from qdrant_client import QdrantClient
        self._client = QdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT)

    @property
    def sync_client(self):
        """Access the underlying sync client for non-async contexts (Celery tasks)."""
        return self._client

    async def upsert(self, collection_name: str, points: list, **kwargs):
        async with _semaphore:
            return await asyncio.to_thread(
                self._client.upsert, collection_name, points, **kwargs
            )

    async def search(self, collection_name: str, query_vector: list, **kwargs):
        async with _semaphore:
            return await asyncio.to_thread(
                self._client.search, collection_name, query_vector, **kwargs
            )

    async def scroll(self, collection_name: str, **kwargs):
        async with _semaphore:
            return await asyncio.to_thread(
                self._client.scroll, collection_name, **kwargs
            )

    async def query_points(self, collection_name: str, **kwargs):
        async with _semaphore:
            return await asyncio.to_thread(
                self._client.query_points, collection_name, **kwargs
            )

    async def get_collection(self, collection_name: str):
        async with _semaphore:
            return await asyncio.to_thread(
                self._client.get_collection, collection_name
            )

    async def create_collection(self, collection_name: str, **kwargs):
        return await asyncio.to_thread(
            self._client.create_collection, collection_name, **kwargs
        )

    async def update_collection(self, collection_name: str, **kwargs):
        return await asyncio.to_thread(
            self._client.update_collection, collection_name, **kwargs
        )

    async def delete(self, collection_name: str, points_selector, **kwargs):
        async with _semaphore:
            return await asyncio.to_thread(
                self._client.delete, collection_name, points_selector, **kwargs
            )


_gateway: QdrantGateway | None = None


def get_qdrant_gateway() -> QdrantGateway:
    global _gateway
    if _gateway is None:
        _gateway = QdrantGateway()
    return _gateway
