# Privacy status — what is private now vs fuller privacy

**Product:** SilentTransfer (silenttransfer.com)  
**Last updated:** July 2026  
**Network (current):** Robinhood Chain Testnet (chain `46630`)

This is the honest product/docs summary for users, partners, and marketing.  
Related: [PRIVACY_DISCLAIMER.md](./PRIVACY_DISCLAIMER.md), [SECURITY_MODEL.md](./SECURITY_MODEL.md).

---

## One-line truth

SilentTransfer offers **untraceable-oriented private transfers** on a **public** chain—harder to map as a plain A→B payment—not absolute anonymity.

Primary live path:

1. **Private vault (primary UX):** A deposits into `SilentUserVault`. Balance is wallet-bound (connected wallet is the key). A later sends single or batch amounts to any addresses. Recipients receive ETH automatically—**no website, no claim, no note backup**.
2. **ZK shield pool (advanced):** Fixed-denomination notes (commitments + nullifiers + Merkle tree). Testnet uses Merkle-witness proofs; production Groth16 path-hiding is **not** claimed complete.
3. **ERC-5564 stealth (advanced):** Recipient-bound one-time addresses when Receive is enabled.

**Do say:** private vault · harder to trace than plain send · break public A→B path · auto-receive · batch payout · wallet as key  
**Don’t say:** untraceable forever · invisible to all chain analysts · production Groth16 complete · full anonymity · identity / KYC theater as the product pitch

---

## How the live primary path works (today) — private vault

```text
A connects wallet W
  → deposits ETH into SilentUserVault (balanceOf[W] increases; fee may apply)
  → later: withdraw / withdrawMany to B, C, …
  → B/C receive ETH in their normal wallets (auto)
  → no claim site, no local notes — W is the key
```

1. **A** opens the console, connects wallet, deposits into the vault.
2. **A** sends any amount (or many lines) from vault balance whenever they choose.
3. **B** never visits SilentTransfer; funds appear in B’s wallet.
4. Public explorers still show deposit and withdraw transactions on the vault contract.

Splitting amounts over time and paying from the vault (not A’s everyday wallet) weakens simple A→B heuristics. **Amount + timing correlation remains a residual risk.**

---

## Now vs fuller privacy (5 points)

### 1) Recipient experience

| | |
|--|--|
| **Now** | Auto-receive. No claim portal. No app for B. |
| **Fuller privacy** | Optional delayed payout windows, fixed denominations, multi-hop routing. |

### 2) Link between sender and recipient

| | |
|--|--|
| **Now** | Weaker than plain A→B: funds leave vault, not A’s hot wallet on the receive leg. Still linkable by vault deposit/withdraw graph, **amount + timing**, and shared pool analysis. |
| **Fuller privacy** | Batch anonymity sets, fixed sizes, delays, ZK shield between deposit and withdraw. |

### 3) Who can see the full story

| | |
|--|--|
| **Now** | **Blockchain:** depositors, vault, withdraw recipients, amounts. **API:** SIWE sessions and optional advanced announce paths. Vault balance is on-chain by wallet. |
| **Fuller privacy** | Minimize operator-visible payment graphs; viewing-key-only discovery for stealth paths. |

### 4) Sender privacy & amounts

| | |
|--|--|
| **Now** | Deposit wallet and amounts are public on-chain. Vault separates payout leg from A’s direct send to B. |
| **Fuller privacy** | Shield pool / ZK amount hiding (staged; not production-claimed). |

### 5) After receive

| | |
|--|--|
| **Now** | Funds sit on **B’s normal wallet**—public balance and future spends are normal chain visibility. |
| **Fuller privacy** | Education on withdrawal hygiene; optional spend-from-stealth without consolidating to a known CEX deposit. |

---

## Honest feature labels (copy-safe)

| Feature | Safe label | Avoid |
|---------|------------|--------|
| Private vault | Private vault / vault payout | “Invisible cash” |
| Auto receive | Recipients receive automatically | “Untraceable claim” (there is no claim) |
| Harder to trace | Harder to trace than plain A→B | “Untraceable forever” |
| Batch send | Batch private payout | “Perfect anonymity set” without proof |
| Shield pool | Testnet shield notes | “Production Groth16 complete” |
| Stealth (advanced) | ERC-5564 optional path | Sole product pitch if vault is primary |

**Positioning note:** SilentTransfer is a **privacy transfer** product. Marketing should center **untraceable-oriented payouts** and vault UX—not identity onboarding. Do not lead with KYC as a feature or anti-feature; identity collection is simply out of product scope.

---

## Roadmap sketch (fuller privacy)

Canonical product roadmap: **[ROADMAP.md](./ROADMAP.md)** (Live / Next / Later). Website: silenttransfer.com/#roadmap.

1. **Private vault (deposit → single/batch send)** — ✅ **Live** (primary console tab).
2. **Auto-receive (no claim for B)** — ✅ **Live** for vault path.
3. **Wallet-as-key (no note backup)** — ✅ **Live** for `SilentUserVault`.
4. **Stronger unlinkability** — 🚧 Next: delayed / fixed-size payout patterns.
5. **Shield pool ZK maturity** — 🚧 Next: testnet pool exists; production ceremony not claimed.
6. **ERC-5564 / ERC-6538 advanced path** — optional tooling in repo.
7. **External audit before mainnet TVL claims** — ❌ Later: not claimed.

Until production ZK / strong anonymity sets ship, do **not** market as fully shielded cash or absolute untraceability.

---

## Quick FAQ

**Is it really private / untraceable?**  
Harder to trace than a normal public send when used as designed (vault + split timing). **Not** absolute anonymity.

**Does B need the website?**  
**No** on the private vault path.

**Can a blockchain analyst link deposit and withdraw?**  
Often **yes**, especially with unique amounts and close timing.

**Is the chain private?**  
No. Public ledger remains public.

**Is this for hiding crime?**  
Product is for legitimate private transfer UX. Users must follow local law (AML/tax/sanctions). See [PRIVACY_DISCLAIMER.md](./PRIVACY_DISCLAIMER.md).

---

## Scorecard (current live testnet path)

| Goal | Today |
|------|--------|
| Better than plain MetaMask A→B | Yes (vault path) |
| B never opens the site | Yes (vault path) |
| Wallet as key / no note backup | Yes (`SilentUserVault`) |
| Batch 1→many | Yes |
| Absolute untraceability | No |
| Hide amount / full ZK production | No |
| Formal mainnet audit | No |

---

*Update this file when stronger unlinkability or production ZK ships.*
