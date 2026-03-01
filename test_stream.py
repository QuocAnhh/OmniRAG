import asyncio
from app.api.deps import get_db
from app.services.openrouter_rag_service import get_openrouter_rag_service
from app.models.bot import Bot
from app.db.session import SessionLocal

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
        print("Error!", repr(e))

asyncio.run(main())
