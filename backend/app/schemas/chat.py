from pydantic import BaseModel
from typing import List, Optional

class Message(BaseModel):
    role: str # user or assistant
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Message]] = []
    session_id: Optional[str] = None  # For tracking conversations

class ChatResponse(BaseModel):
    response: str
    sources: Optional[List[str]] = []
