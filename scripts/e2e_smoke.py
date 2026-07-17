"""End-to-end smoke: operator login → register → announce → scan."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

API = sys.argv[1] if len(sys.argv) > 1 else "https://silent-api-bf5b8a57-6194-4c43-97bb-72739ecfcaae.fly.dev"


def req(method: str, path: str, body=None, token: str | None = None):
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(API + path, data=data, method=method)
    request.add_header("Content-Type", "application/json")
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(request, timeout=60) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw


def main() -> int:
    alice = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    bob = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

    st, health = req("GET", "/health")
    print("health", st, health)
    if st != 200:
        return 1

    st, login = req("POST", "/api/auth/demo-login", {"wallet_address": alice})
    print("login_alice", st, {k: login.get(k) for k in ("success", "wallet_address", "mode")} if isinstance(login, dict) else login)
    token = login.get("token") if isinstance(login, dict) else None
    if not token:
        return 1

    st, reg = req(
        "POST",
        "/api/register",
        {"spending_pubkey": "0x04" + "a1" * 32, "viewing_pubkey": "0x04" + "b2" * 32},
        token,
    )
    print("register_alice", st, reg)

    st, login_b = req("POST", "/api/auth/demo-login", {"wallet_address": bob})
    token_b = login_b.get("token") if isinstance(login_b, dict) else None
    print("login_bob", st, bool(token_b))
    st, reg_b = req(
        "POST",
        "/api/register",
        {"spending_pubkey": "0x04" + "c3" * 32, "viewing_pubkey": "0x04" + "d4" * 32},
        token_b,
    )
    print("register_bob", st, reg_b)

    stealth = "0xcccccccccccccccccccccccccccccccccccccccc"
    st, ann = req(
        "POST",
        "/api/announce",
        {
            "caller": alice,
            "to_address": bob,
            "stealth_address": stealth,
            "ephemeral_pubkey": "0x04" + "ee" * 32,
            "token_address": "0x01f44ADdf4af1DB2d9016a4992FFef5163648c0a",
            "amount": "1000000",
            "block_number": 1,
            "metadata": {"note": "smoke"},
        },
        token,
    )
    print("announce", st, ann)

    st, scan = req("POST", "/api/scan", {}, token_b)
    print("scan", st, json.dumps(scan)[:800] if scan is not None else None)
    print("SMOKE_OK" if st == 200 else "SMOKE_FAIL")
    return 0 if st == 200 else 1


if __name__ == "__main__":
    raise SystemExit(main())
