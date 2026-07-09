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


# Never expose claim material in API responses
_SECRET_META_KEYS = frozenset(
    {
        "claim_private_key",
        "_claim_private_key",
        "spend_private_key",
        "private_key",
    }
)


def _public_meta(meta: object) -> dict:
    if not isinstance(meta, dict):
        return {}
    return {k: v for k, v in meta.items() if k not in _SECRET_META_KEYS}


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
        announce_metadata=_public_meta(meta),
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
    funded = bool(req.funding_tx_hash and req.claim_private_key)

    # Real funded path: stealth is a live keypair the client already paid — never rewrite it.
    # Log-only path: if recipient registered, prefer ECDH-shaped derived stealth.
    if not funded and req.to_address:
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

    if funded and req.claim_private_key:
        try:
            from eth_account import Account

            derived_addr = Account.from_key(req.claim_private_key).address.lower()
        except Exception as e:
            raise HTTPException(
                status_code=400, detail=f"Invalid claim_private_key: {e}"
            ) from e
        if derived_addr != stealth:
            raise HTTPException(
                status_code=400,
                detail="claim_private_key does not match stealth_address",
            )

    existing = await db.execute(
        select(Announcement).where(Announcement.stealth_address == stealth)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Stealth address already announced")

    meta = dict(req.metadata or {})
    # Strip any client-supplied secret keys from free-form metadata
    for k in list(meta.keys()):
        if k in _SECRET_META_KEYS or "private_key" in k.lower():
            meta.pop(k, None)
    if req.to_address:
        meta["to_address"] = req.to_address.lower()
        meta["from_address"] = req.caller.lower()
        meta["private_transfer"] = True
    if derived:
        meta["stealth_derived"] = True
        meta["derivation"] = "silenttransfer-v1"
    if funded:
        meta["funded_on_chain"] = True
        meta["real_transfer"] = True
        # Server-only — stripped from all public responses
        meta["claim_private_key"] = req.claim_private_key
        meta["claim_status"] = "funded"
    if req.funding_tx_hash:
        meta["funding_tx_hash"] = req.funding_tx_hash

    ann = Announcement(
        scheme_id=1,
        stealth_address=stealth,
        caller=req.caller.lower(),
        ephemeral_pubkey=req.ephemeral_pubkey,
        announce_metadata=meta,
        token_address=req.token_address,
        amount=req.amount,
        block_number=req.block_number,
        tx_hash=req.funding_tx_hash or f"0x{settings.environment}_announcement",
    )
    db.add(ann)
    await db.flush()

    return {
        "success": True,
        "message": (
            "Private ETH transfer funded on-chain and announced"
            if funded
            else f"Private transfer announced ({settings.environment})"
        ),
        "stealth_address": ann.stealth_address,
        "from_address": req.caller.lower(),
        "to_address": req.to_address,
        "amount": req.amount,
        "mode": settings.environment,
        "chain_id": settings.chain_id,
        "network_name": settings.network_name,
        "stealth_derived": bool(derived),
        "funded_on_chain": funded,
        "funding_tx_hash": req.funding_tx_hash,
        "tx_hash": ann.tx_hash,
    }


@router.get("/announcements", response_model=list[AnnouncementResponse])
async def get_announcements(limit: int = 50, db: AsyncSession = Depends(get_db)):
    limit = max(1, min(limit, 100))
    result = await db.execute(
        select(Announcement).order_by(Announcement.announced_at.desc()).limit(limit)
    )
    rows = result.scalars().all()
    return [_to_response(r) for r in rows]
