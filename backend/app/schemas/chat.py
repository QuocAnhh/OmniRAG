from pydantic import BaseModel
from typing import List, Optional

class Message(BaseModel):
    role: str # user or assistant
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Message]] = []
    session_id: Optional[str] = None  # For tracking conversations

class AgentLog(BaseModel):
    step: str
    description: str
    status: str = "done" # done, working, failed
    timestamp: str

class ChatResponse(BaseModel):
    response: str
    sources: Optional[List[str]] = []
    retrieved_chunks: Optional[List[dict]] = []
    agent_logs: Optional[List[AgentLog]] = []
    reasoning: Optional[str] = None
    message_id: str
    session_id: Optional[str] = None
    model: Optional[str] = None
    system_prompt: Optional[str] = None

class FeedbackCreate(BaseModel):
    score: int  # 1 for upvote, -1 for downvote
    comment: Optional[str] = None
