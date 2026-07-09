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
    spending_pubkey: str = Field(..., min_length=128, max_length=132)
    viewing_pubkey: str = Field(..., min_length=128, max_length=132)

    @field_validator("user_address")
    @classmethod
    def validate_address(cls, v: str) -> str:
        if not re.match(r"^0x[a-fA-F0-9]{40}$", v):
            raise ValueError("Invalid Ethereum address format")
        return v.lower()

    @field_validator("spending_pubkey", "viewing_pubkey")
    @classmethod
    def validate_pubkey(cls, v: str) -> str:
        if not re.match(r"^(0x)?[a-fA-F0-9]{128,132}$", v):
            raise ValueError("Invalid public key format")
        return v


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
    # One-time spend key for the stealth address (server-held for claim sweep only)
    claim_private_key: Optional[str] = Field(default=None, max_length=130)

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

    @field_validator("stealth_address", "target_owner", "fee_token")
    @classmethod
    def validate_addr(cls, v: str) -> str:
        if not re.match(r"^0x[a-fA-F0-9]{40}$", v):
            raise ValueError("Invalid Ethereum address format")
        return v.lower()


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
    protocol_fee_bps: int = 0
    planned_protocol_fee_bps: int = 50
    protocol_fee_note: str = (
        "Fees 0% now. Planned gasless fee 0.5% for protocol ops + SILENT market buyback. "
        "Private send: 0% product fee."
    )
    product: str = "SilentTransfer"
    token_symbol: str = "SILENT"
    max_supply: str = "1000000000"
    settlement_mode: str = "testnet_simulated"
    operator_login: bool = True


# ── User ─────────────────────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    wallet_address: str
    created_at: datetime
    last_login: Optional[datetime]
