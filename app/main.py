import time
from typing import Any

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware

from app.api import api_alias_router, api_router
from app.config import settings
from app.database import engine


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Any) -> Any:
        start_time = time.time()
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        response.headers["X-Process-Time-Ms"] = f"{process_time:.2f}"
        return response


def create_application() -> FastAPI:
    app = FastAPI(
        title="Indian Railways Maintenance Block Planning API",
        description=(
            "Decision support and heuristic block-planning API for optimizing railway track maintenance "
            "corridor windows, defect prioritization, and multi-department task packing."
        ),
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # CORS Middleware configuration
    raw_origins = getattr(settings, "cors_origins", "")
    allowed_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    for local_origin in ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"]:
        if local_origin not in allowed_origins:
            allowed_origins.append(local_origin)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Custom Logging Middleware
    app.add_middleware(LoggingMiddleware)

    # Register API Routers under /api/v1 and /api
    app.include_router(api_router)
    app.include_router(api_alias_router, include_in_schema=False)

    # Exception Handlers
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "status_code": exc.status_code,
                "detail": exc.detail,
                "path": request.url.path,
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "status_code": status.HTTP_422_UNPROCESSABLE_ENTITY,
                "message": "Validation Error",
                "detail": jsonable_encoder(exc.errors()),
                "path": request.url.path,
            },
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                "message": "Internal Server Error",
                "detail": str(exc),
                "path": request.url.path,
            },
        )

    # Root endpoint
    @app.get("/", tags=["root"])
    async def root_endpoint() -> dict[str, Any]:
        """API welcome banner with version and documentation URLs."""
        return {
            "title": "Indian Railways Maintenance Block Planning API",
            "version": "1.0.0",
            "status": "online",
            "environment": settings.app_env,
            "docs_url": "/docs",
            "redoc_url": "/redoc",
            "api_prefix": settings.api_prefix,
        }

    # Health check endpoint
    @app.get("/health", tags=["health"])
    @app.get(f"{settings.api_prefix}/health", tags=["health"])
    async def health_check_endpoint() -> dict[str, Any]:
        """Health check endpoint testing database connectivity."""
        db_healthy = False
        try:
            with engine.connect() as conn:
                res = conn.execute(text("SELECT 1")).scalar()
                if res == 1:
                    db_healthy = True
        except Exception:
            db_healthy = False

        status_code = "healthy" if db_healthy else "degraded"
        return {
            "status": status_code,
            "database": "connected" if db_healthy else "disconnected",
            "environment": settings.app_env,
        }

    return app


app = create_application()
