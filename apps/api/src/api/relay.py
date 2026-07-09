from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import get_db
from src.models.database import RelayRequest
from src.schemas.schemas import RelayWithdrawRequest, RelayWithdrawResponse, RelayHistoryResponse
from src.core.config import settings
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
    Relay a sponsored withdrawal.

    - demo / testnet_simulated: synthetic receipt
    - live: real on-chain tx via RELAYER_PRIVATE_KEY + RPC
    """
    owner = req.target_owner.lower()
    if owner != wallet:
        raise HTTPException(
            status_code=403,
            detail="target_owner must match authenticated wallet",
        )

    try:
        result = await execute_settlement(
            stealth_address=req.stealth_address.lower(),
            target_owner=owner,
            fee_token=req.fee_token.lower(),
            amount=req.amount,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    relay = RelayRequest(
        stealth_address=req.stealth_address.lower(),
        target_owner=owner,
        fee_token=req.fee_token.lower(),
        amount=req.amount,
        fee_amount=result["fee_amount"],
        gas_used=result["gas_used"],
        tx_hash=result["tx_hash"],
        status="completed",
    )
    db.add(relay)
    await db.flush()

    return RelayWithdrawResponse(
        success=True,
        tx_hash=result["tx_hash"],
        gas_sponsored=result["gas_used"],
        fee_deducted=result["fee_amount"],
        message=result["message"],
        mode=result["mode"],
    )


@router.get("/history", response_model=list[RelayHistoryResponse])
async def relay_history(
    wallet: CurrentWallet,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RelayRequest)
        .where(RelayRequest.target_owner == wallet)
        .order_by(RelayRequest.created_at.desc())
        .limit(50)
    )
    rows = result.scalars().all()
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
