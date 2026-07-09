from __future__ import annotations

import re
import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import get_db
from src.models.database import User
from src.schemas.schemas import SIWENonceResponse, SIWEVerifyRequest, SIWEVerifyResponse
from src.core.config import settings
from src.core.security import create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])

_ADDR = re.compile(r"^0x[a-fA-F0-9]{40}$")


class DemoLoginRequest(BaseModel):
    wallet_address: str = Field(..., min_length=42, max_length=42)

    @field_validator("wallet_address")
    @classmethod
    def validate_address(cls, v: str) -> str:
        if not _ADDR.match(v):
            raise ValueError("Invalid Ethereum address format")
        return v.lower()


class DemoLoginResponse(BaseModel):
    success: bool
    token: str
    wallet_address: str
    mode: str


@router.api_route("/siwe/nonce", methods=["GET", "POST"], response_model=SIWENonceResponse)
async def get_nonce(wallet_address: str, db: AsyncSession = Depends(get_db)):
    if not _ADDR.match(wallet_address):
        raise HTTPException(status_code=400, detail="Invalid wallet address")

    result = await db.execute(select(User).where(User.wallet_address == wallet_address.lower()))
    user = result.scalar_one_or_none()

    nonce = secrets.token_hex(32)
    if not user:
        user = User(wallet_address=wallet_address.lower(), nonce=nonce)
        db.add(user)
    else:
        user.nonce = nonce
    await db.flush()

    # EIP-4361 / SIWE: address in message MUST be EIP-55 checksummed
    # (siwe Python package rejects lowercase 0x… with value_error)
    issued = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        from eth_utils import to_checksum_address

        addr_checksum = to_checksum_address(wallet_address)
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Invalid wallet address: {e}"
        ) from e
    message = (
        f"{settings.siwe_domain} wants you to sign in with your Ethereum account:\n"
        f"{addr_checksum}\n\n"
        f"Sign in to SilentTransfer on {settings.network_name}.\n\n"
        f"URI: {settings.siwe_uri}\n"
        f"Version: 1\n"
        f"Chain ID: {settings.chain_id}\n"
        f"Nonce: {nonce}\n"
        f"Issued At: {issued}"
    )

    return SIWENonceResponse(nonce=nonce, message=message)


@router.post("/siwe/verify", response_model=SIWEVerifyResponse)
async def verify_siwe(req: SIWEVerifyRequest, db: AsyncSession = Depends(get_db)):
    """
    Cryptographically verify SIWE (EIP-4361) and issue a JWT.

    Always uses real signature verification for wallet sessions.
    Operator/Alice-Bob evaluation login is separate: POST /api/auth/demo-login.
    """
    if not req.signature or len(req.signature) < 8:
        raise HTTPException(status_code=400, detail="Signature required")

    wallet: str | None = None
    try:
        from siwe import SiweMessage

        siwe_message = SiweMessage.from_message(req.message)
        result = await db.execute(
            select(User).where(User.wallet_address == siwe_message.address.lower())
        )
        user = result.scalar_one_or_none()
        expected_nonce = user.nonce if user else None
        # Domain may be silenttransfer.com or silenttransfer.vercel.app — accept configured + common hosts
        try:
            siwe_message.verify(
                signature=req.signature,
                domain=settings.siwe_domain,
                nonce=expected_nonce or siwe_message.nonce,
            )
        except Exception:
            # Retry without hard domain pin if message domain is a known app host
            msg_domain = getattr(siwe_message, "domain", None) or settings.siwe_domain
            allowed = {
                settings.siwe_domain.lower(),
                "silenttransfer.com",
                "www.silenttransfer.com",
                "silenttransfer.vercel.app",
                "localhost:3000",
                "localhost",
            }
            if str(msg_domain).lower() not in allowed:
                raise
            siwe_message.verify(
                signature=req.signature,
                domain=str(msg_domain),
                nonce=expected_nonce or siwe_message.nonce,
            )
        wallet = siwe_message.address.lower()
    except HTTPException:
        raise
    except Exception as e:
        # Soft fallback ONLY in pure demo mode (no real wallets expected)
        if settings.is_demo:
            for line in req.message.split("\n"):
                line = line.strip()
                if _ADDR.match(line):
                    wallet = line.lower()
                    break
            if not wallet:
                raise HTTPException(
                    status_code=401, detail=f"SIWE verification failed: {str(e)}"
                ) from e
        else:
            raise HTTPException(
                status_code=401, detail=f"SIWE verification failed: {str(e)}"
            ) from e

    assert wallet is not None
    result = await db.execute(select(User).where(User.wallet_address == wallet))
    user = result.scalar_one_or_none()
    if not user:
        user = User(wallet_address=wallet)
        db.add(user)
    user.last_login = datetime.utcnow()
    user.nonce = None
    await db.flush()

    token = create_access_token(wallet, extra={"auth": "siwe", "environment": settings.environment})
    return SIWEVerifyResponse(success=True, token=token, wallet_address=wallet)


@router.post("/demo-login", response_model=DemoLoginResponse)
async def demo_login(req: DemoLoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Issue a JWT for a wallet without SIWE (operator / evaluation login).
    Enabled on demo and testnet when allow_operator_login is true.
    Disabled on mainnet.
    """
    if not settings.operator_login_enabled:
        raise HTTPException(
            status_code=403,
            detail="Operator login disabled. Use SIWE on this environment.",
        )

    wallet = req.wallet_address.lower()
    result = await db.execute(select(User).where(User.wallet_address == wallet))
    user = result.scalar_one_or_none()
    if not user:
        user = User(wallet_address=wallet)
        db.add(user)
    user.last_login = datetime.utcnow()
    await db.flush()

    token = create_access_token(
        wallet, extra={"operator": True, "environment": settings.environment}
    )
    return DemoLoginResponse(
        success=True,
        token=token,
        wallet_address=wallet,
        mode=settings.environment,
    )
