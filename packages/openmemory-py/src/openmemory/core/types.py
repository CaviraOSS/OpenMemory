from typing import List, Optional, Dict, Any, Union, Literal
from pydantic import BaseModel, Field

class AddReq(BaseModel):
    content: str
    tags: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None
    salience: Optional[float] = None
    decay_lambda: Optional[float] = None
    user_id: Optional[str] = None

class QueryReq(BaseModel):
    query: str
    k: Optional[int] = None
    filters: Optional[Dict[str, Any]] = None
    user_id: Optional[str] = None

class MemRow(BaseModel):
    id: str
    content: str
    primary_sector: str
    tags: Optional[str] = None
    meta: Optional[str] = None
    user_id: Optional[str] = None
    created_at: int
    updated_at: int
    last_seen_at: int
    salience: float
    decay_lambda: float
    version: int

class IngestReq(BaseModel):
    source: Literal["file", "link", "connector"]
    content_type: Literal["pdf", "docx", "html", "md", "txt", "audio"]
    data: str
    metadata: Optional[Dict[str, Any]] = None
    config: Optional[Dict[str, Any]] = None
    user_id: Optional[str] = None

class LgmStoreReq(BaseModel):
    node: str
    content: str
    tags: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None
    namespace: Optional[str] = None
    graph_id: Optional[str] = None
    reflective: Optional[bool] = None
    user_id: Optional[str] = None
