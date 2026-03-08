from pydantic import BaseModel, UUID4, Field
from typing import Optional, Dict, Any
from datetime import datetime


class BotConfig(BaseModel):
    """Typed config for a Bot. All keys that the RAG pipeline reads must live here."""
    # LLM
    model: str = Field(default="openai/gpt-4o-mini", description="OpenRouter model ID")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=1000, ge=100, le=32000)

    # Prompts
    system_prompt: str = Field(default="You are a helpful assistant.")
    welcome_message: str = Field(default="Hello! How can I help you today?")
    fallback_message: str = Field(default="I'm sorry, I couldn't find relevant information to answer your question.")

    # Retrieval
    top_k: int = Field(default=5, ge=1, le=20)
    similarity_threshold: float = Field(default=0.0, ge=0.0, le=1.0)

    # Features
    enable_memory: bool = Field(default=True)
    enable_knowledge_graph: bool = Field(default=False, description="Whether a KG has been built for this bot")

    class Config:
        extra = "allow"   # Allow legacy keys from existing bots without breaking


class BotBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: Optional[bool] = True


class BotCreate(BotBase):
    avatar_url: Optional[str] = None
    config: Optional[BotConfig] = Field(default_factory=BotConfig)


class BotUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    config: Optional[Dict[str, Any]] = None   # Keep as dict so partial updates work
    is_active: Optional[bool] = None


class Bot(BotBase):
    id: UUID4
    tenant_id: UUID4
    avatar_url: Optional[str] = None
    config: Dict[str, Any]
    api_key: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
