
from fastapi import APIRouter, HTTPException, Body
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from ...main import Memory
mem = Memory()

router = APIRouter()

class AddMemoryRequest(BaseModel):
    content: str
    user_id: Optional[str] = None
    tags: Optional[List[str]] = []
    metadata: Optional[Dict[str, Any]] = {}

class SearchMemoryRequest(BaseModel):
    query: str
    user_id: Optional[str] = None
    limit: Optional[int] = 10
    filters: Optional[Dict[str, Any]] = {}

@router.post("/add")
async def add_memory(req: AddMemoryRequest):
    try:
        meta = req.metadata or {}
        if req.tags: meta["tags"] = req.tags

        result = await mem.add(req.content, user_id=req.user_id, meta=meta)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search")
async def search_memory(req: SearchMemoryRequest):
    try:
        filters = req.filters or {}
        results = await mem.search(req.query, user_id=req.user_id, limit=req.limit, **filters)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history")
async def get_history(user_id: str, limit: int = 20, offset: int = 0):
    try:
        results = mem.history(user_id, limit, offset)
        return {"history": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
