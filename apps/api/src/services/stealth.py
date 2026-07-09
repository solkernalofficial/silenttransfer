"""
Stealth address helpers (testnet-grade ECDH-shaped derivation).

Product note:
- Ideal ERC-5564 uses secp256k1 ECDH between sender ephemeral key and recipient
  viewing key to derive one-time stealth addresses.
- This module implements a deterministic, auditable derivation for testnet so
  scan can match without storing plain to_address alone.

When VIEWING KEY material is only a public key hex, we derive a stealth address
commitment from (ephemeral_pubkey, viewing_pubkey, sender, amount salt).
Full private viewing-key scan is client-side; API stores public commitments.
"""
from __future__ import annotations

import hashlib
import re

_ADDR = re.compile(r"^0x[a-fA-F0-9]{40}$")
_HEX = re.compile(r"^(0x)?[a-fA-F0-9]+$")


def normalize_hex(value: str) -> str:
    v = (value or "").strip().lower()
    if v.startswith("0x"):
        v = v[2:]
    return v


def derive_stealth_address(
    *,
    viewing_pubkey: str,
    ephemeral_pubkey: str,
    sender: str,
    salt: str = "",
) -> str:
    """
    Deterministic stealth address (20 bytes) from public materials.

    Not a substitute for full ECC ECDH with private viewing keys, but stronger
    than matching only metadata.to_address: scan can recompute and verify.
    """
    material = "|".join(
        [
            normalize_hex(viewing_pubkey),
            normalize_hex(ephemeral_pubkey),
            (sender or "").lower(),
            salt,
            "silenttransfer-v1",
        ]
    ).encode()
    digest = hashlib.sha256(material).digest()
    # take last 20 bytes like Ethereum address
    return "0x" + digest[-20:].hex()


def is_address(value: str) -> bool:
    return bool(value and _ADDR.match(value))


def is_pubkey(value: str) -> bool:
    if not value or not _HEX.match(value):
        return False
    h = normalize_hex(value)
    return len(h) >= 128


def announcement_matches_viewer(
    *,
    viewer: str,
    viewing_pubkey: str | None,
    ephemeral_pubkey: str,
    caller: str,
    stealth_address: str,
    meta_to: str | None,
) -> bool:
    """
    Match rules (OR):
    1) metadata.to_address == viewer (legacy product path)
    2) derived stealth from viewer's registered viewing_pubkey == stealth_address
    """
    viewer_l = (viewer or "").lower()
    if meta_to and meta_to.lower() == viewer_l:
        return True
    if viewing_pubkey and is_pubkey(viewing_pubkey) and is_pubkey(ephemeral_pubkey):
        derived = derive_stealth_address(
            viewing_pubkey=viewing_pubkey,
            ephemeral_pubkey=ephemeral_pubkey,
            sender=caller,
        )
        if derived.lower() == (stealth_address or "").lower():
            return True
    return False
