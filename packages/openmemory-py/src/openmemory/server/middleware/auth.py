import hmac
import hashlib
import logging
import time
from typing import Dict, Tuple

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from ...core.config import env

logger = logging.getLogger("auth")

_PUBLIC_ENDPOINTS = frozenset({
    "/health",
    "/metrics",
    "/api/system/health",
    "/api/system/stats",
    "/dashboard/health",
})

_MAX_RATE_LIMIT_ENTRIES = 10_000
_rate_limit_store: Dict[str, Dict] = {}
_auth_warning_logged = False


def _is_public(path: str) -> bool:
    return any(path == ep or path.startswith(ep) for ep in _PUBLIC_ENDPOINTS)


def _extract_api_key(request: Request) -> str | None:
    x_api_key = request.headers.get("x-api-key")
    if x_api_key:
        return x_api_key
    auth_header = request.headers.get("authorization")
    if auth_header:
        if auth_header.startswith("Bearer "):
            return auth_header[7:]
        if auth_header.startswith("ApiKey "):
            return auth_header[7:]
    return None


def _validate_api_key(provided: str, expected: str) -> bool:
    if not provided or not expected:
        return False
    return hmac.compare_digest(provided.encode(), expected.encode())


def _get_client_id(request: Request, api_key: str | None) -> str:
    if api_key:
        return hashlib.sha256(api_key.encode()).hexdigest()[:16]
    return request.client.host if request.client else "unknown"


def _check_rate_limit(client_id: str) -> Tuple[bool, int, int]:
    """Returns (allowed, remaining, reset_time)."""
    if not env.rate_limit_enabled:
        return True, -1, -1
    now = int(time.time() * 1000)
    data = _rate_limit_store.get(client_id)
    if not data or now >= data["reset_time"]:
        if len(_rate_limit_store) >= _MAX_RATE_LIMIT_ENTRIES:
            oldest_key = min(_rate_limit_store, key=lambda k: _rate_limit_store[k]["reset_time"])
            del _rate_limit_store[oldest_key]
        _rate_limit_store[client_id] = {
            "count": 1,
            "reset_time": now + env.rate_limit_window_ms,
        }
        return True, env.rate_limit_max_requests - 1, now + env.rate_limit_window_ms
    data["count"] += 1
    remaining = max(0, env.rate_limit_max_requests - data["count"])
    allowed = data["count"] <= env.rate_limit_max_requests
    return allowed, remaining, data["reset_time"]


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        global _auth_warning_logged

        path = request.url.path
        if _is_public(path):
            return await call_next(request)

        api_key = env.api_key

        # Strict mode: auth required but not configured
        if env.require_auth and not api_key:
            logger.error("[AUTH] STRICT MODE: OM_REQUIRE_AUTH is enabled but OM_API_KEY is not set")
            return JSONResponse(
                status_code=503,
                content={"error": "service_unavailable", "message": "Authentication required but not configured"},
            )

        # No key configured: auth disabled
        if not api_key:
            if not _auth_warning_logged:
                logger.warning("[AUTH] No API key configured, authentication is DISABLED")
                logger.warning("[AUTH] Set OM_API_KEY to enable authentication")
                _auth_warning_logged = True
            return await call_next(request)

        provided = _extract_api_key(request)
        if not provided:
            return JSONResponse(
                status_code=401,
                content={"error": "authentication_required", "message": "API key required"},
            )

        if not _validate_api_key(provided, api_key):
            return JSONResponse(status_code=403, content={"error": "invalid_api_key"})

        client_id = _get_client_id(request, provided)
        allowed, remaining, reset_time = _check_rate_limit(client_id)

        response = await call_next(request)

        if env.rate_limit_enabled:
            response.headers["X-RateLimit-Limit"] = str(env.rate_limit_max_requests)
            response.headers["X-RateLimit-Remaining"] = str(remaining)
            response.headers["X-RateLimit-Reset"] = str(reset_time // 1000)

        if not allowed:
            retry_after = max(1, (reset_time - int(time.time() * 1000)) // 1000)
            return JSONResponse(
                status_code=429,
                content={"error": "rate_limit_exceeded", "retry_after": retry_after},
            )

        return response


def authenticate_api_request(app):
    """Add auth middleware to a FastAPI app."""
    app.add_middleware(AuthMiddleware)
