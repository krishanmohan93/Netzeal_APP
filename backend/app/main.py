"""
Main FastAPI application
"""
from fastapi import FastAPI, WebSocket, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .core.config import settings
from .core.database import engine, Base
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
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS for mobile development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*",  # Allow all origins for development
        "http://localhost:8081", # Expo default
        "http://localhost:8082", # Expo alternative port
        "http://localhost:8083", # Expo port 8083
        "http://localhost:8084", # Expo port 8084
        "http://10.92.161.75:8081", # Network IP
        "http://10.92.161.75:8082", # Network IP alternative
        "http://10.92.161.75:8083", # Network IP port 8083
        "http://10.92.161.75:8084", # Network IP port 8084
        "exp://10.92.161.75:8081", # Expo protocol
        "exp://10.92.161.75:8082", # Expo protocol alternative
        "exp://10.92.161.75:8083", # Expo protocol port 8083
        "exp://10.92.161.75:8084", # Expo protocol port 8084
    ],
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


@app.get(f"{settings.API_V1_PREFIX}/ping")
async def ping():
    """Ping endpoint for connectivity testing"""
    return {"status": "ok", "message": "Server is reachable"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)


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
