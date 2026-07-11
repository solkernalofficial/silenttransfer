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
    claim_mode = "server"

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
        claim_mode_early = (meta.get("claim_mode") or "server").lower()
        # Stealth (ERC-5564): may omit to_address — authorization is the derived claim key.
        if intended and intended != owner and claim_mode_early != "stealth":
            raise HTTPException(
                status_code=403,
                detail="Only the intended recipient can claim this private payment",
            )
        if intended and intended != owner and claim_mode_early == "stealth":
            # Soft check: still require matching claim key below; warn via 403 only if no key
            pass
        if meta.get("claim_status") == "claimed":
            raise HTTPException(status_code=409, detail="Payment already claimed")
        claim_mode = (meta.get("claim_mode") or "server").lower()
        # Prefer client-supplied key (client-held path); fall back to server-held legacy
        claim_key = req.claim_private_key or meta.get("claim_private_key") or meta.get(
            "_claim_private_key"
        )
        token_address = (ann_row.token_address or req.fee_token or "").lower()
    else:
        claim_key = req.claim_private_key

    if claim_mode in ("client", "stealth") and not claim_key:
        raise HTTPException(
            status_code=400,
            detail=(
                "This payment requires a client-derived claim key. "
                "For ERC-5564 stealth: scan with your viewing key (Receive vault), then claim. "
                "For legacy client path: paste the claim code from the sender."
            ),
        )

    if claim_key:
        try:
            from eth_account import Account

            derived = Account.from_key(claim_key).address.lower()
        except Exception as e:
            raise HTTPException(
                status_code=400, detail=f"Invalid claim_private_key: {e}"
            ) from e
        if derived != stealth:
            raise HTTPException(
                status_code=400,
                detail="claim_private_key does not match stealth_address",
            )

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
