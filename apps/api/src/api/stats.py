from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.schemas.schemas import StatsResponse
from src.models import get_db
from src.models.database import Registration, Announcement, RelayRequest
from src.core.config import settings

router = APIRouter(prefix="/api", tags=["stats"])


@router.get("/stats", response_model=StatsResponse)
async def get_stats(db: AsyncSession = Depends(get_db)):
    wallets_count = (await db.execute(select(func.count(Registration.id)))).scalar() or 0
    stealth_count = (await db.execute(select(func.count(Announcement.id)))).scalar() or 0
    relays_count = (await db.execute(select(func.count(RelayRequest.id)))).scalar() or 0
    completed_count = (
        await db.execute(
            select(func.count(RelayRequest.id)).where(RelayRequest.status == "completed")
        )
    ).scalar() or 0
    from sqlalchemy import cast, Numeric
    vol_result = await db.execute(
        select(func.sum(cast(RelayRequest.amount, Numeric))).where(RelayRequest.status == "completed")
    )
    total_vol = vol_result.scalar() or 0

    return StatsResponse(
        total_wallets=wallets_count,
        total_stealth_addresses=stealth_count,
        total_relay_requests=relays_count,
        completed_relays=completed_count,
        total_volume_wei=str(total_vol),
        privacy_score=0.0,  # Computed by privacy service in production
        demo_mode=settings.is_demo,
    )
