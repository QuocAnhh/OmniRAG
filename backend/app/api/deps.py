from typing import Generator, AsyncGenerator
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import SessionLocal, AsyncSessionLocal
from app.core.config import settings
from app.core.security import ALGORITHM
from app.models.user import User
from app.schemas.user import TokenPayload

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")


# ── Sync deps (used by Celery tasks, legacy endpoints) ────────────────────────

def get_db() -> Generator:
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    """Get current authenticated user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        token_data = TokenPayload(sub=user_id)
    except JWTError:
        raise credentials_exception

    user = db.execute(select(User).where(User.id == token_data.sub)).scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


def get_current_bot(
    bot_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    from app.models.bot import Bot as BotModel
    try:
        bot_uuid = UUID(bot_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid bot ID format")
    bot = db.execute(
        select(BotModel).where(
            BotModel.id == bot_uuid,
            BotModel.tenant_id == current_user.tenant_id,
        )
    ).scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    return bot


# ── Async deps (new — Phase 6) ───────────────────────────────────────────────

async def get_async_db() -> AsyncGenerator:
    async with AsyncSessionLocal() as session:
        yield session


async def get_current_user_async(
    db: AsyncSession = Depends(get_async_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    """Async version of get_current_user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        token_data = TokenPayload(sub=user_id)
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == token_data.sub))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user


async def get_current_active_user_async(
    current_user: User = Depends(get_current_user_async),
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


async def get_current_bot_async(
    bot_id: str,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user_async),
):
    from app.models.bot import Bot as BotModel
    try:
        bot_uuid = UUID(bot_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid bot ID format")
    result = await db.execute(
        select(BotModel).where(
            BotModel.id == bot_uuid,
            BotModel.tenant_id == current_user.tenant_id,
        )
    )
    bot = result.scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    return bot
