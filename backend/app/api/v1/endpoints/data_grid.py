from typing import List, Optional, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from qdrant_client import QdrantClient

from app.api import deps
from app.core.config import settings
from app.models.user import User
from app.models.tenant import Tenant
from app.models.bot import Bot
from app.models.document import Document
from app.db.mongodb import get_database
from app.db.redis import get_redis

router = APIRouter()

def paginate(query, db, limit, offset):
    return query.offset(offset).limit(limit).all()

# --- PostgreSQL (SQLAlchemy) ---
@router.get("/postgres/users")
def list_users(db: Session = Depends(deps.get_db), limit: int = 50, offset: int = 0):
    return paginate(db.query(User), db, limit, offset)


@router.get("/postgres/tenants")
def list_tenants(db: Session = Depends(deps.get_db), limit: int = 50, offset: int = 0):
    return paginate(db.query(Tenant), db, limit, offset)


@router.get("/postgres/bots")
def list_bots(db: Session = Depends(deps.get_db), limit: int = 50, offset: int = 0, tenant_id: Optional[str] = None):
    query = db.query(Bot)
    if tenant_id:
        query = query.filter(Bot.tenant_id == tenant_id)
    return paginate(query, db, limit, offset)


@router.get("/postgres/documents")
def list_documents(db: Session = Depends(deps.get_db), limit: int = 50, offset: int = 0, bot_id: Optional[str] = None):
    query = db.query(Document)
    if bot_id:
        query = query.filter(Document.bot_id == bot_id)
    return paginate(query, db, limit, offset)


# --- MongoDB ---
@router.get("/mongo/collections")
async def mongo_collections():
    db = await get_database()
    names = await db.list_collection_names()
    results = []
    for name in names:
        coll = db.get_collection(name)
        count = await coll.estimated_document_count()
        # sample = await coll.find().limit(3).to_list(length=3)
        results.append({"name": name, "count": count})
    return {"collections": results}


# --- Redis ---
@router.get("/redis/keys")
async def redis_keys(pattern: str = Query("*"), max_items: int = 100):
    client = get_redis()
    if not client:
        return {"error": "Redis not connected"}
        
    keys: List[str] = []
    # scan_iter is for synchronous redis, check if we are using async or sync
    # app.db.redis usually returns a sync client or async? 
    # Based on openrouter_rag_service using asyncio.to_thread(client.get), it seems it might be a sync client.
    # But usually in async views we should be careful.
    
    # Let's assume sync client based on other files
    try:
        for key in client.scan_iter(match=pattern, count=100):
            keys.append(key)
            if len(keys) >= max_items:
                break
    except Exception as e:
        # If it's async client, we might need 'async for'
        return {"error": str(e)}

    items = []
    for k in keys:
        try:
            ttl = client.ttl(k)
            val = client.get(k)
            items.append({"key": k, "ttl": ttl, "value": val})
        except:
            pass
            
    return {"items": items, "count": len(items)}


# --- Qdrant ---
@router.get("/qdrant/collections")
def qdrant_collections():
    client = QdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT)
    try:
        cols = client.get_collections().collections
        data = []
        for c in cols:
            try:
                cnt = client.count(c.name).count
            except Exception:
                cnt = None
            data.append({"name": c.name, "points_count": cnt})
        return {"collections": data}
    except Exception as e:
        return {"error": str(e)}
