from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import get_db
from src.models.database import ContractDeployment
from src.schemas.schemas import ContractsResponse, ContractInfo
from src.core.config import settings

router = APIRouter(prefix="/api", tags=["contracts"])


@router.get("/contracts", response_model=ContractsResponse)
async def get_contracts(db: AsyncSession = Depends(get_db)):
    contracts = []

    if settings.registry_contract_address:
        contracts.append(ContractInfo(
            name="ERC6538Registry",
            address=settings.registry_contract_address,
            network=f"Chain ID: {settings.chain_id}",
            description="Stealth meta-address registry (ERC-6538)",
        ))

    if settings.messenger_contract_address:
        contracts.append(ContractInfo(
            name="ERC5564Messenger",
            address=settings.messenger_contract_address,
            network=f"Chain ID: {settings.chain_id}",
            description="Stealth announcement event emitter",
        ))

    if settings.paymaster_contract_address:
        contracts.append(ContractInfo(
            name="SilentPaymaster",
            address=settings.paymaster_contract_address,
            network=f"Chain ID: {settings.chain_id}",
            description="SilentPaymaster (ERC-4337 style), default fee 1%",
        ))

    if settings.silent_token_address:
        contracts.append(ContractInfo(
            name="SILENT (SilentToken)",
            address=settings.silent_token_address,
            network=f"Chain ID: {settings.chain_id}",
            description="SilentTransfer product ERC-20 — no KYC",
        ))

    # Only fall back to placeholders when nothing is configured
    if not contracts:
        contracts = [
            ContractInfo(
                name="ERC6538Registry",
                address="0x0000000000000000000000000000000000000000",
                network="Not deployed",
                description="Stealth meta-address registry — deploy to testnet first",
            ),
            ContractInfo(
                name="ERC5564Messenger",
                address="0x0000000000000000000000000000000000000000",
                network="Not deployed",
                description="Stealth announcement emitter — deploy to testnet first",
            ),
            ContractInfo(
                name="SilentPaymaster",
                address="0x0000000000000000000000000000000000000000",
                network="Not deployed",
                description="Paymaster — deploy to testnet first",
            ),
            ContractInfo(
                name="SILENT (SilentToken)",
                address="0x5FbDB2315678afecb367f032d93F642f64180aa3",
                network="Local Hardhat default — run deploy:silent",
                description="Product ERC-20 — deploy with npm run deploy:silent",
            ),
        ]

    return ContractsResponse(contracts=contracts)
