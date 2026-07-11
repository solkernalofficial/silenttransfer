"""
SilentVault private multi-recipient transfer API.

A creates a batch → deposits ETH (net + fee) on-chain → operator pays B/C/D from vault.
Recipient-facing endpoints never return the depositor address.
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from src.core.config import settings
from src.core.deps import CurrentWallet
from src.models import get_db
from src.models.database import VaultBatch
from src.schemas.schemas import (
    VaultCreateRequest,
    VaultCreateResponse,
    VaultConfirmDepositRequest,
    VaultIncomingItem,
)
from src.services.vault_payout import execute_vault_payouts

router = APIRouter(prefix="/api/vault", tags=["vault"])


def _fee_bps() -> int:
    return max(0, min(int(settings.vault_fee_bps), 1000))


def _new_batch_id() -> str:
    return "0x" + secrets.token_hex(32)


def _payout_id(batch_id: str, address: str, i: int) -> str:
    h = hashlib.sha256(f"{batch_id}:{address}:{i}".encode()).hexdigest()
    return "0x" + h


@router.post("/batches", response_model=VaultCreateResponse)
async def create_vault_batch(
    req: VaultCreateRequest,
    wallet: CurrentWallet,
    db: AsyncSession = Depends(get_db),
):
    """Plan a private vault transfer: A will deposit gross = net + fee in one wallet confirm."""
    net = 0
    recips = []
    for i, r in enumerate(req.recipients):
        try:
            amt = int(str(r.amount_wei).strip(), 10)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Invalid amount at {i}") from e
        if amt <= 0:
            raise HTTPException(status_code=400, detail=f"Amount must be > 0 at {i}")
        if r.address == wallet:
            raise HTTPException(
                status_code=400, detail="Cannot include your own wallet as recipient"
            )
        net += amt
        recips.append(
            {
                "address": r.address,
                "amount_wei": str(amt),
                "payout_id": "",  # filled after batch_id
                "status": "pending",
                "tx_hash": None,
            }
        )

    if net <= 0:
        raise HTTPException(status_code=400, detail="Total amount must be > 0")

    bps = _fee_bps()
    fee = (net * bps) // 10000
    gross = net + fee
    batch_id = _new_batch_id()
    for i, row in enumerate(recips):
        row["payout_id"] = _payout_id(batch_id, row["address"], i)

    vault_addr = (settings.vault_contract_address or "").strip()
    row = VaultBatch(
        batch_id=batch_id,
        depositor=wallet,
        net_wei=str(net),
        fee_wei=str(fee),
        gross_wei=str(gross),
        status="pending",
        recipients=recips,
    )
    db.add(row)
    await db.flush()

    return VaultCreateResponse(
        batch_id=batch_id,
        depositor=wallet,
        net_wei=str(net),
        fee_wei=str(fee),
        gross_wei=str(gross),
        fee_bps=bps,
        vault_address=vault_addr,
        recipients=recips,
        status="pending",
        message=(
            "Approve deposit of gross (net + fee) to SilentVault. "
            "Recipients are paid from the vault and will not see your wallet on receive."
            if vault_addr
            else "Vault contract not configured — deposit will be recorded; payout may simulate."
        ),
    )


@router.post("/batches/confirm")
async def confirm_vault_deposit(
    req: VaultConfirmDepositRequest,
    wallet: CurrentWallet,
    db: AsyncSession = Depends(get_db),
):
    """After A’s on-chain deposit tx confirms, mark batch deposited and trigger payouts."""
    if req.depositor != wallet:
        raise HTTPException(status_code=403, detail="Depositor must match session")

    q = await db.execute(select(VaultBatch).where(VaultBatch.batch_id == req.batch_id))
    batch = q.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    if batch.depositor != wallet:
        raise HTTPException(status_code=403, detail="Not your batch")
    if batch.status in ("completed", "paying"):
        return {
            "success": True,
            "status": batch.status,
            "batch_id": batch.batch_id,
            "recipients": batch.recipients,
            "message": "Already processing or completed",
        }

    batch.deposit_tx_hash = req.deposit_tx_hash
    batch.status = "deposited"
    batch.updated_at = datetime.utcnow()
    await db.flush()

    # Auto-pay recipients from vault (separate operator txs when live)
    try:
        batch.status = "paying"
        updated = await execute_vault_payouts(
            batch_id=batch.batch_id,
            recipients=list(batch.recipients or []),
        )
        batch.recipients = updated
        flag_modified(batch, "recipients")
        all_done = all(r.get("status") == "completed" for r in updated)
        batch.status = "completed" if all_done else "deposited"
        batch.updated_at = datetime.utcnow()
        await db.flush()
        return {
            "success": True,
            "status": batch.status,
            "batch_id": batch.batch_id,
            "deposit_tx_hash": batch.deposit_tx_hash,
            "recipients": updated,
            "message": (
                "Vault payouts completed. Recipients were paid from the vault — "
                "they do not see your wallet address on the receive leg."
            ),
        }
    except Exception as e:
        batch.status = "deposited"
        await db.flush()
        raise HTTPException(
            status_code=503,
            detail=f"Deposit recorded but payout failed: {e}",
        ) from e


@router.get("/incoming")
async def vault_incoming(
    wallet: CurrentWallet,
    db: AsyncSession = Depends(get_db),
):
    """
    Payments for this wallet from the vault.
    Never includes depositor/sender address (private from recipient's view).
    """
    q = await db.execute(
        select(VaultBatch).order_by(VaultBatch.created_at.desc()).limit(100)
    )
    rows = q.scalars().all()
    items: list[VaultIncomingItem] = []
    for b in rows:
        for r in b.recipients or []:
            if (r.get("address") or "").lower() != wallet:
                continue
            items.append(
                VaultIncomingItem(
                    batch_id=b.batch_id,
                    amount_wei=str(r.get("amount_wei") or "0"),
                    status=str(r.get("status") or "pending"),
                    payout_tx_hash=r.get("tx_hash"),
                    source="Silent Vault",
                    message="Private vault payout — sender wallet is not shown",
                )
            )
    return {"viewer": wallet, "found": len(items), "items": items}


@router.get("/batches/{batch_id}")
async def get_batch(
    batch_id: str,
    wallet: CurrentWallet,
    db: AsyncSession = Depends(get_db),
):
    """Depositor can see full batch; others only their own payout line (no sender)."""
    q = await db.execute(select(VaultBatch).where(VaultBatch.batch_id == batch_id.lower()))
    batch = q.scalar_one_or_none()
    if not batch:
        # try as-is
        q = await db.execute(select(VaultBatch).where(VaultBatch.batch_id == batch_id))
        batch = q.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    if batch.depositor == wallet:
        return {
            "batch_id": batch.batch_id,
            "depositor": batch.depositor,
            "status": batch.status,
            "net_wei": batch.net_wei,
            "fee_wei": batch.fee_wei,
            "gross_wei": batch.gross_wei,
            "deposit_tx_hash": batch.deposit_tx_hash,
            "recipients": batch.recipients,
            "role": "depositor",
        }

    mine = [
        r
        for r in (batch.recipients or [])
        if (r.get("address") or "").lower() == wallet
    ]
    if not mine:
        raise HTTPException(status_code=403, detail="Not a party to this batch")
    return {
        "batch_id": batch.batch_id,
        "status": batch.status,
        "source": "Silent Vault",
        "recipients": mine,
        "role": "recipient",
        "note": "Sender wallet is hidden for private vault transfers",
    }
