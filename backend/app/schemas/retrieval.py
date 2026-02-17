from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class RetrievalRequest(BaseModel):
    query: str
    top_k: int = 5
    filters: Optional[Dict[str, Any]] = None

class RetrievalResult(BaseModel):
    text: str
    source: str
    score: float
    metadata: Dict[str, Any]
    
class RetrievalResponse(BaseModel):
    results: List[RetrievalResult]
    query_embedding: Optional[List[float]] = None
    hyde_document: Optional[str] = None
