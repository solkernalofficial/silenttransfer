<p align="center">
  <strong>SilentTransfer</strong>
  <br>
  <em>Private transfer infrastructure for public blockchains</em>
</p>

<p align="center">
  <a href="https://silenttransfer.com">Website</a> ·
  <a href="https://github.com/SilentTransfer">GitHub</a> ·
  <a href="https://x.com/silenttransfer">X</a> ·
  <a href="https://silenttransfer.com/docs">Documentation</a> ·
  <a href="https://github.com/SilentTransfer/silenttransfer">Main Repository</a> ·
  <a href="https://silenttransfer.com/silent">Protocol (sthood)</a>
</p>

<p align="center">
  <a href="https://github.com/SilentTransfer/silenttransfer"><img src="https://img.shields.io/badge/network-Robinhood%20Chain%20Testnet-0ea5e9?style=flat-square" alt="Network" /></a>
  <a href="https://silenttransfer.com/silent"><img src="https://img.shields.io/badge/sthood-1B%20hard%20cap-10b981?style=flat-square" alt="sthood" /></a>
  <a href="https://silenttransfer.com"><img src="https://img.shields.io/badge/KYC-not%20in%20product%20path-6366f1?style=flat-square" alt="No KYC" /></a>
  <a href="https://github.com/SilentTransfer/silenttransfer"><img src="https://img.shields.io/badge/privacy-partial%20%2F%20honest-f59e0b?style=flat-square" alt="Privacy" /></a>
</p>

<p align="center">
  <code>CA: 0x01f44ADdf4af1DB2d9016a4992FFef5163648c0a</code>
</p>

---

## What is SilentTransfer?

SilentTransfer is privacy-oriented private transfer infrastructure for public EVM chains. It provides a professional console and API for private receive, private transfer, payment discovery, and settlement—**without KYC in the product path**.

On a public blockchain, a normal wallet-to-wallet send exposes the recipient’s primary address immediately. SilentTransfer routes value to a **fresh one-time destination**, then lets the intended recipient **claim** into their wallet. The result is stronger recipient privacy than a plain transfer—while remaining honest about limits: chain explorers still show public transactions, and privacy today is **partial**, not full anonymity or mixer-grade unlinkability.

The protocol asset is **sthood** (hard-capped at 1,000,000,000). Official contract address:

`0x01f44ADdf4af1DB2d9016a4992FFef5163648c0a`

Launched on **Pons** launchpad: community-majority supply with a small protocol share for operations—**0% VC**.

## Why SilentTransfer exists

Public blockchains are transparent by design. That transparency is excellent for settlement and auditability—but brutal for ordinary private payments.

- **No private receive path** — A normal send lands on the recipient’s public address; anyone watching sees who got paid.
- **No product-grade private transfer UX** — Privacy research exists (stealth addresses, standards), but operators and users lack a clean console + API to use it day to day.
- **No KYC-free product rail** — Many “privacy” products force identity gates. SilentTransfer keeps KYC out of the product path.
- **No honest status** — The market is full of overclaims. We document what is private **now** vs what is still roadmap.
- **No fair protocol asset model** — Community-first supply with hard-capped **sthood**, not VC-dominated tokenomics.

## Core capabilities

| Capability | Description |
|---|---|
| Private receive | Generate / register receive material so senders can fund a one-time destination instead of your main wallet |
| Private send | Fund a fresh one-time address on-chain; recipient claims when ready |
| Payment discovery | Scan and surface incoming private payments for the connected wallet |
| Claim & settlement | Move funds from the one-time address to the recipient wallet |
| Professional console | Next.js app: send, receive, scanner, transactions, analytics, settings |
| Public API | FastAPI backend for registrations, announcements, stats, and relay paths |
| Wallet support | Connect via standard EVM wallets (wagmi / WalletConnect-compatible flow) |
| Protocol asset | **sthood** — 1B hard cap · community-majority · 0% VC · CA `0x01f44ADdf4af1DB2d9016a4992FFef5163648c0a` |

## How it works

```
Sender                         Recipient
   |                               |
   ▼                               ▼
Connect wallet              Connect wallet
   |                               |
   ▼                               ▼
Private send ──►  one-time address  ◄── scan / discover
                  (fresh EOA fund)
                       |
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   On-chain fund   API announce   Claim path
   (public tx)     (routing +     (recipient
                    metadata)      sweeps)
                       |
                       ▼
              Funds on recipient wallet
```

1. **Connect** — Sender and recipient use a standard EVM wallet on the supported network.
2. **Send** — Sender initiates a private transfer; value goes to a **new one-time address**, not the recipient’s public wallet.
3. **Announce** — The app records payment context for the intended recipient (API-assisted discovery today).
4. **Discover** — Recipient scans / opens receive flow to see claimable payments.
5. **Claim** — Recipient claims; funds move from the one-time address to their wallet.
6. **Settle** — On-chain settlement as configured (testnet may simulate settlement until a full bundler/paymaster path is live).

> **Honesty note:** Privacy is **partial**—better than plain A→B, not “untraceable.” See privacy status in the main repository.

## Architecture overview

SilentTransfer is a full-stack monorepo: web console, API, and Solidity contracts.

**User layer** — Next.js console for private send/receive, scanner, transactions, analytics, docs, and the **sthood** protocol page. SIWE-style session auth where enabled.

**Core layer** — FastAPI services for registrations, announcements, stats, health, and relay/scanner paths. PostgreSQL (or SQLite in light environments) for operational state.

**Infrastructure layer** — EVM smart contracts (Hardhat): registry / messenger-oriented surfaces, sthood token, paymaster scaffolding. Primary network today: **Robinhood Chain Testnet** (`46630`). Not affiliated with Robinhood Markets, Inc.

**Tech stack:** Next.js · TypeScript · Tailwind · wagmi/viem · FastAPI · PostgreSQL · Solidity · Hardhat · ethers.

## Protocol asset — sthood

| | |
|---|---|
| Name / ticker | **sthood** |
| Contract (CA) | `0x01f44ADdf4af1DB2d9016a4992FFef5163648c0a` |
| Hard cap | **1,000,000,000** sthood (contract-enforced) |
| Community | **90%** |
| Protocol (ops) | **10%** |
| Team pool | **0%** |
| Venture capital | **0%** |
| Launch model | Pons launchpad (community-majority) |
| Buy | [Pons launchpad](https://pons.family/launchpad/0x01f44addf4af1db2d9016a4992ffef5163648c0a) |

Fees currently **0%**; a small sponsored-claim fee is planned for protocol operations. Details: [silenttransfer.com/silent](https://silenttransfer.com/silent).

## Build with SilentTransfer

The main codebase is open for inspection and contribution. Developers can run the stack locally, deploy contracts to testnet, and integrate against the public API patterns documented in-app.

To get started:

- Clone the [main repository](https://github.com/SilentTransfer/silenttransfer)
- Follow the installation guide in the root `README`
- Run API + web locally (Node 20+, Python 3.11+)
- Read `docs/PRIVACY_STATUS.md` before making privacy claims in forks or integrations
- Review `SECURITY.md` for reporting practices

## Project status and roadmap

**Live (testnet console)** — Private send / receive flow with real on-chain funding to one-time addresses · claim path · scanner · transactions · analytics · docs · **sthood** tokenomics page · honest partial-privacy labeling.

**Building** — Stronger client-held claim keys · deeper ERC-5564 / ERC-6538 alignment · batch 1→many private send · paymaster / gasless claim UX · privacy score backed by real signals · SDK polish.

**Future** — Mainnet settlement with full operator hardening · multi-chain · optional stronger unlinkability layers where product and compliance allow · audits and production checklist completion.

## Explore SilentTransfer

- **Website:** [https://silenttransfer.com](https://silenttransfer.com)
- **Documentation:** [https://silenttransfer.com/docs](https://silenttransfer.com/docs)
- **Protocol (sthood):** [https://silenttransfer.com/silent](https://silenttransfer.com/silent)
- **sthood CA:** `0x01f44ADdf4af1DB2d9016a4992FFef5163648c0a`
- **Main Repository:** [https://github.com/SilentTransfer/silenttransfer](https://github.com/SilentTransfer/silenttransfer)
- **Organization:** [https://github.com/SilentTransfer](https://github.com/SilentTransfer)

---

<p align="center">
  <small>&copy; 2026 SilentTransfer · Protocol asset sthood</small>
</p>
