"""Quick security smoke checks (run from apps/api)."""
from __future__ import annotations

import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from src.core.app import create_app

c = TestClient(create_app())
wallet = "0x1234567890123456789012345678901234567890"
spend = "0x04" + "aa" * 64
view = "0x04" + "bb" * 64
eph = "0x04" + "cc" * 64
results: list[tuple[str, str, str]] = []


def check(name: str, cond: bool, detail: str = "") -> None:
    status = "PASS" if cond else "FAIL"
    results.append((name, status, detail))
    print(f"{status} | {name} | {detail}")


r = c.get("/health")
check("health", r.status_code == 200 and r.json().get("status") == "ok", r.text[:80])

r = c.post("/api/register", json={})
check("register no auth", r.status_code == 401, f"{r.status_code} {r.text[:80]}")

r = c.post("/api/auth/demo-login", json={"wallet_address": wallet})
check("demo-login", r.status_code == 200 and "token" in r.json(), r.text[:100])
token = r.json().get("token") if r.status_code == 200 else None
headers = {"Authorization": f"Bearer {token}"} if token else {}

if token:
    r = c.post(
        "/api/register",
        headers=headers,
        json={
            "user_address": wallet,
            "spending_pubkey": spend,
            "viewing_pubkey": view,
        },
    )
    check("register auth", r.status_code == 200 and r.json().get("success"), r.text[:120])

    r = c.post(
        "/api/register",
        headers=headers,
        json={
            "user_address": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
            "spending_pubkey": spend,
            "viewing_pubkey": view,
        },
    )
    check("register wrong wallet", r.status_code == 403, f"{r.status_code}")

    stealth = "0x" + secrets.token_hex(20)
    r = c.post(
        "/api/announce",
        headers=headers,
        json={
            "stealth_address": stealth,
            "caller": wallet,
            "ephemeral_pubkey": eph,
            "token_address": "0x0000000000000000000000000000000000000001",
            "amount": "1000000000000000000",
        },
    )
    check("announce auth", r.status_code == 200 and r.json().get("success"), r.text[:120])

    r = c.post(
        "/api/relay/withdraw",
        headers=headers,
        json={
            "stealth_address": stealth,
            "target_owner": wallet,
            "fee_token": "0x0000000000000000000000000000000000000001",
            "amount": "500000000000000000",
        },
    )
    check(
        "relay demo",
        r.status_code == 200 and r.json().get("mode") == "demo",
        r.text[:120],
    )

    r = c.get(f"/api/scan?viewer={wallet}")
    check("scan", r.status_code == 200, f"found={r.json().get('found')}")

r = c.post(
    "/api/register",
    headers={"Authorization": "Bearer not.a.jwt"},
    json={
        "user_address": wallet,
        "spending_pubkey": spend,
        "viewing_pubkey": view,
    },
)
check("bad jwt", r.status_code == 401, f"{r.status_code}")

fails = sum(1 for _, s, _ in results if s == "FAIL")
print(f"\nTOTAL PASS={len(results) - fails} FAIL={fails}")
raise SystemExit(1 if fails else 0)
