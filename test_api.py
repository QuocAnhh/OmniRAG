import asyncio
import httpx

async def main():
    async with httpx.AsyncClient() as client:
        # No auth token here, so we will fail... Wait, I need the actual user token!
        pass

asyncio.run(main())
