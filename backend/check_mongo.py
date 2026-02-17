import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

async def check():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    
    print("--- Conversations ---")
    async for conv in db.conversations.find().sort("timestamp", -1).limit(5):
        print(f"ID: {conv.get('_id')}, Session: {conv.get('session_id')}, UserMsg: {conv.get('user_message')[:30]}...")
        
    print("\n--- Sessions ---")
    async for sess in db.sessions.find().limit(5):
        print(f"ID: {sess.get('session_id')}, Title: {sess.get('title')}")

if __name__ == '__main__':
    asyncio.run(check())
