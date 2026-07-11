# Security Policy — SilentTransfer

## Overview

SilentTransfer is designed around a **privacy-first, defense-in-depth** security model. The system leverages stealth address patterns (ERC-5564 / ERC-6538 style), optional account-abstraction settlement paths, and a professional operations console. This document outlines security principles, threat considerations, and reporting.

## Public repository rules

- Never commit `.env`, `contracts/.env`, private keys, or local databases.
- Before publishing, run `scripts/preflight-public.ps1` or `scripts/preflight-public.sh`.
- See `docs/PUBLIC_RELEASE.md` for the full release checklist.

## Private Key Handling

- **Default private send does not store claim spend keys.** Announce verifies the one-time key then discards it (`claim_mode=client`). Legacy `claim_mode=server` may hold a key until claim. Public addresses and meta-addresses (spending/viewing pubkeys) are stored as designed.
- The relayer private key used for gas sponsorship lives exclusively in the `API_RELAYER_PRIVATE_KEY` environment variable and is never persisted to disk outside `.env`.
- Users always maintain full custody of their own private keys. The system never requests or stores user private keys.
- Spending and viewing key pairs are generated client-side in the browser. Only the public components are submitted to the API during registration.

## Authentication

- The system uses **Sign-In with Ethereum (SIWE)** according to [EIP-4361](https://eips.ethereum.org/EIPS/eip-4361).
- Users authenticate by signing a structured message with their Ethereum wallet (e.g., MetaMask, WalletConnect).
- The API verifies the signature, issues a short-lived JWT, and uses that JWT for subsequent authenticated requests.
- Session tokens expire and must be refreshed by re-authenticating via SIWE.

## Smart Contract Security

- All contracts inherit from **OpenZeppelin** audited base implementations:
  - `Ownable` — contract admin controls.
  - `ReentrancyGuard` — protection against re-entrancy attacks.
  - `Pausable` — emergency pause mechanism.
- **Role-based access control (RBAC)** is enforced for privileged operations (e.g., oracle submissions, paymaster operations).
- The Registry contract validates stealth meta-addresses before registration.
- The Messenger contract enforces nonce ordering and replay protection.
- The Paymaster contract validates UserOperation signatures before sponsoring gas.

## API Security

- **Rate limiting:** Per-IP and per-wallet rate limits are enforced at the API layer (default: 60 requests/minute). Configurable via `API_RATE_LIMIT_PER_MINUTE`.
- **CORS allowlist:** Cross-Origin requests are restricted to origins specified in `API_CORS_ORIGINS`. No wildcard origins in production.
- **Security headers:** The API sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, and `Strict-Transport-Security` headers on all responses.
- **Input validation:** All request bodies are validated using **Pydantic models** with strict type enforcement. Unexpected fields are rejected (forbid extras).
- **SQL injection prevention:** All database queries use SQLAlchemy ORM parameterized queries. Raw SQL is never constructed via string interpolation.
- **Environment validation:** On startup, the API validates that all required environment variables are present and that critical values (JWT secret, CORS origins) meet minimum security requirements.

## Database Security

- The application uses **SQLAlchemy ORM** exclusively, eliminating the risk of SQL injection through parameterized query building.
- Database credentials are provided via `API_DATABASE_URL` and should use a dedicated PostgreSQL user with least-privilege access.
- In production, the database should be accessible only from the application server's IP (private networking where possible).
- Connection encryption (TLS) should be enabled for all database connections in production environments.

## Reporting a Vulnerability

If you discover a security vulnerability in SilentTransfer, please report it privately by emailing **security@silenttransfer.com**.

Please do **not** disclose vulnerabilities publicly via GitHub issues or social media until we have had a reasonable window to address them. We aim to acknowledge receipt within 48 hours and provide a fix timeline within 5 business days.

## Known Security Considerations

### Metadata Leakage
Transaction metadata on a public blockchain (timestamps, gas amounts, interaction patterns) can be used for statistical analysis and potentially reduce privacy. This is an inherent limitation of public blockchain systems and not something the protocol can fully mitigate.

### IP Leakage
Standard RPC calls to Ethereum nodes leak the user's IP address. Users concerned about IP exposure should route traffic through a VPN, Tor, or use a decentralized RPC network.

### Timing Analysis
The timing between an announcement on-chain and a subsequent scan or withdrawal may reveal which stealth address belongs to which recipient. Users should consider batching operations or introducing randomized delays.

### Withdrawal Linkability
When funds are withdrawn from a stealth address back to a known address, the link between the stealth address and the recipient becomes visible on-chain. Withdrawing to a fresh address is recommended.

## Responsible Disclosure

We follow a coordinated disclosure process. Researchers who report valid security issues will be credited (with permission) in our release notes. We do not currently operate a formal bug bounty program but may offer discretionary rewards for critical findings.

---

*Last updated: 2026*
