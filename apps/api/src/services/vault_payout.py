"""
Execute SilentVault payouts (Vault → recipient) using operator/relayer key.

Separates deposit (A→Vault) from payout (Vault→B) so recipients do not see A.
"""
from __future__ import annotations

import logging
from typing import Any

from src.core.config import settings

log = logging.getLogger("silenttransfer.vault")

VAULT_ABI = [
    {
        "type": "function",
        "name": "payout",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "batchId", "type": "bytes32"},
            {"name": "payoutId", "type": "bytes32"},
            {"name": "recipient", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "outputs": [],
    },
    {
        "type": "function",
        "name": "payoutMany",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "batchId", "type": "bytes32"},
            {"name": "payoutIds", "type": "bytes32[]"},
            {"name": "recipients", "type": "address[]"},
            {"name": "amounts", "type": "uint256[]"},
        ],
        "outputs": [],
    },
    {
        "type": "function",
        "name": "batchReserved",
        "stateMutability": "view",
        "inputs": [{"name": "", "type": "bytes32"}],
        "outputs": [{"name": "", "type": "uint256"}],
    },
]


def _normalize_hash(hx: Any) -> str:
    if hasattr(hx, "hex") and not isinstance(hx, str):
        h = hx.hex()
    else:
        h = str(hx)
    if not h.startswith("0x"):
        h = "0x" + h
    return h


async def execute_vault_payouts(
    *,
    batch_id: str,
    recipients: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Pay pending recipients. Returns updated recipient rows with status/tx_hash.
    If vault/relayer not configured or simulate: mark simulated completed.
    """
    vault_addr = (settings.vault_contract_address or "").strip()
    can_live = (
        bool(vault_addr)
        and bool(settings.rpc_url)
        and bool(settings.relayer_private_key)
        and not settings.simulate_settlement
    )

    out: list[dict[str, Any]] = []
    pending = [r for r in recipients if r.get("status") in (None, "pending", "queued")]

    if not pending:
        return list(recipients)

    if not can_live:
        # Simulated path for local/demo
        import hashlib
        import time

        for r in recipients:
            row = dict(r)
            if row.get("status") in (None, "pending", "queued"):
                row["status"] = "completed"
                row["tx_hash"] = "0x" + hashlib.sha256(
                    f"{batch_id}{row.get('address')}{time.time()}".encode()
                ).hexdigest()
                row["mode"] = "simulated"
            out.append(row)
        return out

    try:
        from web3 import Web3
        from eth_account import Account

        w3 = Web3(Web3.HTTPProvider(settings.rpc_url))
        acct = Account.from_key(settings.relayer_private_key)
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(vault_addr),
            abi=VAULT_ABI,
        )
        chain_id = int(settings.chain_id)

        # Prefer single multi-payout when several pending
        if len(pending) > 1:
            payout_ids = [Web3.to_bytes(hexstr=p["payout_id"]) for p in pending]
            recips = [Web3.to_checksum_address(p["address"]) for p in pending]
            amounts = [int(p["amount_wei"]) for p in pending]
            nonce = w3.eth.get_transaction_count(acct.address)
            tx = contract.functions.payoutMany(
                Web3.to_bytes(hexstr=batch_id),
                payout_ids,
                recips,
                amounts,
            ).build_transaction(
                {
                    "from": acct.address,
                    "nonce": nonce,
                    "chainId": chain_id,
                    "gas": 500_000 + 80_000 * len(pending),
                }
            )
            # EIP-1559 if available
            try:
                base = w3.eth.get_block("latest").get("baseFeePerGas") or 0
                tx["maxFeePerGas"] = int(base * 2) + w3.to_wei(1, "gwei")
                tx["maxPriorityFeePerGas"] = w3.to_wei(1, "gwei")
            except Exception:
                tx["gasPrice"] = w3.eth.gas_price
            signed = acct.sign_transaction(tx)
            raw = getattr(signed, "rawTransaction", None) or signed.raw_transaction
            tx_hash = w3.eth.send_raw_transaction(raw)
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
            hx = _normalize_hash(tx_hash)
            if receipt.status != 1:
                raise RuntimeError("payoutMany reverted")
            for r in recipients:
                row = dict(r)
                if row.get("status") in (None, "pending", "queued"):
                    row["status"] = "completed"
                    row["tx_hash"] = hx
                    row["mode"] = "live"
                out.append(row)
            return out

        # Single payout
        r0 = pending[0]
        nonce = w3.eth.get_transaction_count(acct.address)
        tx = contract.functions.payout(
            Web3.to_bytes(hexstr=batch_id),
            Web3.to_bytes(hexstr=r0["payout_id"]),
            Web3.to_checksum_address(r0["address"]),
            int(r0["amount_wei"]),
        ).build_transaction(
            {
                "from": acct.address,
                "nonce": nonce,
                "chainId": chain_id,
                "gas": 200_000,
            }
        )
        try:
            base = w3.eth.get_block("latest").get("baseFeePerGas") or 0
            tx["maxFeePerGas"] = int(base * 2) + w3.to_wei(1, "gwei")
            tx["maxPriorityFeePerGas"] = w3.to_wei(1, "gwei")
        except Exception:
            tx["gasPrice"] = w3.eth.gas_price
        signed = acct.sign_transaction(tx)
        raw = getattr(signed, "rawTransaction", None) or signed.raw_transaction
        tx_hash = w3.eth.send_raw_transaction(raw)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
        hx = _normalize_hash(tx_hash)
        if receipt.status != 1:
            raise RuntimeError("payout reverted")
        for r in recipients:
            row = dict(r)
            if row.get("payout_id") == r0["payout_id"]:
                row["status"] = "completed"
                row["tx_hash"] = hx
                row["mode"] = "live"
            out.append(row)
        return out
    except Exception:
        log.exception("vault payout failed")
        raise
