from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import get_db
from src.models.database import Registration
from src.schemas.schemas import RegisterRequest, RegistrationResponse
from src.core.config import settings
from src.core.deps import CurrentWallet

router = APIRouter(prefix="/api", tags=["registrations"])


@router.post("/register", response_model=dict)
async def register(
    req: RegisterRequest,
    wallet: CurrentWallet,
    db: AsyncSession = Depends(get_db),
):
    """Register stealth meta-keys for the authenticated wallet only. No KYC."""
    address = req.user_address.lower()
    if address != wallet:
        raise HTTPException(
            status_code=403,
            detail="Can only register keys for the authenticated wallet",
        )

    existing = await db.execute(
        select(Registration).where(Registration.user_address == address)
    )
    existing_row = existing.scalar_one_or_none()

    if existing_row:
        existing_row.spending_pubkey = req.spending_pubkey
        existing_row.viewing_pubkey = req.viewing_pubkey
        existing_row.kyc_status = False
    else:
        reg = Registration(
            user_address=address,
            spending_pubkey=req.spending_pubkey,
            viewing_pubkey=req.viewing_pubkey,
            kyc_status=False,
        )
        db.add(reg)

    await db.flush()
    return {
        "success": True,
        "message": f"Meta-address registered ({settings.environment})",
        "mode": settings.environment,
        "chain_id": settings.chain_id,
    }


@router.get("/registrations", response_model=list[RegistrationResponse])
async def get_registrations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Registration).order_by(Registration.registered_at.desc())
    )
    rows = result.scalars().all()
    return [
        RegistrationResponse(
            id=r.id,
            user_address=r.user_address,
            spending_pubkey=r.spending_pubkey,
            viewing_pubkey=r.viewing_pubkey,
            registered_at=r.registered_at,
        )
        for r in rows
    ]
