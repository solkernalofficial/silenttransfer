# SilentTransfer roadmap

**Product:** [silenttransfer.com](https://silenttransfer.com)  
**Last updated:** July 2026  
**Network (current):** Robinhood Chain Testnet (`46630`)

Intentions, not delivery dates. Status labels are honest: **Live**, **Next**, **Later**.

Related: [PRIVACY_STATUS.md](./PRIVACY_STATUS.md) · [PRIVACY_DISCLAIMER.md](./PRIVACY_DISCLAIMER.md)

---

## Product vision

Private transfer infrastructure for public blockchains.

**Primary UX:** deposit into a wallet-bound private vault → send single or batch anytime → recipients receive automatically (no claim site). Built so payouts are **harder to trace** than a plain public A→B send—not absolute untraceability.

---

## Live now (testnet)

| Item | Status | Notes |
|------|--------|--------|
| Private vault (`SilentUserVault`) | **Live** | Wallet-bound balance; deposit then withdraw |
| Single send from vault | **Live** | Any 0x recipient; auto-receive |
| Batch send (1 → many) | **Live** | Multi-line payout from vault balance |
| Wallet as key | **Live** | No local note backup for vault path |
| Recipient no website | **Live** | Funds land in normal wallets |
| Console + landing + docs | **Live** | English, international product copy |
| $SILENT token (1B hard cap) | **Live (testnet)** | Community-majority policy; 0% VC |
| Shield pool (advanced) | **Live (testnet / staged)** | Notes + Merkle; not production Groth16 |
| ERC-5564 stealth modules | **Available (advanced)** | Optional; not primary UX |

---

## Next

| Item | Goal |
|------|------|
| Stronger unlinkability | Delayed and fixed-size payout patterns; amount/timing hygiene |
| Shared anonymity sets | Larger batch surfaces so vault withdrawals blend better |
| Shield pool maturity | Production-grade ZK path when ceremony and product scope allow |
| Payroll / treasury scheduling | Recurring private batch payouts for operators |

---

## Later

| Item | Goal |
|------|------|
| Mainnet production path | Audited contracts, hardened ops—**not claimed today** |
| External security audit | Before public mainnet TVL claims |
| On-chain vesting locks | When allocation lock contracts ship |
| Multi-chain expansion | Only after primary path is stable |

---

## Explicitly not claimed

- Absolute untraceability / “invisible forever”
- Production Groth16 ceremony complete
- Formal mainnet audit complete
- Exchange listings or market price
- Identity / KYC product surface

---

## Phases (summary)

1. **Foundation (done on testnet)** — private vault, auto-receive, batch, honest docs  
2. **Unlinkability** — delays, fixed sizes, stronger anonymity sets  
3. **Deep privacy** — mature shield / ZK where product needs it  
4. **Production** — audit, mainnet, multi-chain only when ready  

---

*Update this file when a status label changes. Mirror key points on the website roadmap and root README.*
