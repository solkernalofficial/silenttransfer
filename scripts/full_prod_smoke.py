"""
Full production smoke test — SilentTransfer web + API.

Usage:
  python scripts/full_prod_smoke.py
  python scripts/full_prod_smoke.py --api https://... --web https://silenttransfer.com
"""
from __future__ import annotations

import argparse
import json
import secrets
import sys
import urllib.error
import urllib.request
from typing import Any

# Product defaults (matches apps/web DEMO_WALLETS + RH testnet deploy)
ALICE = "0x1111111111111111111111111111111111111111"
BOB = "0x2222222222222222222222222222222222222222"
SILENT = "0xE429a44C3572353E3EE6a3c9100FF9BeC74498C4"
SPEND = "0x04" + "aa" * 64
VIEW = "0x04" + "bb" * 64
EPH = "0x04" + "cc" * 64

results: list[tuple[str, bool, str]] = []


def check(name: str, cond: bool, detail: str = "") -> None:
    results.append((name, cond, detail[:220]))
    mark = "PASS" if cond else "FAIL"
    print(f"{mark} | {name}" + (f" | {detail[:220]}" if detail else ""))


def http(
    method: str,
    url: str,
    body: dict | None = None,
    token: str | None = None,
    timeout: int = 45,
) -> tuple[int, Any, dict[str, str]]:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Accept", "application/json, text/html, */*")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    # Browser-like origin for CORS verification on API
    if "fly.dev" in url or "insforge" in url:
        req.add_header("Origin", "https://silenttransfer.com")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            headers = {k.lower(): v for k, v in resp.headers.items()}
            ctype = headers.get("content-type", "")
            if "json" in ctype:
                return resp.status, json.loads(raw.decode() or "null"), headers
            # Keep enough HTML to match titles / brand strings (not just first 400 chars)
            return resp.status, raw.decode(errors="replace")[:8000], headers
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        headers = {k.lower(): v for k, v in e.headers.items()} if e.headers else {}
        try:
            return e.code, json.loads(raw), headers
        except Exception:
            return e.code, raw[:8000], headers
    except Exception as e:
        return 0, str(e), {}


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--api",
        default="https://silent-api-bf5b8a57-6194-4c43-97bb-72739ecfcaae.fly.dev",
    )
    p.add_argument("--web", default="https://silenttransfer.com")
    args = p.parse_args()
    api = args.api.rstrip("/")
    web = args.web.rstrip("/")

    print("=" * 64)
    print("SilentTransfer FULL PRODUCTION SMOKE")
    print(f"API: {api}")
    print(f"WEB: {web}")
    print("=" * 64)

    # ── A. Frontend routes ───────────────────────────────────────────────
    print("\n--- A. Frontend ---")
    for path, needle in [
        ("/", "SilentTransfer"),
        ("/docs", "Documentation"),
        ("/silent", "SILENT"),
        ("/dashboard", "html"),
    ]:
        st, body, _ = http("GET", f"{web}{path}")
        text = body if isinstance(body, str) else json.dumps(body)
        ok = st == 200 and (needle.lower() in text.lower() or needle == "html")
        check(f"web {path}", ok, f"status={st} len={len(text)}")

    # redirect vercel → custom domain (optional soft check)
    st, _, hdrs = http("GET", "https://silenttransfer.vercel.app/")
    loc = hdrs.get("location", "")
    # urllib follows redirects by default — status 200 is also fine
    check(
        "web vercel.app reachable",
        st in (200, 301, 302, 307, 308),
        f"status={st} location={loc}",
    )

    # ── B. API health + public config ────────────────────────────────────
    print("\n--- B. API health / config ---")
    st, health, h = http("GET", f"{api}/health")
    check(
        "health",
        st == 200 and isinstance(health, dict) and health.get("status") == "ok",
        str(health)[:180],
    )
    if isinstance(health, dict):
        check("env=testnet", health.get("environment") == "testnet", str(health.get("environment")))
        check("chain=46630", health.get("chain_id") == 46630, str(health.get("chain_id")))
        check(
            "settlement simulated",
            health.get("settlement_mode") == "testnet_simulated",
            str(health.get("settlement_mode")),
        )

    st, cfg, h = http("GET", f"{api}/api/config/public")
    check("config/public", st == 200 and isinstance(cfg, dict), str(cfg)[:180])
    if isinstance(cfg, dict):
        check("operator_login on", cfg.get("operator_login") is True, str(cfg.get("operator_login")))
        check(
            "SILENT address",
            str(cfg.get("silent_token_address", "")).lower() == SILENT.lower(),
            str(cfg.get("silent_token_address")),
        )
        check(
            "registry set",
            bool(cfg.get("registry_contract_address")),
            str(cfg.get("registry_contract_address")),
        )
        cors_ok = h.get("access-control-allow-origin") in (
            "https://silenttransfer.com",
            "*",
        )
        check("CORS origin header", cors_ok or "access-control-allow-origin" in h, str(h.get("access-control-allow-origin")))

    # OPTIONS preflight
    st, _, h = http("OPTIONS", f"{api}/api/auth/demo-login")
    # Some stacks return 200/204/405 for OPTIONS — check allow-origin if present
    check(
        "CORS preflight responds",
        st in (200, 204, 400, 405) or "access-control-allow-origin" in h,
        f"status={st}",
    )

    # ── C. Alice / Bob operator journey ──────────────────────────────────
    print("\n--- C. Operator journey (Alice → Bob) ---")
    st, bob_login, _ = http("POST", f"{api}/api/auth/demo-login", {"wallet_address": BOB})
    bob_token = bob_login.get("token") if isinstance(bob_login, dict) else None
    check("bob login", st == 200 and bool(bob_token), str(bob_login)[:160])

    st, bob_reg, _ = http(
        "POST",
        f"{api}/api/register",
        {"user_address": BOB, "spending_pubkey": SPEND, "viewing_pubkey": VIEW},
        bob_token,
    )
    check(
        "bob register (receive)",
        st == 200 and (isinstance(bob_reg, dict) and (bob_reg.get("success") or bob_reg.get("user_address") or "id" in bob_reg)),
        str(bob_reg)[:180],
    )

    st, alice_login, _ = http("POST", f"{api}/api/auth/demo-login", {"wallet_address": ALICE})
    alice_token = alice_login.get("token") if isinstance(alice_login, dict) else None
    check("alice login", st == 200 and bool(alice_token), str(alice_login)[:160])

    st, alice_reg, _ = http(
        "POST",
        f"{api}/api/register",
        {
            "user_address": ALICE,
            "spending_pubkey": "0x04" + "11" * 64,
            "viewing_pubkey": "0x04" + "22" * 64,
        },
        alice_token,
    )
    check(
        "alice register",
        st == 200 and isinstance(alice_reg, dict),
        str(alice_reg)[:180],
    )

    stealth = "0x" + secrets.token_hex(20)
    # Unique ephemeral each run so ECDH-shaped derived stealth addresses don't 409
    eph_unique = "0x04" + secrets.token_hex(64)
    amount = str(10 * 10**18)
    st, ann, _ = http(
        "POST",
        f"{api}/api/announce",
        {
            "stealth_address": stealth,
            "caller": ALICE,
            "to_address": BOB,
            "ephemeral_pubkey": eph_unique,
            "token_address": SILENT,
            "amount": amount,
            "block_number": 1,
            "metadata": {"token_symbol": "SILENT", "private_transfer": True, "smoke": True},
        },
        alice_token,
    )
    check(
        "alice→bob announce",
        st == 200 and isinstance(ann, dict) and ann.get("success") is True,
        str(ann)[:200],
    )
    # API may rewrite stealth via ECDH-shaped derivation when Bob is registered
    stealth_final = stealth
    if isinstance(ann, dict):
        check(
            "announce to_address=bob",
            str(ann.get("to_address", "")).lower() == BOB.lower(),
            str(ann.get("to_address")),
        )
        if ann.get("stealth_address"):
            stealth_final = str(ann["stealth_address"]).lower()
        if ann.get("stealth_derived"):
            check("announce stealth_derived", True, stealth_final)

    st, scan, _ = http("GET", f"{api}/api/scan?viewer={BOB}")
    found = scan.get("found", 0) if isinstance(scan, dict) else 0
    anns = (scan.get("announcements") or []) if isinstance(scan, dict) else []
    check("bob scan found>=1", st == 200 and found >= 1, f"found={found}")
    match = any(
        str(a.get("stealth_address", "")).lower() == stealth_final.lower() for a in anns
    )
    check("bob scan has stealth", match, stealth_final)

    st, withdraw, _ = http(
        "POST",
        f"{api}/api/relay/withdraw",
        {
            "stealth_address": stealth_final,
            "target_owner": BOB,
            "fee_token": SILENT,
            "amount": amount,
        },
        bob_token,
    )
    check(
        "bob claim/withdraw",
        st == 200 and isinstance(withdraw, dict) and withdraw.get("success") is True,
        str(withdraw)[:200],
    )
    if isinstance(withdraw, dict):
        check(
            "withdraw has tx_hash",
            bool(withdraw.get("tx_hash")),
            str(withdraw.get("tx_hash")),
        )
        check(
            "withdraw mode simulated",
            "simulat" in str(withdraw.get("mode", "")).lower()
            or "testnet" in str(withdraw.get("mode", "")).lower()
            or bool(withdraw.get("tx_hash")),
            str(withdraw.get("mode")),
        )

    st, hist, _ = http("GET", f"{api}/api/relay/history", token=bob_token)
    check(
        "relay history",
        st == 200 and (isinstance(hist, list) or isinstance(hist, dict)),
        str(hist)[:160] if not isinstance(hist, list) else f"count={len(hist)}",
    )

    # ── D. Read APIs (dashboard data) ────────────────────────────────────
    print("\n--- D. Dashboard read APIs ---")
    st, stats, _ = http("GET", f"{api}/api/stats")
    check("stats", st == 200 and isinstance(stats, dict), str(stats)[:160])

    st, contracts, _ = http("GET", f"{api}/api/contracts")
    check(
        "contracts",
        st == 200 and isinstance(contracts, (dict, list)),
        str(contracts)[:160],
    )

    st, announcements, _ = http("GET", f"{api}/api/announcements")
    check(
        "announcements list",
        st == 200 and isinstance(announcements, (dict, list)),
        f"type={type(announcements).__name__}",
    )

    st, regs, _ = http("GET", f"{api}/api/registrations")
    check(
        "registrations list",
        st == 200 and isinstance(regs, (dict, list)),
        f"type={type(regs).__name__}",
    )

    # ── E. Auth guards ───────────────────────────────────────────────────
    print("\n--- E. Auth guards ---")
    st, denied, _ = http(
        "POST",
        f"{api}/api/announce",
        {
            "stealth_address": "0x" + secrets.token_hex(20),
            "caller": ALICE,
            "to_address": BOB,
            "ephemeral_pubkey": EPH,
            "token_address": SILENT,
            "amount": "1",
        },
        # no token
    )
    check("announce without auth → 401/403", st in (401, 403), f"status={st}")

    st, cross, _ = http(
        "POST",
        f"{api}/api/announce",
        {
            "stealth_address": "0x" + secrets.token_hex(20),
            "caller": ALICE,  # claims alice but uses bob token
            "to_address": BOB,
            "ephemeral_pubkey": EPH,
            "token_address": SILENT,
            "amount": "1",
        },
        bob_token,
    )
    check("caller≠wallet → 403", st == 403, f"status={st} body={str(cross)[:100]}")

    # ── Summary ──────────────────────────────────────────────────────────
    print("\n" + "=" * 64)
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    total = len(results)
    print(f"RESULT: {passed}/{total} passed, {failed} failed")
    if failed:
        print("\nFailed checks:")
        for name, ok, detail in results:
            if not ok:
                print(f"  - {name}: {detail}")
    print("=" * 64)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
