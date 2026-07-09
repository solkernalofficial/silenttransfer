from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import get_db
from src.models.database import Registration, Announcement
from src.schemas.schemas import ScanResponse, AnnouncementResponse
from src.core.config import settings

router = APIRouter(prefix="/api", tags=["scanner"])


def _meta_to(r: Announcement) -> str | None:
    meta = r.announce_metadata or {}
    if not isinstance(meta, dict):
        return None
    return (meta.get("to_address") or meta.get("recipient") or "").lower() or None


def _to_response(r: Announcement) -> AnnouncementResponse:
    to_addr = _meta_to(r)
    return AnnouncementResponse(
        id=r.id,
        scheme_id=r.scheme_id,
        stealth_address=r.stealth_address,
        caller=r.caller,
        ephemeral_pubkey=r.ephemeral_pubkey,
        announce_metadata=r.announce_metadata or {},
        token_address=r.token_address,
        amount=r.amount,
        block_number=r.block_number,
        announced_at=r.announced_at,
        to_address=to_addr,
    )


@router.get("/scan", response_model=ScanResponse)
async def scan_for_address(viewer: str, db: AsyncSession = Depends(get_db)):
    """
    Find private payments meant for this wallet (Account B).

    Matches announcements where metadata.to_address == viewer.
    Demo: works even without prior registration (with a hint).
    """
    if not viewer:
        raise HTTPException(status_code=400, detail="Missing viewer address")

    viewer = viewer.lower()
    reg = await db.execute(
        select(Registration).where(Registration.user_address == viewer)
    )
    registered = reg.scalar_one_or_none() is not None

    if not registered and settings.environment == "mainnet":
        raise HTTPException(
            status_code=404,
            detail="Enable private receive for this wallet first",
        )

    # Pull recent announcements and match via to_address OR stealth derivation
    from src.services.stealth import announcement_matches_viewer

    result = await db.execute(
        select(Announcement).order_by(Announcement.announced_at.desc()).limit(200)
    )
    rows = result.scalars().all()

    viewing_pubkey = None
    if registered:
        reg_row = await db.execute(
            select(Registration).where(Registration.user_address == viewer)
        )
        r0 = reg_row.scalar_one_or_none()
        if r0:
            viewing_pubkey = r0.viewing_pubkey

    matched = []
    for r in rows:
        if announcement_matches_viewer(
            viewer=viewer,
            viewing_pubkey=viewing_pubkey,
            ephemeral_pubkey=r.ephemeral_pubkey,
            caller=r.caller,
            stealth_address=r.stealth_address,
            meta_to=_meta_to(r),
        ):
            matched.append(r)

    msg = None
    if not registered and settings.environment != "mainnet":
        msg = (
            "Recommendation: enable private receive for this wallet so counterparties "
            "can target your registered meta-address."
        )
    if not matched:
        msg = msg or "No private payments found for this wallet yet."
    elif viewing_pubkey:
        msg = msg or "Matched via to_address and/or stealth derivation (testnet ECDH-shaped)."

    return ScanResponse(
        viewer=viewer,
        found=len(matched),
        announcements=[_to_response(r) for r in matched],
        message=msg,
    )
