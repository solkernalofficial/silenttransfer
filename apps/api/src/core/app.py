from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from src.core.config import settings

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.rate_limit_per_minute}/minute"],
    headers_enabled=True,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from src.models.session import init_db

    await init_db()
    yield


def create_app() -> FastAPI:
    # OpenAPI docs available on demo + testnet; disabled on mainnet
    show_docs = settings.environment != "mainnet"
    docs = "/docs" if show_docs else None
    redoc = "/redoc" if show_docs else None
    openapi = "/openapi.json" if show_docs else None

    app = FastAPI(
        title="SilentTransfer API",
        description=f"Private transfer API · {settings.network_name} ({settings.environment})",
        version="0.1.0",
        docs_url=docs,
        redoc_url=redoc,
        openapi_url=openapi,
        lifespan=lifespan,
    )

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if settings.environment == "mainnet":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        return response

    from src.api import (
        health,
        stats,
        auth,
        registrations,
        announcements,
        scanner,
        relay,
        contracts,
        config_public,
    )

    app.include_router(health.router)
    app.include_router(stats.router)
    app.include_router(auth.router)
    app.include_router(registrations.router)
    app.include_router(announcements.router)
    app.include_router(scanner.router)
    app.include_router(relay.router)
    app.include_router(contracts.router)
    app.include_router(config_public.router)

    return app
