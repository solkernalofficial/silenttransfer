from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import get_db
from src.models.database import Announcement
from src.schemas.schemas import AnnounceRequest, AnnouncementResponse
from src.core.config import settings
from src.core.deps import CurrentWallet

router = APIRouter(prefix="/api", tags=["announcements"])


def _to_response(r: Announcement) -> AnnouncementResponse:
    meta = r.announce_metadata or {}
    to_addr = None
    if isinstance(meta, dict):
        to_addr = meta.get("to_address") or meta.get("recipient")
    return AnnouncementResponse(
        id=r.id,
        scheme_id=r.scheme_id,
        stealth_address=r.stealth_address,
        caller=r.caller,
        ephemeral_pubkey=r.ephemeral_pubkey,
        announce_metadata=meta,
        token_address=r.token_address,
        amount=r.amount,
        block_number=r.block_number,
        announced_at=r.announced_at,
        to_address=to_addr,
    )


@router.post("/announce", response_model=dict)
async def announce(
    req: AnnounceRequest,
    wallet: CurrentWallet,
    db: AsyncSession = Depends(get_db),
):
    """
    Private send log: Account A (caller) → one-time stealth address for Account B (to_address).
    """
    if req.caller.lower() != wallet:
        raise HTTPException(
            status_code=403,
            detail="Caller must match authenticated wallet",
        )

    if req.to_address and req.to_address == req.caller.lower():
        raise HTTPException(
            status_code=400,
            detail="Cannot send to the same wallet (from and to must differ)",
        )

    from src.models.database import Registration
    from src.services.stealth import derive_stealth_address

    stealth = req.stealth_address.lower()
    derived = None
    # If recipient registered, prefer ECDH-shaped derived stealth address
    if req.to_address:
        reg = await db.execute(
            select(Registration).where(
                Registration.user_address == req.to_address.lower()
            )
        )
        recipient = reg.scalar_one_or_none()
        if recipient and recipient.viewing_pubkey:
            derived = derive_stealth_address(
                viewing_pubkey=recipient.viewing_pubkey,
                ephemeral_pubkey=req.ephemeral_pubkey,
                sender=req.caller.lower(),
            )
            stealth = derived

    existing = await db.execute(
        select(Announcement).where(Announcement.stealth_address == stealth)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Stealth address already announced")

    meta = dict(req.metadata or {})
    if req.to_address:
        meta["to_address"] = req.to_address.lower()
        meta["from_address"] = req.caller.lower()
        meta["private_transfer"] = True
    if derived:
        meta["stealth_derived"] = True
        meta["derivation"] = "silenttransfer-v1"

    ann = Announcement(
        scheme_id=1,
        stealth_address=stealth,
        caller=req.caller.lower(),
        ephemeral_pubkey=req.ephemeral_pubkey,
        announce_metadata=meta,
        token_address=req.token_address,
        amount=req.amount,
        block_number=req.block_number,
        tx_hash=f"0x{settings.environment}_announcement",
    )
    db.add(ann)
    await db.flush()

    return {
        "success": True,
        "message": f"Private transfer announced ({settings.environment})",
        "stealth_address": ann.stealth_address,
        "from_address": req.caller.lower(),
        "to_address": req.to_address,
        "amount": req.amount,
        "mode": settings.environment,
        "chain_id": settings.chain_id,
        "network_name": settings.network_name,
        "stealth_derived": bool(derived),
    }


@router.get("/announcements", response_model=list[AnnouncementResponse])
async def get_announcements(limit: int = 50, db: AsyncSession = Depends(get_db)):
    limit = max(1, min(limit, 100))
    result = await db.execute(
        select(Announcement).order_by(Announcement.announced_at.desc()).limit(limit)
    )
    rows = result.scalars().all()
    return [_to_response(r) for r in rows]
