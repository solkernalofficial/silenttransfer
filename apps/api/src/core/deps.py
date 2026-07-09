from __future__ import annotations

import re
from typing import Annotated, Optional

from fastapi import Depends, Header, HTTPException, status

from src.core.security import decode_access_token

_ADDR = re.compile(r"^0x[a-fA-F0-9]{40}$")


def _extract_bearer(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Expected Bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token.strip()


async def get_current_wallet(
    authorization: Annotated[Optional[str], Header()] = None,
) -> str:
    """Require a valid JWT and return the bound wallet address (lowercase)."""
    token = _extract_bearer(authorization)
    payload = decode_access_token(token)
    wallet = (payload.get("wallet") or payload.get("sub") or "").lower()
    if not _ADDR.match(wallet):
        raise HTTPException(status_code=401, detail="Token missing wallet subject")
    return wallet


async def require_wallet_match(
    expected: str,
    authorization: Annotated[Optional[str], Header()] = None,
) -> str:
    """Require JWT wallet to equal expected address."""
    wallet = await get_current_wallet(authorization)
    if wallet != expected.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authenticated wallet does not match request address",
        )
    return wallet


CurrentWallet = Annotated[str, Depends(get_current_wallet)]
