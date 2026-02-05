from datetime import datetime, timedelta
from typing import Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import get_current_user, get_db
from app.db.mongodb import get_mongodb
from app.db.redis import get_redis
from app.models.user import User
from app.models.bot import Bot
from app.models.document import Document
import json

router = APIRouter()

CACHE_TTL = 300  # 5 minutes cache


@router.get("/stats")
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get real-time dashboard statistics with Redis caching.
    Returns: total_bots, active_sessions, messages_today, avg_response_time
    """
    redis = await get_redis()
    cache_key = f"dashboard:stats:{current_user.tenant_id}"
    
    # Try to get from cache
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # Calculate fresh stats
    mongo_db = await get_mongodb()
    conversations_collection = mongo_db.conversations
    
    # Total bots for this tenant
    total_bots = db.query(func.count(Bot.id)).filter(
        Bot.tenant_id == current_user.tenant_id
    ).scalar()
    
    # Get tenant's bot IDs
    bots = db.query(Bot).filter(Bot.tenant_id == current_user.tenant_id).all()
    bot_ids = [str(bot.id) for bot in bots]
    
    # Active sessions in last 24 hours (unique session_ids)
    yesterday = datetime.utcnow() - timedelta(days=1)
    active_sessions_pipeline = [
        {
            "$match": {
                "bot_id": {"$in": bot_ids},
                "timestamp": {"$gte": yesterday}
            }
        },
        {
            "$group": {
                "_id": "$session_id"
            }
        },
        {
            "$count": "total"
        }
    ]
    active_sessions_result = await conversations_collection.aggregate(
        active_sessions_pipeline
    ).to_list(1)
    active_sessions = active_sessions_result[0]["total"] if active_sessions_result else 0
    
    # Messages today
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    messages_today = await conversations_collection.count_documents({
        "bot_id": {"$in": bot_ids},
        "timestamp": {"$gte": today_start}
    })
    
    # Average response time (last 100 messages)
    recent_messages = await conversations_collection.find(
        {
            "bot_id": {"$in": bot_ids},
            "response_time": {"$exists": True}
        },
        {"response_time": 1}
    ).sort("timestamp", -1).limit(100).to_list(100)
    
    avg_response_time = 0
    if recent_messages:
        avg_response_time = sum(m.get("response_time", 0) for m in recent_messages) / len(recent_messages)
    
    result = {
        "total_bots": total_bots,
        "active_sessions": active_sessions,
        "messages_today": messages_today,
        "avg_response_time": f"{avg_response_time:.1f}s"
    }
    
    # Cache the result
    await redis.setex(cache_key, CACHE_TTL, json.dumps(result))
    
    return result


@router.get("/activity")
async def get_dashboard_activity(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get recent activity feed for dashboard.
    """
    mongo_db = await get_mongodb()
    conversations_collection = mongo_db.conversations
    
    # Get tenant's bots
    bots = db.query(Bot).filter(Bot.tenant_id == current_user.tenant_id).all()
    bot_ids = [str(bot.id) for bot in bots]
    bot_map = {str(bot.id): bot.name for bot in bots}
    
    # Get recent activity
    recent_activity = await conversations_collection.find(
        {"bot_id": {"$in": bot_ids}},
        {
            "bot_id": 1,
            "session_id": 1,
            "user_message": 1,
            "timestamp": 1
        }
    ).sort("timestamp", -1).limit(10).to_list(10)
    
    return [
        {
            "id": str(activity["_id"]),
            "bot_name": bot_map.get(activity.get("bot_id"), "Unknown"),
            "message": activity.get("user_message", "")[:50] + "...",
            "timestamp": activity.get("timestamp"),
            "type": "chat"
        }
        for activity in recent_activity
    ]


@router.get("/quick-stats")
async def get_quick_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get quick stats for dashboard cards (documents, active bots, etc.)
    """
    # Total documents
    total_documents = db.query(func.count(Document.id)).join(Bot).filter(
        Bot.tenant_id == current_user.tenant_id
    ).scalar()
    
    # Active bots
    active_bots = db.query(func.count(Bot.id)).filter(
        Bot.tenant_id == current_user.tenant_id,
        Bot.is_active == True
    ).scalar()
    
    # Processing documents
    processing_docs = db.query(func.count(Document.id)).join(Bot).filter(
        Bot.tenant_id == current_user.tenant_id,
        Document.status.in_(['pending', 'processing'])
    ).scalar()
    
    return {
        "total_documents": total_documents or 0,
        "active_bots": active_bots or 0,
        "processing_documents": processing_docs or 0
    }
