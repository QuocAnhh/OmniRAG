from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_async, get_async_db
from app.db.mongodb import get_mongodb
from app.models.user import User
from app.models.bot import Bot

router = APIRouter()


async def _get_tenant_bot_ids(db: AsyncSession, tenant_id) -> tuple[list[str], dict[str, str], dict[str, dict]]:
    """Fetch tenant bots once, return (bot_ids, bot_name_map, bot_detail_map)."""
    result = await db.execute(select(Bot).where(Bot.tenant_id == tenant_id))
    bots = result.scalars().all()
    bot_ids = [str(bot.id) for bot in bots]
    bot_map = {str(bot.id): bot.name for bot in bots}
    bot_detail = {str(bot.id): {"name": bot.name, "is_active": bot.is_active} for bot in bots}
    return bot_ids, bot_map, bot_detail


@router.get("/stats")
async def get_analytics_stats(
    current_user: User = Depends(get_current_user_async),
    db: AsyncSession = Depends(get_async_db),
):
    mongo_db = await get_mongodb()
    conversations_collection = mongo_db.conversations

    bot_ids, _, _ = await _get_tenant_bot_ids(db, current_user.tenant_id)

    total_messages = await conversations_collection.count_documents({
        "bot_id": {"$in": bot_ids}
    })

    recent_convs = await conversations_collection.find(
        {"bot_id": {"$in": bot_ids}, "response_time": {"$exists": True}},
        {"response_time": 1}
    ).limit(100).to_list(100)

    avg_response_time = 0
    if recent_convs:
        avg_response_time = sum(c.get("response_time", 0) for c in recent_convs) / len(recent_convs)

    unique_users_pipeline = [
        {"$match": {"bot_id": {"$in": bot_ids}}},
        {"$group": {"_id": "$session_id"}},
        {"$count": "total"}
    ]
    unique_users_result = await conversations_collection.aggregate(unique_users_pipeline).to_list(1)
    active_users = unique_users_result[0]["total"] if unique_users_result else 0

    avg_csat = await conversations_collection.aggregate([
        {"$match": {"bot_id": {"$in": bot_ids}, "satisfaction_score": {"$exists": True}}},
        {"$group": {"_id": None, "avg_score": {"$avg": "$satisfaction_score"}}}
    ]).to_list(1)

    avg_csat_score = round(avg_csat[0]["avg_score"], 1) if avg_csat else 4.5

    return {
        "total_messages": total_messages,
        "avg_response_time": f"{avg_response_time:.1f}s",
        "active_users": active_users,
        "avg_csat_score": avg_csat_score
    }


@router.get("/conversations")
async def get_recent_conversations(
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(get_current_user_async),
    db: AsyncSession = Depends(get_async_db),
):
    mongo_db = await get_mongodb()
    conversations_collection = mongo_db.conversations

    bot_ids, bot_map, _ = await _get_tenant_bot_ids(db, current_user.tenant_id)

    conversations = await conversations_collection.find(
        {"bot_id": {"$in": bot_ids}},
        {
            "bot_id": 1, "session_id": 1, "user_message": 1,
            "response": 1, "timestamp": 1, "response_time": 1, "satisfaction_score": 1
        }
    ).sort("timestamp", -1).limit(limit).to_list(limit)

    result = []
    for conv in conversations:
        result.append({
            "id": str(conv["_id"]),
            "bot_id": conv.get("bot_id"),
            "bot_name": bot_map.get(conv.get("bot_id"), "Unknown"),
            "session_id": conv.get("session_id", ""),
            "user_message": conv.get("user_message", "")[:100],
            "response": conv.get("response", "")[:100],
            "timestamp": conv.get("timestamp"),
            "response_time": conv.get("response_time"),
            "satisfaction_score": conv.get("satisfaction_score")
        })

    return result


@router.get("/messages-over-time")
async def get_messages_over_time(
    period: str = Query("30d", regex="^[0-9]+(d|h)$"),
    current_user: User = Depends(get_current_user_async),
    db: AsyncSession = Depends(get_async_db),
):
    mongo_db = await get_mongodb()
    conversations_collection = mongo_db.conversations

    if period.endswith('d'):
        days = int(period[:-1])
        start_date = datetime.utcnow() - timedelta(days=days)
        group_format = "%Y-%m-%d"
    elif period.endswith('h'):
        hours = int(period[:-1])
        start_date = datetime.utcnow() - timedelta(hours=hours)
        group_format = "%Y-%m-%d %H:00"
    else:
        start_date = datetime.utcnow() - timedelta(days=30)
        group_format = "%Y-%m-%d"

    bot_ids, _, _ = await _get_tenant_bot_ids(db, current_user.tenant_id)

    pipeline = [
        {"$match": {"bot_id": {"$in": bot_ids}, "timestamp": {"$gte": start_date}}},
        {"$group": {"_id": {"$dateToString": {"format": group_format, "date": "$timestamp"}}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]

    results = await conversations_collection.aggregate(pipeline).to_list(None)

    return [{"date": r["_id"], "count": r["count"]} for r in results]


@router.get("/bot-usage")
async def get_bot_usage_stats(
    current_user: User = Depends(get_current_user_async),
    db: AsyncSession = Depends(get_async_db),
):
    mongo_db = await get_mongodb()
    conversations_collection = mongo_db.conversations

    bot_ids, _, bot_detail = await _get_tenant_bot_ids(db, current_user.tenant_id)

    pipeline = [
        {"$match": {"bot_id": {"$in": bot_ids}}},
        {"$group": {
            "_id": "$bot_id",
            "message_count": {"$sum": 1},
            "avg_response_time": {"$avg": "$response_time"},
            "unique_sessions": {"$addToSet": "$session_id"}
        }}
    ]

    results = await conversations_collection.aggregate(pipeline).to_list(None)

    return [
        {
            "bot_id": r["_id"],
            "bot_name": bot_detail.get(r["_id"], {}).get("name", "Unknown"),
            "is_active": bot_detail.get(r["_id"], {}).get("is_active", False),
            "message_count": r["message_count"],
            "avg_response_time": round(r.get("avg_response_time", 0), 2),
            "unique_sessions": len(r.get("unique_sessions", []))
        }
        for r in results
    ]


@router.get("/top-queries")
async def get_top_queries(
    limit: int = 10,
    current_user: User = Depends(get_current_user_async),
    db: AsyncSession = Depends(get_async_db),
):
    mongo_db = await get_mongodb()
    conversations_collection = mongo_db.conversations

    bot_ids, _, _ = await _get_tenant_bot_ids(db, current_user.tenant_id)

    pipeline = [
        {"$match": {"bot_id": {"$in": bot_ids}}},
        {"$group": {"_id": "$user_message", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": limit}
    ]

    results = await conversations_collection.aggregate(pipeline).to_list(limit)

    return [{"query": r["_id"], "count": r["count"]} for r in results]


@router.get("/response-time-distribution")
async def get_response_time_distribution(
    current_user: User = Depends(get_current_user_async),
    db: AsyncSession = Depends(get_async_db),
):
    mongo_db = await get_mongodb()
    conversations_collection = mongo_db.conversations

    bot_ids, _, _ = await _get_tenant_bot_ids(db, current_user.tenant_id)

    pipeline = [
        {"$match": {"bot_id": {"$in": bot_ids}, "response_time": {"$exists": True}}},
        {"$bucket": {
            "groupBy": "$response_time",
            "boundaries": [0, 0.5, 1.0, 1.5, 2.0, 3.0, 5.0, 10.0],
            "default": "10.0+",
            "output": {"count": {"$sum": 1}}
        }}
    ]

    results = await conversations_collection.aggregate(pipeline).to_list(None)

    labels = {0.0: "<0.5s", 0.5: "0.5-1s", 1.0: "1-1.5s", 1.5: "1.5-2s", 2.0: "2-3s", 3.0: "3-5s", 5.0: "5-10s", "10.0+": ">10s"}
    result_map = {r["_id"]: r["count"] for r in results}

    return [
        {"range": labels.get(b, str(b)), "count": result_map.get(b, 0)}
        for b in [0.0, 0.5, 1.0, 1.5, 2.0, 3.0, 5.0, "10.0+"]
    ]
