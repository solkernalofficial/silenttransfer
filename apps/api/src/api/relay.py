from __future__ import annotations

import hashlib
import os
import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import get_db
from src.models.database import RelayRequest
from src.schemas.schemas import RelayWithdrawRequest, RelayWithdrawResponse, RelayHistoryResponse
from src.core.config import settings
from src.core.deps import CurrentWallet

router = APIRouter(prefix="/api/relay", tags=["relay"])


def synthetic_tx_hash() -> str:
    return "0x" + hashlib.sha256(os.urandom(32)).hexdigest()


@router.post("/withdraw", response_model=RelayWithdrawResponse)
async def relay_withdraw(
    req: RelayWithdrawRequest,
    wallet: CurrentWallet,
    db: AsyncSession = Depends(get_db),
):
    """
    Relay a sponsored withdrawal.

    - demo / testnet_simulated: record completion with synthetic receipt
    - live: requires relayer key + bundler (not yet fully implemented)
    """
    owner = req.target_owner.lower()
    if owner != wallet:
        raise HTTPException(
            status_code=403,
            detail="target_owner must match authenticated wallet",
        )

    mode = settings.settlement_mode

    if mode == "live":
        if not settings.relayer_private_key or not settings.bundler_url:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Live settlement requires RELAYER_PRIVATE_KEY and BUNDLER_URL. "
                    "Set SIMULATE_SETTLEMENT=true for testnet operator mode."
                ),
            )
        raise HTTPException(
            status_code=501,
            detail=(
                "On-chain EntryPoint/bundler execution is not fully implemented. "
                "Set SIMULATE_SETTLEMENT=true on testnet for workflow settlement receipts."
            ),
        )

    # demo or testnet_simulated
    gas = 148000 + int(time.time()) % 5000
    amount_int = int(req.amount) if req.amount.isdigit() else 0
    bps = max(0, min(int(settings.protocol_fee_bps), 1000))
    fee_int = (amount_int * bps) // 10000 if amount_int > 0 else 0
    fee = str(fee_int)
    txh = synthetic_tx_hash()

    relay = RelayRequest(
        stealth_address=req.stealth_address.lower(),
        target_owner=owner,
        fee_token=req.fee_token.lower(),
        amount=req.amount,
        fee_amount=fee,
        gas_used=gas,
        tx_hash=txh,
        status="completed",
    )
    db.add(relay)
    await db.flush()

    pct = bps / 100
    env_label = "testnet" if settings.is_testnet else "demo"
    return RelayWithdrawResponse(
        success=True,
        tx_hash=txh,
        gas_sponsored=gas,
        fee_deducted=fee,
        message=(
            f"Sponsored settlement recorded ({env_label}, {mode}). "
            f"Protocol fee {pct:g}% ({fee} units). "
            f"Private send product fee 0%. "
            f"Chain {settings.chain_id} ({settings.network_name})."
        ),
        mode=mode,
    )


@router.get("/history", response_model=list[RelayHistoryResponse])
async def relay_history(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RelayRequest).order_by(RelayRequest.created_at.desc()).limit(50)
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
