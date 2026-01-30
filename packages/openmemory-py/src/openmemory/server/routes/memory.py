
from fastapi import APIRouter, HTTPException, Body
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from ...main import Memory
from ...memory.hsg import hsg_query
mem = Memory()

router = APIRouter()

class AddMemoryRequest(BaseModel):
    content: str
    user_id: Optional[str] = None
    tags: Optional[List[str]] = []
    metadata: Optional[Dict[str, Any]] = {}
    initial_salience: Optional[float] = None
    initial_salience_slow: Optional[float] = None

class SearchMemoryRequest(BaseModel):
    query: str
    user_id: Optional[str] = None
    limit: Optional[int] = 10
    filters: Optional[Dict[str, Any]] = {}
    reserved_slots: Optional[bool] = False
    wisdom_ratio: Optional[float] = 0.2

class QueryMemoryRequest(BaseModel):
    """Request model for /memory/query endpoint (used by hooks)"""
    query: str
    user_id: Optional[str] = None
    k: Optional[int] = 10
    reserved_slots: Optional[bool] = False
    wisdom_ratio: Optional[float] = 0.2
    filters: Optional[Dict[str, Any]] = {}

@router.post("/add")
async def add_memory(req: AddMemoryRequest):
    try:
        meta = req.metadata or {}
        if req.tags: meta["tags"] = req.tags
        if req.initial_salience is not None:
            meta["initial_salience"] = req.initial_salience
        if req.initial_salience_slow is not None:
            meta["initial_salience_slow"] = req.initial_salience_slow

        result = await mem.add(req.content, user_id=req.user_id, meta=meta)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search")
async def search_memory(req: SearchMemoryRequest):
    try:
        filters = req.filters or {}
        filters["user_id"] = req.user_id
        results = await hsg_query(
            req.query,
            k=req.limit,
            f=filters,
            reserved_slots=req.reserved_slots,
            wisdom_ratio=req.wisdom_ratio
        )
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/query")
async def query_memory(req: QueryMemoryRequest):
    """Query endpoint for hooks - returns matches with wisdom/recent distinction"""
    try:
        filters = req.filters or {}
        filters["user_id"] = req.user_id
        results = await hsg_query(
            req.query,
            k=req.k,
            f=filters,
            reserved_slots=req.reserved_slots,
            wisdom_ratio=req.wisdom_ratio
        )
        return {"matches": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history")
async def get_history(user_id: str, limit: int = 20, offset: int = 0):
    try:
        results = mem.history(user_id, limit, offset)
        return {"history": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
