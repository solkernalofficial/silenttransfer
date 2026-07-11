from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, Float, DateTime, Text, Boolean, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# st_ prefix isolates SilentTransfer tables if Postgres is shared (Render free tier).
class User(Base):
    __tablename__ = "st_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    wallet_address = Column(String(42), unique=True, nullable=False, index=True)
    nonce = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)


class Registration(Base):
    __tablename__ = "st_registrations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_address = Column(String(42), unique=True, nullable=False, index=True)
    spending_pubkey = Column(String(132), nullable=False)
    viewing_pubkey = Column(String(132), nullable=False)
    kyc_status = Column(Boolean, default=False)
    tx_hash = Column(String(66), nullable=True)
    registered_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Announcement(Base):
    __tablename__ = "st_announcements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scheme_id = Column(Integer, default=1)
    stealth_address = Column(String(42), unique=True, nullable=False, index=True)
    caller = Column(String(42), nullable=False, index=True)
    ephemeral_pubkey = Column(String(132), nullable=False)
    announce_metadata = Column(JSON, default={})
    token_address = Column(String(42), default="")
    amount = Column(String(78), default="0")
    block_number = Column(Integer, default=0)
    tx_hash = Column(String(66), nullable=True)
    announced_at = Column(DateTime, default=datetime.utcnow)


class RelayRequest(Base):
    __tablename__ = "st_relay_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stealth_address = Column(String(42), nullable=False)
    target_owner = Column(String(42), nullable=False)
    fee_token = Column(String(42), nullable=False)
    amount = Column(String(78), nullable=False)
    fee_amount = Column(String(78), default="0")
    gas_used = Column(Integer, default=0)
    tx_hash = Column(String(66), unique=True, nullable=True)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PrivacyScore(Base):
    __tablename__ = "st_privacy_scores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_address = Column(String(42), nullable=False, index=True)
    score = Column(Float, default=100.0)
    heuristics_flags = Column(JSON, default=[])
    computed_at = Column(DateTime, default=datetime.utcnow)


class ContractDeployment(Base):
    __tablename__ = "st_contract_deployments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_name = Column(String(100), nullable=False)
    contract_address = Column(String(42), nullable=False)
    network = Column(String(50), nullable=False)
    block_number = Column(Integer, nullable=False)
    tx_hash = Column(String(66), nullable=False)
    deployed_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "st_audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_address = Column(String(42), nullable=True)
    action = Column(String(100), nullable=False)
    details = Column(JSON, default={})
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class VaultBatch(Base):
    """A deposits into SilentVault; B/C/D receive from vault (not from A)."""

    __tablename__ = "st_vault_batches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id = Column(String(66), unique=True, nullable=False, index=True)  # 0x bytes32
    depositor = Column(String(42), nullable=False, index=True)
    net_wei = Column(String(78), nullable=False)
    fee_wei = Column(String(78), default="0")
    gross_wei = Column(String(78), nullable=False)
    deposit_tx_hash = Column(String(66), nullable=True)
    status = Column(String(20), default="pending")  # pending|deposited|paying|completed|failed
    recipients = Column(JSON, default=[])  # [{address, amount_wei, payout_id, status, tx_hash}]
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ShieldCommitment(Base):
    """Public shielded-pool commitments (Merkle leaves). No secrets."""

    __tablename__ = "st_shield_commitments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    commitment = Column(String(66), unique=True, nullable=False, index=True)
    leaf_index = Column(Integer, nullable=False, index=True)
    pool_address = Column(String(42), default="")
    tx_hash = Column(String(66), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
