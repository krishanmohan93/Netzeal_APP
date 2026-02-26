"""
Main FastAPI application
"""
from fastapi import FastAPI, WebSocket, Query, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager
from .core.config import settings
from .core.database import engine, Base, SessionLocal
from sqlalchemy import text
from .routers import auth, content, ai, social, collab, ai_dual, chat, websocket, network, notifications
# from .routers import recommend  # Temporarily disabled due to sentence-transformers blocking
from .utils.ws import manager
from .core.websocket_manager import ws_manager
import asyncio
from .core.security import decode_access_token

# Database tables are managed by Alembic migrations
# To create tables, run: alembic upgrade head
print("✅ Using Alembic for database migrations")

# Initialize FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI-Powered Professional Growth Platform",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    debug=False,
)

if settings.FORCE_HTTPS:
    app.add_middleware(HTTPSRedirectMiddleware)

if settings.GZIP_ENABLED:
    app.add_middleware(GZipMiddleware, minimum_size=settings.GZIP_MINIMUM_SIZE_BYTES)

trusted_hosts = settings.allowed_hosts_list
if trusted_hosts:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=trusted_hosts)

# Configure CORS
cors_origins = settings.cors_origins_list
if settings.DEBUG and not cors_origins:
    cors_origins = [
        "http://localhost:8081",
        "http://localhost:8082",
        "http://localhost:8083",
        "http://localhost:8084",
        "http://10.92.161.75:8081",
        "http://10.92.161.75:8082",
        "http://10.92.161.75:8083",
        "http://10.92.161.75:8084",
        "exp://10.92.161.75:8081",
        "exp://10.92.161.75:8082",
        "exp://10.92.161.75:8083",
        "exp://10.92.161.75:8084",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=[
        "*",
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
    ],
    expose_headers=["*"],
)


def _error_payload(code: str, message: str, details=None) -> dict:
    payload = {
        "error": {
            "code": code,
            "message": message,
        },
        "detail": message,
    }
    if details is not None and settings.DEBUG:
        payload["details"] = details
    return payload


@app.middleware("http")
async def enforce_request_guards(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > settings.MAX_REQUEST_SIZE_BYTES:
                return JSONResponse(
                    status_code=413,
                    content=_error_payload("payload_too_large", "Request payload too large"),
                )
        except ValueError:
            return JSONResponse(
                status_code=400,
                content=_error_payload("invalid_content_length", "Invalid content-length header"),
            )

    try:
        return await asyncio.wait_for(call_next(request), timeout=settings.REQUEST_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        return JSONResponse(
            status_code=504,
            content=_error_payload("request_timeout", "Request timed out"),
        )


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    if not settings.SECURE_RESPONSE_HEADERS:
        return response

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["X-XSS-Protection"] = "0"
    if settings.FORCE_HTTPS:
        response.headers["Strict-Transport-Security"] = f"max-age={settings.HSTS_MAX_AGE}; includeSubDomains"
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content=_error_payload("internal_error", "Internal server error"),
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    message = exc.detail if isinstance(exc.detail, str) else "Request failed"
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_payload("http_error", message, details=exc.detail),
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=_error_payload("validation_error", "Validation failed", details=exc.errors()),
    )

# Include routers
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(content.router, prefix=settings.API_V1_PREFIX)
app.include_router(ai.router, prefix=settings.API_V1_PREFIX)
app.include_router(ai_dual.router, prefix=settings.API_V1_PREFIX)  # New dual AI provider
app.include_router(social.router, prefix=settings.API_V1_PREFIX)
app.include_router(collab.router, prefix=settings.API_V1_PREFIX)
# app.include_router(recommend.router, prefix=settings.API_V1_PREFIX)  # Temporarily disabled
app.include_router(chat.router, prefix=settings.API_V1_PREFIX)
app.include_router(websocket.router, prefix=settings.API_V1_PREFIX)  # WebSocket for real-time chat
app.include_router(network.router, prefix=settings.API_V1_PREFIX)
app.include_router(notifications.router, prefix=settings.API_V1_PREFIX + "/notifications")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Welcome to NetZeal API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.get("/health/ready")
async def health_ready_check():
    """Readiness endpoint with DB check for production probes"""
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ready", "database": "ok"}
    except Exception:
        return JSONResponse(status_code=503, content={"status": "not_ready", "database": "down"})
    finally:
        db.close()


@app.get(f"{settings.API_V1_PREFIX}/ping")
async def ping():
    """Ping endpoint for connectivity testing"""
    return {"status": "ok", "message": "Server is reachable"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=settings.DEBUG)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(None)):
    user_id = None
    if token:
        payload = decode_access_token(token)
        if payload and payload.get("sub"):
            try:
                user_id = int(payload["sub"])
            except:
                pass

    if not user_id:
        # Anonymous or invalid token
        await websocket.close(code=4003)
        return

    await manager.connect(websocket, user_id)
    try:
        while True:
            # we don't expect messages from client; keep connection open
            await websocket.receive_text()
    except Exception:
        pass
    finally:
        manager.disconnect(websocket, user_id)
