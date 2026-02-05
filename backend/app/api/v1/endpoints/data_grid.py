from typing import Any, List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.models.user import User
from app.models.tenant import Tenant
from app.models.bot import Bot
from app.models.document import Document
from app.db.mongodb import get_database
from app.db.redis import get_redis
from app.core.config import settings
from qdrant_client import QdrantClient

router = APIRouter()


def paginate(query, db: Session, limit: int, offset: int):
    total = query.count()
    items = query.offset(offset).limit(limit).all()
    return {"total": total, "items": items}


# --- PostgreSQL (SQLAlchemy) ---
@router.get("/postgres/users")
def list_users(db: Session = Depends(get_db), limit: int = 50, offset: int = 0):
    return paginate(db.query(User), db, limit, offset)


@router.get("/postgres/tenants")
def list_tenants(db: Session = Depends(get_db), limit: int = 50, offset: int = 0):
    return paginate(db.query(Tenant), db, limit, offset)


@router.get("/postgres/bots")
def list_bots(db: Session = Depends(get_db), limit: int = 50, offset: int = 0, tenant_id: Optional[str] = None):
    query = db.query(Bot)
    if tenant_id:
        try:
            tenant_uuid = UUID(tenant_id)
            query = query.filter(Bot.tenant_id == tenant_uuid)
        except ValueError:
            return {"total": 0, "items": []}
    return paginate(query, db, limit, offset)


@router.get("/postgres/documents")
def list_documents(db: Session = Depends(get_db), limit: int = 50, offset: int = 0, bot_id: Optional[str] = None):
    query = db.query(Document)
    if bot_id:
        try:
            bot_uuid = UUID(bot_id)
            query = query.filter(Document.bot_id == bot_uuid)
        except ValueError:
            return {"total": 0, "items": []}
    return paginate(query, db, limit, offset)


# --- MongoDB ---
@router.get("/mongo/collections")
async def mongo_collections():
    db = get_database()
    names = await db.list_collection_names()
    results = []
    for name in names:
        coll = db.get_collection(name)
        count = await coll.estimated_document_count()
        sample = await coll.find().limit(3).to_list(length=3)
        results.append({"name": name, "count": count, "sample": sample})
    return {"collections": results}


# --- Redis ---
@router.get("/redis/keys")
async def redis_keys(pattern: str = Query("*"), max_items: int = 100):
    client = get_redis()
    keys: List[str] = []
    async for key in client.scan_iter(match=pattern):
        keys.append(key)
        if len(keys) >= max_items:
            break
    items = []
    for k in keys:
        ttl = await client.ttl(k)
        val = await client.get(k)
        items.append({"key": k, "ttl": ttl, "value": val})
    return {"items": items, "count": len(items)}


# --- Qdrant ---
@router.get("/qdrant/collections")
def qdrant_collections():
    client = QdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT)
    cols = client.get_collections().collections
    data = []
    for c in cols:
        # count points (may be heavy; use without filter)
        try:
            cnt = client.count(c.name).count
        except Exception:
            cnt = None
        data.append({"name": c.name, "points_count": cnt})
    return {"collections": data}
