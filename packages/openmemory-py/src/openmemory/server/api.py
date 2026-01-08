
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import time
import logging
from ..core.config import env
from .routes import memory, health, sources

logger = logging.getLogger("server")

def create_app() -> FastAPI:
    app = FastAPI(title="OpenMemory API", version="1.2.2")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        process_time = (time.time() - start) * 1000
        logger.info(f"{request.method} {request.url.path} - {response.status_code} ({process_time:.2f}ms)")
        return response
    app.include_router(health.router)
    app.include_router(memory.router, prefix="/memory", tags=["memory"])
    app.include_router(sources.router)

    @app.on_event("startup")
    async def startup():
        logger.info(f"OpenMemory Server running on port {env.port}")

    return app
