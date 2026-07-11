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
    claim_mode = (req.claim_mode or "client").lower()
    scheme = (req.scheme or "").strip().lower()
    if claim_mode == "stealth" or "erc5564" in scheme:
        claim_mode = "stealth"
        scheme = scheme or "erc5564-secp256k1-v1"

    # Funded = real on-chain payment to one-time address (claim key may be client-only)
    funded = bool(req.funding_tx_hash)

    # Real funded path: stealth is a live keypair the client already paid — never rewrite it.
    # Log-only path: if recipient registered, prefer ECDH-shaped derived stealth.
    # Never rewrite ERC-5564 stealth addresses (they are ECDH-derived off-chain).
    if not funded and claim_mode != "stealth" and req.to_address:
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

    if req.claim_private_key:
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

    # Stealth (ERC-5564): no claim key ever — recipient derives with viewing/spending keys.
    # Client-held funded path: key must be proven once at announce, then discarded.
    if funded and claim_mode == "client" and not req.claim_private_key:
        raise HTTPException(
            status_code=400,
            detail=(
                "claim_mode=client requires claim_private_key at announce so the server "
                "can verify the one-time address; the key is not stored"
            ),
        )
    if claim_mode == "stealth" and req.claim_private_key:
        raise HTTPException(
            status_code=400,
            detail="claim_mode=stealth must not include claim_private_key",
        )
    if claim_mode == "stealth" and not req.ephemeral_pubkey:
        raise HTTPException(
            status_code=400,
            detail="claim_mode=stealth requires ephemeral_pubkey for recipient scan",
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
    meta["claim_mode"] = claim_mode
    if scheme:
        meta["scheme"] = scheme
    if claim_mode == "stealth":
        meta["stealth_scheme"] = scheme or "erc5564-secp256k1-v1"
        meta["private_transfer"] = True
        # Prefer not requiring plain to_address for crypto correctness; keep if client sent for UX
    if funded:
        meta["funded_on_chain"] = True
        meta["real_transfer"] = True
        meta["claim_status"] = "funded"
        if claim_mode == "server" and req.claim_private_key:
            # Legacy only — stripped from all public responses
            meta["claim_private_key"] = req.claim_private_key
        # client/stealth: never persist spend secret
    if req.funding_tx_hash:
        meta["funding_tx_hash"] = req.funding_tx_hash

    ann = Announcement(
        scheme_id=1 if claim_mode == "stealth" else 1,
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

    msg = f"Private transfer announced ({settings.environment})"
    if funded and claim_mode == "stealth":
        msg = (
            "ERC-5564 private transfer funded: recipient derives spend key "
            "(no claim code, no server spend key)"
        )
    elif funded and claim_mode == "client":
        msg = (
            "Private transfer funded on-chain; claim material is client-held "
            "(not stored on server)"
        )
    elif funded:
        msg = "Private transfer funded on-chain and announced (server-assisted claim)"

    return {
        "success": True,
        "message": msg,
        "stealth_address": ann.stealth_address,
        "from_address": req.caller.lower(),
        "to_address": req.to_address,
        "amount": req.amount,
        "mode": settings.environment,
        "chain_id": settings.chain_id,
        "network_name": settings.network_name,
        "stealth_derived": bool(derived),
        "funded_on_chain": funded,
        "claim_mode": claim_mode,
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
