"""
End-to-end user journey (demo mode):
  1. Bob enables private receive
  2. Alice sends privately to Bob
  3. Bob scans and finds the payment
  4. Bob gasless-withdraws via relayer

Run from apps/api:  python scripts/user_journey_smoke.py
"""
from __future__ import annotations

import secrets
import sys
from pathlib import Path

# Allow importing src when run from apps/api
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from src.core.app import create_app

ALICE = "0x1111111111111111111111111111111111111111"
BOB = "0x2222222222222222222222222222222222222222"
# Product token SILENT (Hardhat first-contract / local deploy address)
SILENT = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
spend = "0x04" + "aa" * 64
view = "0x04" + "bb" * 64
eph = "0x04" + "cc" * 64

c = TestClient(create_app())
results: list[tuple[str, bool, str]] = []


def check(name: str, cond: bool, detail: str = "") -> None:
    results.append((name, cond, detail))
    print(f"{'PASS' if cond else 'FAIL'} | {name} | {detail}")


# Health
r = c.get("/health")
check("1 health", r.status_code == 200 and r.json().get("status") == "ok", r.text[:100])

# Bob login + register
r = c.post("/api/auth/demo-login", json={"wallet_address": BOB})
check("2 bob login", r.status_code == 200 and "token" in r.json(), r.text[:120])
bob_token = r.json().get("token") if r.status_code == 200 else None
bob_h = {"Authorization": f"Bearer {bob_token}"} if bob_token else {}

r = c.post(
    "/api/register",
    headers=bob_h,
    json={"user_address": BOB, "spending_pubkey": spend, "viewing_pubkey": view},
)
check("3 bob receive on", r.status_code == 200 and r.json().get("success"), r.text[:140])

# Alice login + private send
r = c.post("/api/auth/demo-login", json={"wallet_address": ALICE})
check("4 alice login", r.status_code == 200 and "token" in r.json(), r.text[:120])
alice_token = r.json().get("token") if r.status_code == 200 else None
alice_h = {"Authorization": f"Bearer {alice_token}"} if alice_token else {}

stealth = "0x" + secrets.token_hex(20)
r = c.post(
    "/api/announce",
    headers=alice_h,
    json={
        "stealth_address": stealth,
        "caller": ALICE,
        "to_address": BOB,
        "ephemeral_pubkey": eph,
        "token_address": SILENT,
        "amount": str(10 * 10**18),
        "block_number": 0,
        "metadata": {"token_symbol": "SILENT", "private_transfer": True},
    },
)
ok = r.status_code == 200 and r.json().get("success")
check("5 alice→bob send", ok, r.text[:160])
if ok:
    check("5b to_address", r.json().get("to_address") == BOB, str(r.json().get("to_address")))

# Bob scans
r = c.get(f"/api/scan?viewer={BOB}")
ok = r.status_code == 200 and r.json().get("found", 0) >= 1
check("6 bob scan finds payment", ok, r.text[:200])
if ok:
    anns = r.json().get("announcements") or []
    found_stealth = any(a.get("stealth_address") == stealth for a in anns)
    check("6b stealth match", found_stealth, stealth)

# Bob withdraw
r = c.post(
    "/api/relay/withdraw",
    headers=bob_h,
    json={
        "stealth_address": stealth,
        "target_owner": BOB,
        "fee_token": SILENT,
        "amount": str(10 * 10**18),
    },
)
check(
    "7 bob gasless withdraw",
    r.status_code == 200 and r.json().get("success") and r.json().get("tx_hash"),
    r.text[:160],
)

# Stats / history
r = c.get("/api/stats")
check("8 stats", r.status_code == 200 and "total_wallets" in r.json(), r.text[:120])

r = c.get("/api/relay/history")
check("9 relay history", r.status_code == 200 and isinstance(r.json(), list) and len(r.json()) >= 1, str(len(r.json()) if r.status_code == 200 else 0))

r = c.get("/api/contracts")
# contracts endpoint shape may vary
check("10 contracts endpoint", r.status_code == 200, r.text[:100])

failed = [n for n, ok, _ in results if not ok]
print()
print(f"Result: {len(results) - len(failed)}/{len(results)} passed")
if failed:
    print("Failed:", ", ".join(failed))
    sys.exit(1)
print("User journey OK — demo app is usable end-to-end.")
sys.exit(0)
