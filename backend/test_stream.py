import asyncio
import os
import sys

# Define path for backend
sys.path.append("/Users/nguyenquocanh/BIVA/OmniRAG/backend")
from app.api.deps import get_db
from app.services.openrouter_rag_service import get_openrouter_rag_service
from app.models.bot import Bot
import json

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

engine = create_engine(settings.SQLALCHEMY_DATABASE_URI)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

async def main():
    db = SessionLocal()
    bot = db.query(Bot).first()
    if not bot:
        print("No bot found!")
        return
    
    rag = get_openrouter_rag_service()
    
    print(f"Testing bot: {bot.id}")
    try:
        async for chunk in rag.chat_stream(
            bot_id=str(bot.id),
            query="Hello",
            bot_config=bot.config or {}
        ):
            print("Received:", chunk)
    except Exception as e:
        import traceback
        traceback.print_exc()

asyncio.run(main())
