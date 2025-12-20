
from fastapi import APIRouter, HTTPException, Body
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from ...main import Memory

# Global memory instance for server
# In a real app, strict dependency injection might be used, 
# but for this port, a single instance is fine.
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
        # Merge tags into metadata for simplicity if needed, or pass separately if add supports it.
        # Python Memory.add takes meta=kwargs.get("meta").
        # Detailed implementation in main.py uses ingest_document.
        
        # We'll pass extra fields in meta
        meta = req.metadata or {}
        if req.tags: meta["tags"] = req.tags
        
        result = await mem.add(req.content, user_id=req.user_id, meta=meta)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search")
async def search_memory(req: SearchMemoryRequest):
    try:
        # filters kwargs
        filters = req.filters or {}
        results = await mem.search(req.query, user_id=req.user_id, limit=req.limit, **filters)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history")
async def get_history(user_id: str, limit: int = 20, offset: int = 0):
    try:
        # history is sync in main.py, but we can wrap or just call it (FastAPI handles it in threadpool if def, but await if async def)
        # main.py history is def (sync).
        # We should define this route as 'def' or standard async with sync call? 
        # FastAPI runs 'def' path ops in threadpool.
        results = mem.history(user_id, limit, offset)
        return {"history": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
