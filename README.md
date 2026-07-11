# SilentTransfer

**Private transfer infrastructure for public blockchains.**

SilentTransfer provides a console and API for **private vault payouts** that are harder to trace than a plain public send: deposit into a wallet-bound vault, then pay any address—single or batch, any time. Recipients receive ETH in their wallet automatically (no claim site). The protocol asset is **SILENT** (hard-capped at 1,000,000,000).

| | |
|--|--|
| Product | [SilentTransfer](https://silenttransfer.com) |
| Organization | [github.com/SilentTransfer](https://github.com/SilentTransfer) |
| X | [x.com/silenttransfer](https://x.com/silenttransfer) |
| Protocol asset | SILENT (1B hard cap, 0% VC allocation) |
| Primary network (current) | Robinhood Chain Testnet (`46630`) |
| Live console | [silenttransfer.com](https://silenttransfer.com) · [Docs](https://silenttransfer.com/docs) |
| License | See `LICENSE` |

> **Honesty:** On testnet, vault deposit and send move **real** ETH on-chain. The product is built for **untraceable-oriented** private payouts (break the public A→B path; receivers need no app). Privacy is **not absolute**—amounts, timing, and vault interactions on a public chain can still be analyzed. See `docs/PRIVACY_STATUS.md`.

---

## Primary product flow

```text
A connects wallet
  → deposits ETH into SilentUserVault (wallet-bound balance)
  → later withdraws any amount, single or batch, to B / C / …
  → recipients receive in their normal wallets (no website, no claim)
  → A's connected wallet is the key (no local note backup)
```

Advanced / optional paths (stealth ERC-5564, shield pool) exist in the repo and console under advanced tabs—documented separately, not oversold as default UX.

---

## Repository layout

```
apps/
  api/          # FastAPI backend
  web/          # Next.js console + marketing site
contracts/      # Solidity (Hardhat): SilentUserVault, SilentToken, shield, stealth
docs/           # Technical documentation
docker-compose.yml
```

---

## Quick start (local)

### Prerequisites

- Node.js 20+
- Python 3.11+
- Optional: Docker for Postgres

### 1. API

```bash
cd apps/api
python -m venv venv
# Windows: .\venv\Scripts\activate
# macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
copy .env.example .env   # or cp .env.example .env
# Edit .env — set JWT_SECRET and contract addresses as needed
uvicorn src.main:app --host 127.0.0.1 --port 8001
```

### 2. Web

```bash
cd apps/web
npm install
copy .env.example .env.local   # or cp .env.example .env.local
# Point NEXT_PUBLIC_API_URL at the API (default http://localhost:8001)
# Set NEXT_PUBLIC_USER_VAULT_ADDRESS for private vault
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 3. Contracts (optional)

```bash
cd contracts
npm install
copy .env.example .env
# Set DEPLOYER_PRIVATE_KEY only in local .env — never commit it
npx hardhat test
npx hardhat run scripts/deploy-user-vault.js --network robinhoodTestnet
```

---

## Environment model

| `ENVIRONMENT` | Purpose |
|---------------|---------|
| `demo` | Local synthetic workflow |
| `testnet` | Public testnet contracts + RPC (current default target) |
| `mainnet` | Production (operator login disabled) |

Settlement simulation flags and staged paymasters are intentional and documented—not a claim of full mainnet settlement.

---

## Security

- **Never commit** `.env`, `contracts/.env`, private keys, or database files.
- Public contract addresses are safe to publish (they are on-chain).
- See [SECURITY.md](./SECURITY.md) for reporting and practices.
- Before any public push, run the secret preflight script (see below).

### Preflight (secrets check)

```powershell
# Windows PowerShell (from repo root)
.\scripts\preflight-public.ps1
```

```bash
# Git Bash / macOS / Linux
bash scripts/preflight-public.sh
```

Do not push if the script reports failures.

---

## Documentation

- In-app docs: `/docs` (intended production host: `docs.silenttransfer.com`)
- Protocol asset: `/silent`
- Privacy status (copy-safe claims): `docs/PRIVACY_STATUS.md`
- Additional markdown: `docs/`

---

## Tokenomics (summary)

Community-majority fair launch design:

| Allocation | Share |
|------------|-------|
| Community | **90%** |
| Protocol (ops) | **10%** |
| Team (separate pool) | **0%** |
| Venture capital | **0%** |

Hard cap: **1B SILENT** (contract-enforced). Product fees are environment-dependent; vault deposit may charge an on-chain protocol fee. Planned sponsored-flow fee **0.5%** for protocol operations and open-market buybacks.

---

## What this repository is not

- Not affiliated with Robinhood Markets, Inc. (network RPCs may target Robinhood Chain testnet as an infrastructure choice).
- Not a guarantee of absolute untraceability, production mainnet settlement, audits, or exchange listings.
- Not a place for private keys or production credentials.
- Not an identity or onboarding product—focus is private transfer mechanics.

---

## License

See `LICENSE` (or add an open-source license before publishing if you intend others to reuse the code).
