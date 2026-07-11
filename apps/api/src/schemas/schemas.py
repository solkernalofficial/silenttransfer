from __future__ import annotations

from datetime import datetime
from typing import Optional, Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator
import re


# ── Auth ─────────────────────────────────────────────────────────────────────────

class SIWENonceResponse(BaseModel):
    nonce: str
    message: str


class SIWEVerifyRequest(BaseModel):
    message: str
    signature: str


class SIWEVerifyResponse(BaseModel):
    success: bool
    token: str
    wallet_address: str


# ── Registration ─────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    user_address: str = Field(..., min_length=42, max_length=42)
    # Uncompressed secp256k1: 0x04 + 64-byte x||y → up to 132 chars with 0x
    spending_pubkey: str = Field(..., min_length=66, max_length=134)
    viewing_pubkey: str = Field(..., min_length=66, max_length=134)

    @field_validator("user_address")
    @classmethod
    def validate_address(cls, v: str) -> str:
        if not re.match(r"^0x[a-fA-F0-9]{40}$", v):
            raise ValueError("Invalid Ethereum address format")
        return v.lower()

    @field_validator("spending_pubkey", "viewing_pubkey")
    @classmethod
    def validate_pubkey(cls, v: str) -> str:
        """
        Accept common secp256k1 public key encodings:
        - uncompressed: 0x04 + 128 hex (130 hex body) or raw 128 hex x||y
        - compressed: 0x02/03 + 64 hex (66 hex body)
        Normalize to lowercase 0x-prefixed hex.
        """
        raw = (v or "").strip().lower()
        if not raw:
            raise ValueError("Invalid public key format")
        if not raw.startswith("0x"):
            raw = "0x" + raw
        body = raw[2:]
        if not re.fullmatch(r"[a-f0-9]+", body):
            raise ValueError("Invalid public key format")
        # compressed 33 bytes, uncompressed 64 (x||y) or 65 (04||x||y)
        if len(body) not in (64, 66, 128, 130):
            raise ValueError("Invalid public key format")
        if len(body) == 66 and body[0:2] not in ("02", "03"):
            raise ValueError("Invalid public key format")
        if len(body) == 130 and not body.startswith("04"):
            # allow 130 hex without 04 only if we treat as opaque testnet material
            pass
        return raw


class RegistrationResponse(BaseModel):
    id: UUID
    user_address: str
    spending_pubkey: str
    viewing_pubkey: str
    registered_at: datetime


# ── Announcement ─────────────────────────────────────────────────────────────────

class AnnounceRequest(BaseModel):
    stealth_address: str = Field(..., min_length=42, max_length=42)
    caller: str = Field(..., min_length=42, max_length=42)  # from wallet (sender)
    ephemeral_pubkey: str = Field(..., min_length=2)
    # Intended recipient's normal wallet (Account B) — used for private A→B demo flow
    to_address: Optional[str] = Field(default=None, min_length=42, max_length=42)
    metadata: Optional[dict] = {}
    token_address: str = ""
    amount: str = "0"
    block_number: int = 0
    # On-chain funding tx from sender wallet → stealth address (real private send)
    funding_tx_hash: Optional[str] = Field(default=None, max_length=66)
    # One-time spend key — only stored when claim_mode=server (legacy). Prefer client.
    claim_private_key: Optional[str] = Field(default=None, max_length=130)
    # client = claim material stays in sender/recipient browser (no server spend key)
    # server = legacy: API holds claim key until claim (operator can see it)
    # stealth = ERC-5564: no claim key at all; recipient derives spend key client-side
    claim_mode: Optional[str] = Field(default="client", max_length=16)
    # transfer scheme label: one-time-eoa | erc5564-secp256k1-v1
    scheme: Optional[str] = Field(default=None, max_length=64)

    @field_validator("stealth_address", "caller")
    @classmethod
    def validate_addr(cls, v: str) -> str:
        if not re.match(r"^0x[a-fA-F0-9]{40}$", v):
            raise ValueError("Invalid Ethereum address format")
        return v.lower()

    @field_validator("to_address")
    @classmethod
    def validate_to(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        if not re.match(r"^0x[a-fA-F0-9]{40}$", v):
            raise ValueError("Invalid recipient address format")
        return v.lower()

    @field_validator("funding_tx_hash")
    @classmethod
    def validate_tx(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        if not re.match(r"^0x[a-fA-F0-9]{64}$", v):
            raise ValueError("Invalid transaction hash")
        return v.lower()

    @field_validator("claim_private_key")
    @classmethod
    def validate_claim_key(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        raw = v if v.startswith("0x") else f"0x{v}"
        if not re.match(r"^0x[a-fA-F0-9]{64}$", raw):
            raise ValueError("Invalid claim private key")
        return raw

    @field_validator("claim_mode")
    @classmethod
    def validate_claim_mode(cls, v: Optional[str]) -> str:
        mode = (v or "client").strip().lower()
        if mode not in ("client", "server", "stealth"):
            raise ValueError("claim_mode must be client, server, or stealth")
        return mode


class AnnouncementResponse(BaseModel):
    id: UUID
    scheme_id: int
    stealth_address: str
    caller: str
    ephemeral_pubkey: str
    announce_metadata: Any
    token_address: str
    amount: str
    block_number: int
    announced_at: datetime
    # Convenience for clients (from metadata when present)
    to_address: Optional[str] = None


# ── Scanner ──────────────────────────────────────────────────────────────────────

class ScanResponse(BaseModel):
    viewer: str
    found: int
    announcements: list[AnnouncementResponse]
    message: Optional[str] = None


# ── Relay ────────────────────────────────────────────────────────────────────────

class RelayWithdrawRequest(BaseModel):
    stealth_address: str = Field(..., min_length=42, max_length=42)
    target_owner: str = Field(..., min_length=42, max_length=42)
    fee_token: str = Field(..., min_length=42, max_length=42)
    amount: str = Field(..., min_length=1)
    # Client-held path: recipient supplies the one-time spend key (never returned by list APIs)
    claim_private_key: Optional[str] = Field(default=None, max_length=130)

    @field_validator("stealth_address", "target_owner", "fee_token")
    @classmethod
    def validate_addr(cls, v: str) -> str:
        if not re.match(r"^0x[a-fA-F0-9]{40}$", v):
            raise ValueError("Invalid Ethereum address format")
        return v.lower()

    @field_validator("claim_private_key")
    @classmethod
    def validate_claim_key(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        raw = v if v.startswith("0x") else f"0x{v}"
        if not re.match(r"^0x[a-fA-F0-9]{64}$", raw):
            raise ValueError("Invalid claim private key")
        return raw


class RelayWithdrawResponse(BaseModel):
    success: bool
    tx_hash: str
    gas_sponsored: int
    fee_deducted: str
    message: str
    mode: str


class RelayHistoryResponse(BaseModel):
    id: UUID
    stealth_address: str
    target_owner: str
    fee_token: str
    amount: str
    fee_amount: str
    gas_used: int
    tx_hash: Optional[str]
    status: str
    created_at: datetime


# ── Stats ────────────────────────────────────────────────────────────────────────

class StatsResponse(BaseModel):
    total_wallets: int
    total_stealth_addresses: int
    total_relay_requests: int
    completed_relays: int
    total_volume_wei: str
    privacy_score: float
    demo_mode: bool


# ── Health ───────────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    version: str
    demo_mode: bool
    environment: str = "testnet"
    chain_id: int = 46630
    network_name: str = "Robinhood Chain Testnet"
    settlement_mode: str = "testnet_simulated"


# ── Contracts ────────────────────────────────────────────────────────────────────

class ContractInfo(BaseModel):
    name: str
    address: str
    network: str
    description: str


class ContractsResponse(BaseModel):
    contracts: list[ContractInfo]


# ── Config ───────────────────────────────────────────────────────────────────────

class PublicConfigResponse(BaseModel):
    demo_mode: bool
    environment: str = "testnet"
    chain_id: int
    network_name: str = "Robinhood Chain Testnet"
    rpc_url: str = ""
    siwe_domain: str
    contracts_configured: bool
    silent_token_address: str = ""
    registry_contract_address: str = ""
    messenger_contract_address: str = ""
    paymaster_contract_address: str = ""
    vault_contract_address: str = ""
    protocol_fee_bps: int = 0
    vault_fee_bps: int = 50
    planned_protocol_fee_bps: int = 50
    protocol_fee_note: str = (
        "Vault private transfer: protocol fee on deposit (default 0.5%). "
        "Recipients are paid from the vault — not from the sender wallet."
    )
    product: str = "SilentTransfer"
    token_symbol: str = "SILENT"
    max_supply: str = "1000000000"
    settlement_mode: str = "testnet_simulated"
    operator_login: bool = True


# ── Vault (private multi-recipient pool) ─────────────────────────────────────────

class VaultRecipientIn(BaseModel):
    address: str = Field(..., min_length=42, max_length=42)
    amount_wei: str = Field(..., min_length=1)

    @field_validator("address")
    @classmethod
    def validate_addr(cls, v: str) -> str:
        if not re.match(r"^0x[a-fA-F0-9]{40}$", v):
            raise ValueError("Invalid address")
        return v.lower()


class VaultCreateRequest(BaseModel):
    """A plans a private batch: one deposit funds many recipients."""

    recipients: list[VaultRecipientIn] = Field(..., min_length=1, max_length=100)

    @field_validator("recipients")
    @classmethod
    def validate_recipients(cls, v: list[VaultRecipientIn]) -> list[VaultRecipientIn]:
        if not v:
            raise ValueError("At least one recipient")
        return v


class VaultCreateResponse(BaseModel):
    batch_id: str
    depositor: str
    net_wei: str
    fee_wei: str
    gross_wei: str
    fee_bps: int
    vault_address: str
    recipients: list[dict]
    status: str
    message: str


class VaultConfirmDepositRequest(BaseModel):
    batch_id: str = Field(..., min_length=66, max_length=66)
    deposit_tx_hash: str = Field(..., min_length=66, max_length=66)
    depositor: str = Field(..., min_length=42, max_length=42)
    # True when on-chain privateSend already paid recipients (no operator step)
    auto_paid: bool = False

    @field_validator("depositor")
    @classmethod
    def validate_dep(cls, v: str) -> str:
        if not re.match(r"^0x[a-fA-F0-9]{40}$", v):
            raise ValueError("Invalid address")
        return v.lower()

    @field_validator("deposit_tx_hash", "batch_id")
    @classmethod
    def validate_hex(cls, v: str) -> str:
        if not re.match(r"^0x[a-fA-F0-9]+$", v):
            raise ValueError("Invalid hex")
        return v.lower()


class VaultBatchPublic(BaseModel):
    batch_id: str
    status: str
    net_wei: str
    fee_wei: str
    gross_wei: str
    recipient_count: int
    # Intentionally omit depositor for recipient-facing views when hide_sender=True
    deposit_tx_hash: Optional[str] = None
    created_at: Optional[datetime] = None


class VaultIncomingItem(BaseModel):
    """What B sees — no sender address."""

    batch_id: str
    amount_wei: str
    status: str
    payout_tx_hash: Optional[str] = None
    source: str = "Silent Vault"
    message: str = "Private vault payout — sender wallet is not shown"


# ── User ─────────────────────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    wallet_address: str
    created_at: datetime
    last_login: Optional[datetime]
