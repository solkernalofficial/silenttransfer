from __future__ import annotations

from fastapi import APIRouter

from src.schemas.schemas import PublicConfigResponse
from src.core.config import settings

router = APIRouter(prefix="/api", tags=["config"])


@router.get("/config/public", response_model=PublicConfigResponse)
async def public_config():
    return PublicConfigResponse(
        demo_mode=settings.is_demo,
        environment=settings.environment,
        chain_id=settings.chain_id,
        network_name=settings.network_name,
        rpc_url=settings.rpc_url or "",
        siwe_domain=settings.siwe_domain,
        contracts_configured=bool(settings.registry_contract_address),
        silent_token_address=settings.silent_token_address or "",
        registry_contract_address=settings.registry_contract_address or "",
        messenger_contract_address=settings.messenger_contract_address or "",
        paymaster_contract_address=settings.paymaster_contract_address or "",
        protocol_fee_bps=max(0, min(int(settings.protocol_fee_bps), 1000)),
        planned_protocol_fee_bps=50,
        protocol_fee_note=(
            "Fees 0% now. Planned gasless fee 0.5% (50 bps) for protocol running costs "
            "and buying SILENT from the market (buyback). Private send stays 0% product fee."
        ),
        product="SilentTransfer",
        token_symbol="SILENT",
        max_supply="1000000000",
        settlement_mode=settings.settlement_mode,
        operator_login=settings.operator_login_enabled,
    )
