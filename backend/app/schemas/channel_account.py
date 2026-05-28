from pydantic import BaseModel, UUID4, Field
from typing import Optional, Any
from datetime import datetime


class ChannelAccountCreate(BaseModel):
    channel_type: str = Field(pattern="^(zalo_personal|facebook_messenger)$")
    reply_policy: str = Field(default="mention_only", pattern="^(mention_only|all)$")
    thread_whitelist: Optional[list[str]] = None


class ChannelAccountUpdate(BaseModel):
    reply_policy: Optional[str] = Field(default=None, pattern="^(mention_only|all)$")
    thread_whitelist: Optional[list[str]] = None


class RateLimitInfo(BaseModel):
    daily_count: int = 0
    daily_limit: int = 200


class CircuitBreakerInfo(BaseModel):
    disconnect_tripped: bool = False
    backend_down: bool = False


class ChannelAccountResponse(BaseModel):
    id: UUID4
    bot_id: UUID4
    tenant_id: UUID4
    channel_type: str
    display_name: Optional[str] = None
    channel_uid: Optional[str] = None
    avatar_url: Optional[str] = None
    status: str
    reply_policy: str
    thread_whitelist: Optional[list] = None
    connected_at: Optional[datetime] = None
    last_event_at: Optional[datetime] = None
    last_error: Optional[str] = None
    error_count: int = 0
    is_active: bool = True
    rate_limit: Optional[RateLimitInfo] = None
    circuit_breaker: Optional[CircuitBreakerInfo] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChannelAccountAccessCreate(BaseModel):
    user_id: UUID4
    permission: str = Field(default="chat", pattern="^(read|chat|admin)$")


class ChannelAccountAccessUpdate(BaseModel):
    permission: str = Field(pattern="^(read|chat|admin)$")


class ChannelAccountAccessResponse(BaseModel):
    id: UUID4
    account_id: UUID4
    user_id: UUID4
    permission: str

    class Config:
        from_attributes = True
