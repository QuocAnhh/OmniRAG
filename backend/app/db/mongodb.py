from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

class MongoDB:
    client: AsyncIOMotorClient = None
    
mongodb = MongoDB()


async def connect_to_mongodb():
    """Connect to MongoDB"""
    mongodb.client = AsyncIOMotorClient(settings.MONGODB_URL)
    print(f"Connected to MongoDB at {settings.MONGODB_URL}")


async def close_mongodb_connection():
    """Close MongoDB connection"""
    if mongodb.client:
        mongodb.client.close()
        print("Closed MongoDB connection")


def get_database():
    """Get MongoDB database"""
    return mongodb.client[settings.MONGODB_DB_NAME]


async def get_mongodb():
    """Get MongoDB database (async version for compatibility)"""
    return mongodb.client[settings.MONGODB_DB_NAME]
