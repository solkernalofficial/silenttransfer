"""
Settlement execution for testnet/mainnet.

Modes:
- simulated: synthetic receipt (no chain write)
- live: submit a real transaction

When an announcement has a claim_private_key (real funded private send), live
settlement sweeps native ETH from the one-time stealth address to the recipient.
Otherwise falls back to relayer EOA / paymaster memo tx.
"""
from __future__ import annotations

import hashlib
import logging
import os
import time
from typing import Any

from src.core.config import settings

log = logging.getLogger("silenttransfer.settlement")

ZERO = "0x0000000000000000000000000000000000000000"


def synthetic_tx_hash() -> str:
    return "0x" + hashlib.sha256(os.urandom(32)).hexdigest()


def _relayer_ready() -> bool:
    return bool(settings.relayer_private_key and settings.rpc_url)


def _normalize_hex_hash(hx: str) -> str:
    h = hx if hasattr(hx, "hex") else str(hx)
    if hasattr(hx, "hex") and not isinstance(hx, str):
        h = hx.hex()
    h = str(h)
    if not h.startswith("0x"):
        h = "0x" + h
    return h


async def execute_settlement(
    *,
    stealth_address: str,
    target_owner: str,
    fee_token: str,
    amount: str,
    claim_private_key: str | None = None,
    token_address: str | None = None,
) -> dict[str, Any]:
    """
    Returns:
      success, tx_hash, gas_used, fee_amount, mode, message
    """
    mode = settings.settlement_mode
    # Prefer full balance sweep when amount is missing/unparseable (claim UX).
    try:
        amount_int = int(str(amount).strip(), 10)
        if amount_int < 0:
            amount_int = 0
    except (TypeError, ValueError):
        amount_int = 0
    bps = max(0, min(int(settings.protocol_fee_bps), 1000))
    fee_int = (amount_int * bps) // 10000 if amount_int > 0 else 0

    # Funded private-send claims only need RPC + claim key (no relayer EOA).
    can_live_claim = (
        mode == "live"
        or (
            not settings.simulate_settlement
            and bool(settings.rpc_url)
            and bool(claim_private_key)
        )
    )

    if can_live_claim and claim_private_key:
        try:
            tx_hash, gas_used = await _sweep_stealth_to_owner(
                claim_private_key=claim_private_key,
                stealth_address=stealth_address,
                target_owner=target_owner,
                token_address=token_address or fee_token,
                amount_wei=amount_int,
                fee_wei=fee_int,
            )
            return {
                "success": True,
                "tx_hash": tx_hash,
                "gas_used": gas_used,
                "fee_amount": str(fee_int),
                "mode": "live",
                "message": (
                    "On-chain claim: funds swept from one-time address to recipient "
                    f"(chain {settings.chain_id})."
                ),
                "claimed_with_key": True,
            }
        except Exception as e:
            log.exception("stealth sweep failed")
            raise RuntimeError(f"Claim sweep failed: {e}") from e

    if mode == "live":
        if not _relayer_ready():
            raise RuntimeError(
                "Live settlement requires RELAYER_PRIVATE_KEY and RPC_URL "
                "(or a claim key from a funded private send)"
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
                "claimed_with_key": False,
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
        "claimed_with_key": False,
    }


def _fee_fields(w3: Any) -> dict[str, int]:
    """
    Build gas fee fields for the chain.

    Robinhood Chain Testnet uses a higher-than-Ethereum floor for simple transfers
    (~24k gas used). Prefer EIP-1559 when baseFee is present; always keep a
    non-zero floor so nodes do not reject underpriced / zero-fee txs.
    """
    try:
        latest = w3.eth.get_block("latest")
        base = int(latest.get("baseFeePerGas") or 0)
    except Exception:
        base = 0

    try:
        gas_price = int(w3.eth.gas_price)
    except Exception:
        gas_price = 0

    # Floor: 1 gwei (matches observed RH testnet simple transfers)
    floor = 1_000_000_000
    gas_price = max(gas_price, floor)

    if base > 0:
        # tip can be 0 on this chain; maxFee = 2x base keeps headroom across blocks
        max_priority = 0
        max_fee = max(base * 2, gas_price, floor)
        return {
            "maxFeePerGas": int(max_fee),
            "maxPriorityFeePerGas": int(max_priority),
            # effective cost for balance reservation
            "_effective_gas_price": int(max_fee),
        }

    return {
        "gasPrice": int(gas_price),
        "_effective_gas_price": int(gas_price),
    }


def _estimate_gas_limit(
    w3: Any,
    tx_for_estimate: dict[str, Any],
    *,
    floor: int,
    buffer_pct: int = 25,
) -> int:
    """Estimate gas and apply floor + buffer. Never return below floor."""
    try:
        est = int(w3.eth.estimate_gas(tx_for_estimate))
    except Exception as e:
        log.warning("estimate_gas failed (%s); using floor=%s", e, floor)
        est = floor
    buffered = (est * (100 + max(0, buffer_pct))) // 100
    return max(floor, buffered, est)


async def _sweep_stealth_to_owner(
    *,
    claim_private_key: str,
    stealth_address: str,
    target_owner: str,
    token_address: str,
    amount_wei: int,
    fee_wei: int,
) -> tuple[str, int]:
    """
    Sign from the one-time stealth key and send native ETH (or ERC-20) to the recipient.
    Leaves enough balance for gas; optional fee withheld in residual.

    Note: Robinhood Chain Testnet simple transfers use >21k gas (~24k observed).
    Hardcoding 21000 causes: {'code': -32000, 'message': 'intrinsic gas too low'}.
    """
    from eth_account import Account
    from web3 import Web3

    if not settings.rpc_url:
        raise RuntimeError("RPC_URL required for claim sweep")

    pk = claim_private_key
    if not pk.startswith("0x"):
        pk = "0x" + pk
    account = Account.from_key(pk)
    if account.address.lower() != stealth_address.lower():
        raise RuntimeError("claim key does not control stealth_address")

    w3 = Web3(Web3.HTTPProvider(settings.rpc_url, request_kwargs={"timeout": 60}))
    if not w3.is_connected():
        raise RuntimeError(f"RPC not reachable: {settings.rpc_url}")

    token = (token_address or "").lower()
    is_native = (not token) or token == ZERO or token == "eth"

    chain_id = int(settings.chain_id)
    nonce = int(w3.eth.get_transaction_count(account.address))
    fees = _fee_fields(w3)
    effective_price = int(fees.pop("_effective_gas_price"))

    # RH testnet simple value transfers have been observed ~24k gas used / ~31k limit.
    NATIVE_GAS_FLOOR = 35_000
    ERC20_GAS_FLOOR = 120_000

    if not is_native:
        # ERC-20 claim: transfer tokens; stealth must hold a little ETH for gas.
        erc20_abi = [
            {
                "constant": False,
                "inputs": [
                    {"name": "_to", "type": "address"},
                    {"name": "_value", "type": "uint256"},
                ],
                "name": "transfer",
                "outputs": [{"name": "", "type": "bool"}],
                "type": "function",
            },
            {
                "constant": True,
                "inputs": [{"name": "_owner", "type": "address"}],
                "name": "balanceOf",
                "outputs": [{"name": "balance", "type": "uint256"}],
                "type": "function",
            },
        ]
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(token), abi=erc20_abi
        )
        bal = int(contract.functions.balanceOf(account.address).call())
        send_amt = min(amount_wei, bal) if amount_wei > 0 else bal
        if fee_wei > 0 and send_amt > fee_wei:
            send_amt = send_amt - fee_wei
        if send_amt <= 0:
            raise RuntimeError("No token balance on stealth address to claim")

        eth_bal = int(w3.eth.get_balance(account.address))
        built = contract.functions.transfer(
            Web3.to_checksum_address(target_owner), send_amt
        ).build_transaction(
            {
                "from": account.address,
                "nonce": nonce,
                "chainId": chain_id,
            }
        )
        gas_limit = _estimate_gas_limit(
            w3,
            {
                "from": account.address,
                "to": built["to"],
                "data": built.get("data") or built.get("input") or "0x",
                "value": 0,
            },
            floor=ERC20_GAS_FLOOR,
        )
        gas_cost = effective_price * gas_limit
        if eth_bal < gas_cost:
            raise RuntimeError(
                f"Stealth address needs native gas for token claim "
                f"(have={eth_bal}, need≈{gas_cost})"
            )
        tx = {
            **built,
            "gas": gas_limit,
            **fees,
        }
    else:
        balance = int(w3.eth.get_balance(account.address))
        to_cs = Web3.to_checksum_address(target_owner)

        # First pass: reserve using floor so we can estimate with a realistic value.
        gas_limit = NATIVE_GAS_FLOOR
        gas_cost = effective_price * gas_limit
        max_send = balance - gas_cost
        if max_send <= 0:
            raise RuntimeError(
                f"Stealth balance too low to cover gas "
                f"(balance={balance}, gas_cost≈{gas_cost})"
            )
        if amount_wei > 0:
            target_send = min(amount_wei, max_send)
        else:
            target_send = max_send
        if fee_wei > 0 and target_send > fee_wei:
            target_send = target_send - fee_wei
        if target_send <= 0:
            raise RuntimeError("Nothing left to send after gas/fee")

        # Refine gas from chain estimate (RH testnet needs >21k).
        gas_limit = _estimate_gas_limit(
            w3,
            {
                "from": account.address,
                "to": to_cs,
                "value": int(target_send),
            },
            floor=NATIVE_GAS_FLOOR,
        )
        gas_cost = effective_price * gas_limit
        max_send = balance - gas_cost
        if max_send <= 0:
            raise RuntimeError(
                f"Stealth balance too low to cover gas "
                f"(balance={balance}, gas_cost≈{gas_cost})"
            )
        if amount_wei > 0:
            target_send = min(amount_wei, max_send)
        else:
            target_send = max_send
        if fee_wei > 0 and target_send > fee_wei:
            target_send = target_send - fee_wei
        if target_send <= 0:
            raise RuntimeError("Nothing left to send after gas/fee")

        tx = {
            "from": account.address,
            "to": to_cs,
            "value": int(target_send),
            "nonce": nonce,
            "gas": int(gas_limit),
            "chainId": chain_id,
            **fees,
        }

    signed = account.sign_transaction(tx)
    raw = getattr(signed, "rawTransaction", None) or getattr(
        signed, "raw_transaction"
    )
    tx_hash = w3.eth.send_raw_transaction(raw)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    if int(receipt.get("status") or 0) != 1:
        raise RuntimeError("Claim transaction reverted on-chain")
    gas_used = int(receipt.get("gasUsed") or 0)
    return _normalize_hex_hash(tx_hash), gas_used


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
    nonce = int(w3.eth.get_transaction_count(account.address))
    fees = _fee_fields(w3)
    fees.pop("_effective_gas_price", None)

    paymaster = (settings.paymaster_contract_address or "").strip()
    if paymaster and Web3.is_address(paymaster):
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
        try:
            amount_int = int(str(amount).strip(), 10)
        except (TypeError, ValueError):
            amount_int = 0
        token = fee_token if Web3.is_address(fee_token) else settings.silent_token_address
        if not token:
            token = ZERO
        built = contract.functions.executeGaslessWithdraw(
            Web3.to_checksum_address(target_owner),
            Web3.to_checksum_address(stealth_address),
            Web3.to_checksum_address(token),
            amount_int,
            150000,
        ).build_transaction(
            {
                "from": account.address,
                "nonce": nonce,
                "chainId": chain_id,
            }
        )
        gas_limit = _estimate_gas_limit(
            w3,
            {
                "from": account.address,
                "to": built["to"],
                "data": built.get("data") or built.get("input") or "0x",
                "value": 0,
            },
            floor=250_000,
        )
        tx = {**built, "gas": gas_limit, **fees}
    else:
        memo = (
            f"SilentTransfer claim stealth={stealth_address[:10]} "
            f"owner={target_owner[:10]} amount={amount}"
        ).encode()
        data = "0x" + memo.hex()
        gas_limit = _estimate_gas_limit(
            w3,
            {
                "from": account.address,
                "to": account.address,
                "value": 0,
                "data": data,
            },
            floor=50_000,
        )
        tx = {
            "from": account.address,
            "to": account.address,
            "value": 0,
            "nonce": nonce,
            "gas": gas_limit,
            "chainId": chain_id,
            "data": data,
            **fees,
        }

    signed = account.sign_transaction(tx)
    raw = getattr(signed, "rawTransaction", None) or getattr(
        signed, "raw_transaction"
    )
    tx_hash = w3.eth.send_raw_transaction(raw)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    gas_used = int(receipt.get("gasUsed") or 0)
    return _normalize_hex_hash(tx_hash), gas_used
