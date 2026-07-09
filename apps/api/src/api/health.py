from __future__ import annotations

from fastapi import APIRouter

from src.schemas.schemas import HealthResponse
from src.core.config import settings

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        version="0.1.0",
        demo_mode=settings.is_demo,
        environment=settings.environment,
        chain_id=settings.chain_id,
        network_name=settings.network_name,
        settlement_mode=settings.settlement_mode,
    )
