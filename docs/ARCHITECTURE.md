# Architecture — SilentTransfer

## High-Level Overview

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                        User Wallet                          │
                    │              (MetaMask, WalletConnect, etc.)                │
                    └──────────┬────────────────────────────────┬─────────────────┘
                               │                                │
                    SIWE Auth  │                       Sign txs  │
                    (EIP-4361) │                          via   │
                               │                       ethers   │
                               ▼                                ▼
                    ┌──────────────────┐           ┌──────────────────────┐
                    │   Frontend       │           │   Smart Contracts    │
                    │   (apps/web)     │──────────►│   (contracts/)       │
                    │   Next.js +      │   read     │   StealthRegistry    │
                    │   wagmi + viem   │   /write   │   StealthMessenger   │
                    └────────┬─────────┘           │   StealthPaymaster   │
                             │                     └──────────────────────┘
                             │ REST API                         │
                             ▼                                  │
                    ┌──────────────────┐                        │
                    │   API Backend    │◄───────────────────────┘
                    │   (apps/api)     │   ethers.js / web3
                    │   FastAPI +      │
                    │   PostgreSQL     │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   PostgreSQL     │
                    │   Database       │
                    │   (users,        │
                    │    registrations,│
                    │    announcements,│
                    │    relays)       │
                    └──────────────────┘
```

## Repository Structure

```
silenttransfer/
├── apps/
│   ├── web/              # Next.js frontend application
│   │   ├── src/
│   │   │   ├── app/      # Next.js App Router pages
│   │   │   ├── components/  # React components
│   │   │   ├── hooks/    # Custom React hooks (wagmi, auth)
│   │   │   ├── lib/      # Utility functions, API client
│   │   │   └── styles/   # Tailwind CSS, global styles
│   │   ├── public/       # Static assets
│   │   ├── next.config.js
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   └── api/              # FastAPI backend
│       ├── app/
│       │   ├── api/      # Route handlers
│       │   ├── core/     # Config, security, dependencies
│       │   ├── models/   # SQLAlchemy ORM models
│       │   ├── schemas/  # Pydantic request/response schemas
│       │   └── services/ # Business logic
│       ├── alembic/      # Database migrations
│       ├── tests/        # Pytest test suite
│       ├── Dockerfile
│       └── requirements.txt
├── contracts/            # Solidity smart contracts
│   ├── contracts/
│   │   ├── StealthRegistry.sol
│   │   ├── StealthMessenger.sol
│   │   ├── StealthPaymaster.sol
│   │   └── interfaces/
│   ├── test/
│   ├── hardhat.config.ts
│   └── package.json
├── packages/
│   └── sdk/             # TypeScript SDK (placeholder)
│       ├── src/
│       └── package.json
├── docs/                # Documentation
├── docker-compose.yml
├── .env.example
└── README.md
```

## Core Architecture Decisions

### Monorepo with Turborepo (optional)
The repository is structured as a monorepo with four main areas: frontend, API, smart contracts, and SDK. This enables shared types, unified CI, and simplified dependency management.

### Frontend: Next.js + wagmi + viem
- **Next.js** provides server-side rendering for SEO-sensitive pages and static generation for the dashboard.
- **wagmi** handles wallet connection state management, chain switching, and transaction signing.
- **viem** provides type-safe, tree-shakeable Ethereum interaction without the overhead of ethers.js.
- SIWE (Sign-In with Ethereum) is implemented using the `siwe` npm package, enabling wallet-based authentication.

### API: FastAPI + SQLAlchemy + PostgreSQL
- **FastAPI** offers async-first request handling, automatic OpenAPI documentation, and Pydantic-based validation.
- **SQLAlchemy** provides ORM abstraction over PostgreSQL, ensuring SQL injection safety.
- **Alembic** manages database schema migrations.
- The API serves as a thin coordination layer: it authenticates users, records registrations and announcements, and coordinates with smart contracts for on-chain operations.

### Smart Contracts: Solidity + Hardhat + OpenZeppelin
- **Hardhat** provides the development environment, testing framework, and deployment tooling.
- **OpenZeppelin** contracts provide audited implementations of Ownable, ReentrancyGuard, Pausable, and ERC-165 interfaces.
- Three core contracts implement the stealth address protocol:
  - `StealthRegistry` — ERC-6538 compatible stealth meta-address registry
  - `StealthMessenger` — ERC-5564 compatible announcement emitter
  - `StealthPaymaster` — ERC-4337 paymaster for gasless stealth withdrawals

## Data Flow

### Stealth Address Lifecycle

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Register │────►│ Announce │────►│   Scan   │────►│  Relayer │
│  (1)      │     │  (2)     │     │  (3)     │     │  (4)     │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

1. **Register (Setup):** Alice generates a spending key pair and a viewing key pair. She registers the public components (stealth meta-address) on-chain via the Registry contract. The API records the registration for off-chain indexing.

2. **Announce (Send):** Bob wants to send tokens to Alice privately. He uses Alice's registered stealth meta-address to derive a one-time stealth address. He emits an encrypted announcement on-chain via the Messenger contract. The API indexes the announcement.

3. **Scan (Receive):** Alice scans on-chain announcements using her viewing private key. She can determine which announcements are intended for her without revealing which ones she can decrypt. The API provides an indexed scan endpoint.

4. **Relayer (Spend):** Alice uses the Relayer (paymaster) to withdraw funds from the stealth address without holding native tokens for gas. The paymaster sponsors the transaction, deducting gas costs from the withdrawn amount or a separate fee token.

## Security Model

See [SECURITY_MODEL.md](SECURITY_MODEL.md) for the detailed security and privacy analysis.

At the architectural level:
- **No private keys in the database** — only public keys and Ethereum addresses are stored.
- **Authentication via SIWE** — users prove wallet ownership without revealing private keys.
- **Smart contract access control** — Ownable + RBAC for privileged operations.
- **API security** — rate limiting, CORS allowlist, Pydantic validation, security headers.
- **Database security** — ORM-parameterized queries prevent SQL injection.
