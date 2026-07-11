"""
Shielded pool indexer — public commitments only for Merkle path reconstruction.
Secrets / nullifiers never touch the server.
"""
from __future__ import annotations

import re

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import get_db
from src.models.database import ShieldCommitment
from src.core.config import settings

router = APIRouter(prefix="/api/shield", tags=["shield"])


class ShieldDepositIn(BaseModel):
    commitment: str = Field(..., min_length=66, max_length=66)
    leaf_index: int = Field(..., ge=0)
    tx_hash: str | None = Field(default=None, max_length=66)
    pool_address: str | None = Field(default=None, max_length=42)

    @field_validator("commitment")
    @classmethod
    def hex_commitment(cls, v: str) -> str:
        if not re.match(r"^0x[a-fA-F0-9]{64}$", v):
            raise ValueError("invalid commitment")
        return v.lower()

    @field_validator("tx_hash")
    @classmethod
    def hex_tx(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        if not re.match(r"^0x[a-fA-F0-9]{64}$", v):
            raise ValueError("invalid tx hash")
        return v.lower()


@router.post("/commitments")
async def record_commitment(body: ShieldDepositIn, db: AsyncSession = Depends(get_db)):
    """Index a deposit commitment (public tree leaf)."""
    existing = await db.execute(
        select(ShieldCommitment).where(
            ShieldCommitment.commitment == body.commitment.lower()
        )
    )
    if existing.scalar_one_or_none():
        return {"success": True, "message": "already indexed"}

    pool = (body.pool_address or getattr(settings, "shield_pool_address", "") or "").lower()
    row = ShieldCommitment(
        commitment=body.commitment.lower(),
        leaf_index=body.leaf_index,
        pool_address=pool,
        tx_hash=body.tx_hash,
    )
    db.add(row)
    await db.flush()
    return {"success": True, "leaf_index": body.leaf_index}


@router.get("/commitments")
async def list_commitments(limit: int = 512, db: AsyncSession = Depends(get_db)):
    """Ordered commitments for off-chain Merkle reconstruction."""
    limit = max(1, min(limit, 2048))
    result = await db.execute(
        select(ShieldCommitment).order_by(ShieldCommitment.leaf_index.asc()).limit(limit)
    )
    rows = result.scalars().all()
    return {
        "count": len(rows),
        "commitments": [
            {
                "commitment": r.commitment,
                "leaf_index": r.leaf_index,
                "tx_hash": r.tx_hash,
            }
            for r in rows
        ],
        "levels": 20,
        "note": "Public tree data only — note secrets stay client-side.",
    }


@router.get("/config")
async def shield_config():
    return {
        "levels": 20,
        "denomination_wei": str(10**17),
        "denomination_eth": "0.1",
        "pool_address": getattr(settings, "shield_pool_address", "") or "",
        "mode": "testnet_witness",
        "description": (
            "Fixed-denomination shielded pool. Testnet verifies Merkle note witnesses; "
            "production replaces verifier with Groth16 for path-hiding ZK."
        ),
    }
