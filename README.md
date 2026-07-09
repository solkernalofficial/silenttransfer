# SilentTransfer

**Private transfer infrastructure for public blockchains.**

SilentTransfer provides a professional console and API for private receive, private transfer, payment discovery, and sponsored settlement—without KYC in the product path. The protocol asset is **SILENT** (hard-capped at 1,000,000,000).

| | |
|--|--|
| Product | SilentTransfer |
| Protocol asset | SILENT (1B hard cap, 0% VC allocation) |
| Primary network (current) | Robinhood Chain Testnet (`46630`) |
| License | See repository (add `LICENSE` as needed) |

---

## Repository layout

```
apps/
  api/          # FastAPI backend
  web/          # Next.js console + marketing site
contracts/      # Solidity (Hardhat): SilentToken, registry, messenger, paymaster
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
npx hardhat run scripts/deploy-silent.js --network robinhoodTestnet
```

---

## Environment model

| `ENVIRONMENT` | Purpose |
|---------------|---------|
| `demo` | Local synthetic workflow |
| `testnet` | Public testnet contracts + RPC (current default target) |
| `mainnet` | Production (operator login disabled) |

Settlement may still be **simulated** on testnet until an ERC-4337 bundler is configured (`SIMULATE_SETTLEMENT=true`). That is intentional and documented—not a claim of full mainnet settlement.

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
- Additional markdown: `docs/`

---

## Tokenomics (summary)

| Allocation | Share |
|------------|-------|
| Community | 60% |
| Foundation / Protocol (locked policy) | 35% |
| Team (vesting policy) | 15% |
| Venture capital | **0%** |

Hard cap: **1B SILENT** (contract-enforced). Fees currently **0%**; planned sponsored-claim fee **0.5%** for protocol operations and open-market buybacks.

---

## What this repository is not

- Not affiliated with Robinhood Markets, Inc. (network RPCs may target Robinhood Chain testnet as an infrastructure choice).
- Not a guarantee of production mainnet settlement, audits, or exchange listings.
- Not a place for private keys or production credentials.

---

## License

Add an open-source license file (e.g. MIT) before publishing if you intend others to reuse the code.
