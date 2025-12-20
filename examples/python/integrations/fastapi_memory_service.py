
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from openmemory.client import Memory
import uvicorn
import asyncio
from contextlib import asynccontextmanager

# ==================================================================================
# FASTAPI MICROSERVICE
# ==================================================================================
# A clean reference implementation for wrapping OpenMemory in a REST Service.
# (If functionality beyond the builtin 'serve' is needed).
# ==================================================================================

mem = Memory()

class MemoryRequest(BaseModel):
    user_id: str
    content: str
    metadata: dict = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    print("Connecting to OpenMemory...")
    yield
    # Shutdown logic

app = FastAPI(lifespan=lifespan)

@app.post("/remember")
async def remember(req: MemoryRequest):
    res = await mem.add(req.content, user_id=req.user_id, meta=req.metadata)
    return {"status": "stored", "id": res.get("id")}

@app.get("/recall")
async def recall(user_id: str, query: str):
    hits = await mem.search(query, user_id=user_id, limit=5)
    return {"matches": hits}

if __name__ == "__main__":
    # Run with: python fastapi_memory_service.py
    print("Starting FastAPI service...")
    uvicorn.run(app, host="0.0.0.0", port=9000)
