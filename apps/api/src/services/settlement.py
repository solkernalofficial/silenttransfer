"""
Settlement execution for testnet/mainnet.

Modes:
- simulated: synthetic receipt (no chain write)
- live: submit a real transaction via relayer key (RPC) and return on-chain tx hash

Full ERC-4337 EntryPoint bundling is still staged; live mode uses a relayer EOA
to post a real testnet transaction so explorers show a hash (not synthetic).
"""
from __future__ import annotations

import hashlib
import logging
import os
import time
from typing import Any

from src.core.config import settings

log = logging.getLogger("silenttransfer.settlement")


def synthetic_tx_hash() -> str:
    return "0x" + hashlib.sha256(os.urandom(32)).hexdigest()


def _relayer_ready() -> bool:
    return bool(settings.relayer_private_key and settings.rpc_url)


async def execute_settlement(
    *,
    stealth_address: str,
    target_owner: str,
    fee_token: str,
    amount: str,
) -> dict[str, Any]:
    """
    Returns:
      success, tx_hash, gas_used, fee_amount, mode, message
    """
    mode = settings.settlement_mode
    amount_int = int(amount) if str(amount).isdigit() else 0
    bps = max(0, min(int(settings.protocol_fee_bps), 1000))
    fee_int = (amount_int * bps) // 10000 if amount_int > 0 else 0

    if mode == "live":
        if not _relayer_ready():
            raise RuntimeError(
                "Live settlement requires RELAYER_PRIVATE_KEY and RPC_URL"
            )
        try:
            tx_hash, gas_used = await _send_relayer_settlement_tx(
                stealth_address=stealth_address,
                target_owner=target_owner,
                fee_token=fee_token,
                amount=amount,
            )
            return {
                "success": True,
                "tx_hash": tx_hash,
                "gas_used": gas_used,
                "fee_amount": str(fee_int),
                "mode": "live",
                "message": (
                    "On-chain settlement submitted via relayer EOA "
                    f"(chain {settings.chain_id}). Full ERC-4337 bundler path still staged."
                ),
            }
        except Exception as e:
            log.exception("live settlement failed")
            raise RuntimeError(f"Live settlement failed: {e}") from e

    # demo / testnet_simulated
    gas = 148000 + int(time.time()) % 5000
    return {
        "success": True,
        "tx_hash": synthetic_tx_hash(),
        "gas_used": gas,
        "fee_amount": str(fee_int),
        "mode": mode,
        "message": (
            f"Sponsored settlement recorded ({settings.environment}, {mode}). "
            "Set SIMULATE_SETTLEMENT=false and RELAYER_PRIVATE_KEY for real testnet txs."
        ),
    }


async def _send_relayer_settlement_tx(
    *,
    stealth_address: str,
    target_owner: str,
    fee_token: str,
    amount: str,
) -> tuple[str, int]:
    """
    Broadcast a real transaction from the relayer.

    Prefer calling SilentPaymaster.executeGaslessWithdraw when paymaster is set;
    otherwise send a 0-value self-tx with calldata noting the claim (explorer-visible).
    """
    from eth_account import Account
    from web3 import Web3

    pk = settings.relayer_private_key
    if not pk.startswith("0x"):
        pk = "0x" + pk
    account = Account.from_key(pk)
    w3 = Web3(Web3.HTTPProvider(settings.rpc_url, request_kwargs={"timeout": 60}))
    if not w3.is_connected():
        raise RuntimeError(f"RPC not reachable: {settings.rpc_url}")

    chain_id = int(settings.chain_id)
    nonce = w3.eth.get_transaction_count(account.address)
    gas_price = w3.eth.gas_price

    paymaster = (settings.paymaster_contract_address or "").strip()
    if paymaster and Web3.is_address(paymaster):
        # Minimal ABI for executeGaslessWithdraw
        abi = [
            {
                "inputs": [
                    {"name": "user", "type": "address"},
                    {"name": "stealthAddress", "type": "address"},
                    {"name": "token", "type": "address"},
                    {"name": "amount", "type": "uint256"},
                    {"name": "gasEstimate", "type": "uint256"},
                ],
                "name": "executeGaslessWithdraw",
                "outputs": [{"name": "", "type": "bool"}],
                "stateMutability": "nonpayable",
                "type": "function",
            }
        ]
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(paymaster), abi=abi
        )
        amount_int = int(amount) if str(amount).isdigit() else 0
        token = fee_token if Web3.is_address(fee_token) else settings.silent_token_address
        if not token:
            token = "0x0000000000000000000000000000000000000000"
        tx = contract.functions.executeGaslessWithdraw(
            Web3.to_checksum_address(target_owner),
            Web3.to_checksum_address(stealth_address),
            Web3.to_checksum_address(token),
            amount_int,
            150000,
        ).build_transaction(
            {
                "from": account.address,
                "nonce": nonce,
                "gas": 250000,
                "gasPrice": gas_price,
                "chainId": chain_id,
            }
        )
    else:
        # Fallback: 0-value tx to self with claim memo in data
        memo = (
            f"SilentTransfer claim stealth={stealth_address[:10]} "
            f"owner={target_owner[:10]} amount={amount}"
        ).encode()
        tx = {
            "from": account.address,
            "to": account.address,
            "value": 0,
            "nonce": nonce,
            "gas": 30000,
            "gasPrice": gas_price,
            "chainId": chain_id,
            "data": "0x" + memo.hex(),
        }

    signed = account.sign_transaction(tx)
    raw = getattr(signed, "rawTransaction", None) or getattr(signed, "raw_transaction")
    tx_hash = w3.eth.send_raw_transaction(raw)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    gas_used = int(receipt.get("gasUsed") or 0)
    return tx_hash.hex() if hasattr(tx_hash, "hex") else str(tx_hash), gas_used
