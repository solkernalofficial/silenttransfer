# Privacy status — what is private now vs fuller privacy

**Product:** SilentTransfer (silenttransfer.com)  
**Last updated:** July 2026  
**Network (current):** Robinhood Chain Testnet (chain `46630`)

This is the honest product/docs summary for users, partners, and marketing.  
Related: [PRIVACY_DISCLAIMER.md](./PRIVACY_DISCLAIMER.md), [SECURITY_MODEL.md](./SECURITY_MODEL.md).

---

## One-line truth

SilentTransfer today is **privacy-oriented private transfer** on a **public** chain:  
better than a plain wallet-to-wallet send, **not** full anonymity (not ZK mixer grade).

**Do say:** one-time destination · reduced direct A→B link · no KYC product  
**Don’t say:** 100% private · untraceable · anonymous cash · “nobody can ever find out”

---

## How the live send path works (today)

```text
Sender wallet  --on-chain fund-->  one-time address (fresh EOA)
                                        |
                                   announce (API)
                                   (from, to, amount, claim material)
                                        |
Recipient claim  <--on-chain sweep--  same one-time address
```

1. Sender connects a real wallet and signs a **real** transfer to a **new one-time address**.
2. App records the payment for the intended recipient (`to`) via the API.
3. Recipient scans, then **claims** — funds move from the one-time address to their wallet.

Chain explorers still show public txs. The API is a **trusted operator** for claim material and routing metadata.

---

## Now vs fuller privacy (5 points)

### 1) Recipient address on the funding tx

| | |
|--|--|
| **Now** | Funding goes to a **fresh one-time address**, not the recipient’s public wallet. Casual viewers don’t see “ETH arrived on Bob’s main address” until claim. |
| **Fuller privacy** | True **ERC-5564** derivation from Bob’s registered meta-address so only Bob’s viewing key can detect the payment — no trusted “to_address” list required for correctness. |

### 2) Link between sender and recipient

| | |
|--|--|
| **Now** | Weaker than plain A→B. Still linkable by: public funding + claim txs, **amount + timing**, and anyone with **API access**. |
| **Fuller privacy** | No server-held claim key; client-only scan/spend keys; optional delays; reduce amount fingerprinting; longer-term: stronger unlinkability / mixing / ZK where product needs it. |

### 3) Who can see the full story

| | |
|--|--|
| **Now** | **Blockchain:** sender, one-time address, amounts, claim path. **API:** sender, intended `to`, amount, stealth, claim key (server-side). Frontend/user sessions as configured. |
| **Fuller privacy** | API becomes a thin relay / optional indexer: **no long-lived spend secrets**; recipients control viewing/spending keys; minimize stored PII and payment graph. |

### 4) Sender privacy & amounts

| | |
|--|--|
| **Now** | **No sender privacy.** Sender address and amount are visible on-chain on the funding transaction. |
| **Fuller privacy** | Separate product layer if needed (not claimed today): shielding, pools, or other amount/sender privacy tech — with legal/compliance review. |

### 5) After claim

| | |
|--|--|
| **Now** | Once claimed, funds sit on the **recipient’s normal wallet** — public balance and future spends are normal chain visibility. |
| **Fuller privacy** | Optional multi-hop, spend-from-stealth without consolidating to a known CEX deposit, user education on withdrawal hygiene (see disclaimer). |

---

## Honest feature labels (copy-safe)

| Feature | Safe label | Avoid |
|---------|------------|--------|
| One-time destination | Private transfer destination / one-time address | “Invisible transfer” |
| Live wallet send | Real on-chain private send (testnet) | “Off-chain only / fake” when funded |
| API announce | Payment discovery for recipient | “Decentralized-only discovery” |
| Claim | Sweep to recipient wallet | “Untraceable claim” |
| No KYC product | No product KYC | “Legal immunity / unregulated forever” |

---

## Roadmap sketch (fuller privacy)

Ordered roughly by impact / realism for this stack:

1. **Client-held spend path** — stop storing `claim_private_key` on the server; recipient derives or receives claim material out-of-band / via viewing key.
2. **Real ERC-5564 + ERC-6538 path** — register meta-address; ECDH stealth; scan with viewing key (align live path with [SECURITY_MODEL.md](./SECURITY_MODEL.md)).
3. **Public responses already strip secrets** — keep hardening: no claim keys in list/scan APIs; short-lived material only.
4. **UX privacy hygiene** — optional claim delay tips, don’t claim straight to CEX, VPN note for RPC IP.
5. **Harder unlinkability (later)** — amount obfuscation, decoys, or ZK/pool designs only if product + legal scope expand.

Until (1)–(2) ship, marketing and support should describe the **current live path** as in this document, not the ideal stealth paper model alone.

---

## Quick FAQ

**Is it really private?**  
Partially. Better than a normal send for recipient discovery; **not** full anonymity.

**Can SilentTransfer staff see who sent to whom?**  
With the **current** funded path: the **API can** see intended parties and amounts. Treat the backend as trusted.

**Can a blockchain analyst link send and claim?**  
Often **yes**, especially with unique amounts and close timing.

**Is the chain private?**  
No. Public ledger remains public.

**Is this illegal / for hiding crime?**  
Product is for legitimate private transfer UX. Users must follow local law (AML/tax/sanctions). See [PRIVACY_DISCLAIMER.md](./PRIVACY_DISCLAIMER.md).

---

## Scorecard (current live testnet path)

| Goal | Today |
|------|--------|
| Better than plain MetaMask A→B | Yes |
| Hide recipient until claim (casual) | Mostly |
| Hide from API operator | No |
| Hide from chain analysts | No |
| Hide sender | No |
| Hide amount | No |
| Full ZK / mixer privacy | No |

---

*Update this file when claim keys move off-server or full ERC-5564 send becomes the default live path.*
