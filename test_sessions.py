import asyncio
from app.db.mongodb import get_mongodb, connect_to_mongo
from app.api.deps import get_db
from app.services.openrouter_rag_service import get_openrouter_rag_service
from app.models.bot import Bot
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from app.core.config import settings
import sys
import logging

engine = create_engine(settings.SQLALCHEMY_DATABASE_URI)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

async def main():
    await connect_to_mongo()
    db = SessionLocal()
    bot = db.query(Bot).first()
    rag = get_openrouter_rag_service()
    
    bot_id = str(bot.id)
    # Get the user id from Mongo since we know it
    user_id = '3063bb57-c7b0-44aa-a328-92bd50231109'
    
    sessions = await rag.get_sessions(bot_id=bot_id, user_id=user_id)
    print(f"Sessions count: {len(sessions)}")
    for s in sessions:
        print(s)

asyncio.run(main())
