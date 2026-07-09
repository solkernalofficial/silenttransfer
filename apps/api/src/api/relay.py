from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import get_db
from src.models.database import Announcement, RelayRequest
from src.schemas.schemas import RelayWithdrawRequest, RelayWithdrawResponse, RelayHistoryResponse
from src.core.deps import CurrentWallet
from src.services.settlement import execute_settlement

router = APIRouter(prefix="/api/relay", tags=["relay"])


@router.post("/withdraw", response_model=RelayWithdrawResponse)
async def relay_withdraw(
    req: RelayWithdrawRequest,
    wallet: CurrentWallet,
    db: AsyncSession = Depends(get_db),
):
    """
    Relay a sponsored withdrawal / claim.

    Real funded private sends: sweeps ETH from one-time stealth key to recipient.
    Otherwise: demo synthetic or relayer EOA settlement marker.
    """
    owner = req.target_owner.lower()
    if owner != wallet:
        raise HTTPException(
            status_code=403,
            detail="target_owner must match authenticated wallet",
        )

    stealth = req.stealth_address.lower()
    claim_key: str | None = None
    token_address: str | None = None
    ann_row = None

    ann_q = await db.execute(
        select(Announcement).where(Announcement.stealth_address == stealth)
    )
    ann_row = ann_q.scalar_one_or_none()
    if ann_row:
        meta = (
            ann_row.announce_metadata
            if isinstance(ann_row.announce_metadata, dict)
            else {}
        )
        intended = (meta.get("to_address") or meta.get("recipient") or "").lower()
        if intended and intended != owner:
            raise HTTPException(
                status_code=403,
                detail="Only the intended recipient can claim this private payment",
            )
        if meta.get("claim_status") == "claimed":
            raise HTTPException(status_code=409, detail="Payment already claimed")
        claim_key = meta.get("claim_private_key") or meta.get("_claim_private_key")
        token_address = (ann_row.token_address or req.fee_token or "").lower()

    try:
        settlement = await execute_settlement(
            stealth_address=stealth,
            target_owner=owner,
            fee_token=req.fee_token.lower(),
            amount=req.amount,
            claim_private_key=claim_key,
            token_address=token_address,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    # Mark claim key as used / clear secret after successful sweep
    if ann_row and settlement.get("claimed_with_key"):
        from sqlalchemy.orm.attributes import flag_modified

        meta = dict(ann_row.announce_metadata or {})
        meta.pop("claim_private_key", None)
        meta.pop("_claim_private_key", None)
        meta["claim_status"] = "claimed"
        meta["claim_tx_hash"] = settlement["tx_hash"]
        ann_row.announce_metadata = meta
        flag_modified(ann_row, "announce_metadata")

    relay = RelayRequest(
        stealth_address=stealth,
        target_owner=owner,
        fee_token=req.fee_token.lower(),
        amount=req.amount,
        fee_amount=settlement["fee_amount"],
        gas_used=settlement["gas_used"],
        tx_hash=settlement["tx_hash"],
        status="completed",
    )
    db.add(relay)
    await db.flush()

    return RelayWithdrawResponse(
        success=True,
        tx_hash=settlement["tx_hash"],
        gas_sponsored=settlement["gas_used"],
        fee_deducted=settlement["fee_amount"],
        message=settlement["message"],
        mode=settlement["mode"],
    )


@router.get("/history", response_model=list[RelayHistoryResponse])
async def relay_history(
    wallet: CurrentWallet,
    db: AsyncSession = Depends(get_db),
):
    hist = await db.execute(
        select(RelayRequest)
        .where(RelayRequest.target_owner == wallet)
        .order_by(RelayRequest.created_at.desc())
        .limit(50)
    )
    rows = hist.scalars().all()
    return [
        RelayHistoryResponse(
            id=r.id,
            stealth_address=r.stealth_address,
            target_owner=r.target_owner,
            fee_token=r.fee_token,
            amount=r.amount,
            fee_amount=r.fee_amount,
            gas_used=r.gas_used,
            tx_hash=r.tx_hash,
            status=r.status,
            created_at=r.created_at,
        )
        for r in rows
    ]
