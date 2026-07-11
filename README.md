# SilentTransfer

**Private transfer infrastructure for public blockchains.**

Deposit into a wallet-bound **private vault**, then pay any address—single or batch, any time. Recipients receive ETH in their normal wallet automatically (**no claim site**, no app for the receiver). Built so payouts are **harder to trace** than a plain public A→B send.

| | |
|--|--|
| Product | [silenttransfer.com](https://silenttransfer.com) |
| Docs | [silenttransfer.com/docs](https://silenttransfer.com/docs) |
| Organization | [github.com/SilentTransfer](https://github.com/SilentTransfer) |
| X | [x.com/silenttransfer](https://x.com/silenttransfer) |
| Protocol asset | **SILENT** (1B hard cap · 0% VC) |
| Network (current) | Robinhood Chain Testnet (`46630`) |
| License | See `LICENSE` |

> **Honesty:** Vault deposit and send move **real** ETH on testnet. Privacy is **untraceable-oriented**, not absolute—amounts, timing, and vault interactions on a public chain can still be analyzed. See [`docs/PRIVACY_STATUS.md`](./docs/PRIVACY_STATUS.md).

---

## Why SilentTransfer

| Problem | Our approach |
|---------|----------------|
| Plain A→B is forever public | Payouts leave a **private vault**, not a one-shot send from your hot wallet |
| Claim portals kill adoption | Recipients **never open the site**—funds land automatically |
| Notes and backups fail | **Connected wallet is the key** for vault balance |
| Fake “full anonymity” marketing | Docs state **what is private today and what is not** |

---

## Primary product flow

```text
A connects wallet
  → deposits ETH into SilentUserVault (wallet-bound balance)
  → later: single or batch withdraw to B / C / …
  → recipients receive in normal wallets (no website, no claim)
  → A's connected wallet is the key (no local note backup)
```

**Optional / advanced (not primary UX):** ERC-5564 stealth path, shield pool (ZK-style notes). See console advanced tabs and docs.

---

## Roadmap

Full detail: [`docs/ROADMAP.md`](./docs/ROADMAP.md) · also on the [website](https://silenttransfer.com/#roadmap).

### Live (testnet)

- Private vault — deposit, wallet-bound balance  
- Single and **batch** send from vault  
- **Auto-receive** for recipients (no claim)  
- Wallet as key · minimal console · honest docs  
- $SILENT (1B hard cap, community-majority)  
- Shield pool & stealth modules available as advanced tooling  

### Next

- Stronger unlinkability (delayed / fixed-size payouts)  
- Larger shared anonymity sets for withdrawals  
- Shield pool maturity (production ZK when ready)  
- Payroll / treasury scheduling for recurring batches  

### Later

- Mainnet production path + **external audit** (not claimed today)  
- On-chain vesting locks  
- Multi-chain expansion after primary path is stable  

### Not claimed

Absolute untraceability · production Groth16 complete · audited mainnet TVL · exchange listings · identity product

---

## Repository layout

```
apps/
  api/          # FastAPI backend
  web/          # Next.js console + marketing site
contracts/      # Solidity (Hardhat): SilentUserVault, SilentToken, shield, stealth
docs/           # Privacy status, roadmap, architecture, security
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
# NEXT_PUBLIC_API_URL → API (default http://localhost:8001)
# NEXT_PUBLIC_USER_VAULT_ADDRESS → SilentUserVault on testnet
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
| `testnet` | Public testnet contracts + RPC (**current default**) |
| `mainnet` | Production (operator login disabled) |

Staged paymasters and simulation flags are intentional—not a claim of full mainnet settlement.

---

## Security

- **Never commit** `.env`, `contracts/.env`, private keys, or database files.
- Public contract addresses are safe to publish (they are on-chain).
- See [SECURITY.md](./SECURITY.md) and [`docs/SECURITY_MODEL.md`](./docs/SECURITY_MODEL.md).

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

| Doc | Purpose |
|-----|---------|
| [docs/ROADMAP.md](./docs/ROADMAP.md) | Live / next / later roadmap |
| [docs/PRIVACY_STATUS.md](./docs/PRIVACY_STATUS.md) | Copy-safe privacy claims |
| [docs/PRIVACY_DISCLAIMER.md](./docs/PRIVACY_DISCLAIMER.md) | Legal / user responsibility |
| [docs/SECURITY_MODEL.md](./docs/SECURITY_MODEL.md) | Threat model notes |
| In-app `/docs` | Operator-facing product docs |
| `/silent` | $SILENT overview |

---

## Tokenomics (summary)

| Allocation | Share |
|------------|-------|
| Community | **90%** |
| Protocol (ops) | **10%** |
| Team (separate pool) | **0%** |
| Venture capital | **0%** |

Hard cap: **1B SILENT** (contract-enforced). Vault deposit may charge an on-chain protocol fee. Planned sponsored-flow fee **0.5%** for protocol operations and open-market buybacks.

---

## What this repository is not

- Not affiliated with Robinhood Markets, Inc. (testnet RPC is an infrastructure choice).
- Not a guarantee of absolute untraceability, production mainnet settlement, audits, or listings.
- Not a place for private keys or production credentials.
- Not an identity product—focus is **private transfer mechanics**.

---

## License

See `LICENSE`.
