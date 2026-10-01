import logging
import time
from collections import defaultdict, deque
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from redis import Redis
from app.core.config import settings
from app.db.session import engine
from app.api.routes import router
from app.api.upgrade import router as upgrade_router

app = FastAPI(
    title="ARENA Tournament API",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings().cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Bot-Secret"],
)
app.include_router(router)
app.include_router(upgrade_router)
local_limits = defaultdict(deque)
cache = Redis.from_url(settings().redis_url) if settings().redis_url else None


@app.middleware("http")
async def security_headers(request: Request, call_next):
    if request.url.path.startswith(
        ("/api/auth/login", "/api/auth/signup", "/api/auth/telegram")
    ):
        key = f"arena:rate:{request.client.host}:{int(time.time() // 60)}"
        try:
            if cache:
                count = cache.incr(key)
                if count == 1:
                    cache.expire(key, 65)
            else:
                bucket = local_limits[request.client.host]
                while bucket and bucket[0] < time.monotonic() - 60:
                    bucket.popleft()
                bucket.append(time.monotonic())
                count = len(bucket)
            if count > 20:
                return JSONResponse(
                    {"detail": "Too many attempts. Try again in one minute."},
                    status_code=429,
                    headers={"Retry-After": "60"},
                )
        except Exception:
            return JSONResponse(
                {"detail": "Authentication temporarily unavailable"}, status_code=503
            )
    if request.url.path.startswith('/api/auth/') and request.method in {'POST','PUT','PATCH'}:
        from app.core.security import same_origin
        from fastapi import HTTPException
        try: same_origin(request)
        except HTTPException:
            return JSONResponse({'detail': {'code':'origin_denied','message':'Bu manbadan so‘rov yuborishga ruxsat yo‘q.'}},status_code=403)
    try: content_length=int(request.headers.get('content-length','0') or 0)
    except ValueError: return JSONResponse({'detail':'Invalid content length'},status_code=400)
    if content_length > 262144:
        return JSONResponse({"detail": "Request too large"}, status_code=413)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(IntegrityError)
async def integrity_error(request, exc):
    logging.getLogger("arena.api").warning("Integrity conflict at %s",request.url.path)
    return JSONResponse(
        {
            "detail": "This change conflicts with an existing record. Refresh and try again."
        },
        status_code=409,
    )


@app.get("/api/health")
def health():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    if cache:
        cache.ping()
    return {
        "status": "ok",
        "database": "connected",
        "redis": "connected" if cache else "development fallback",
    }
