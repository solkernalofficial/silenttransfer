# Privacy status — what is private now vs fuller privacy

**Product:** SilentTransfer (silenttransfer.com)  
**Last updated:** July 2026  
**Network (current):** Robinhood Chain Testnet (chain `46630`)

This is the honest product/docs summary for users, partners, and marketing.  
Related: [PRIVACY_DISCLAIMER.md](./PRIVACY_DISCLAIMER.md), [SECURITY_MODEL.md](./SECURITY_MODEL.md).

---

## One-line truth

SilentTransfer offers three privacy paths on a **public** chain:

1. **ZK shielded pool:** fixed-denomination notes (commitments + nullifiers + Merkle tree). Deposit shields ETH; withdraw unshields to any address. Testnet uses Merkle-witness proofs; production upgrades to Groth16 path-hiding.
2. **Vault private transfer:** A deposits into SilentVault (amount + fee); B/C/D paid **from the vault** (recipient does not see A on receive leg). Batch 1→many.
3. **ERC-5564 stealth send:** recipient-bound one-time addresses when Receive is enabled.

**Do say:** shielded notes · nullifiers · vault payout · batch B/C/D  
**Don’t say:** production Groth16 ceremony complete · untraceable forever · deposit invisible to chain analysts

---

## How the live send path works (today) — private A→B stealth

```text
B registers meta-address (spend pub + view pub) — private keys stay in B's browser
A looks up B's pubs → ECDH derives stealth address S (only B can recompute spend key)
A funds S on-chain → announce (ephemeral pubkey R, no claim_private_key)
B scans with viewing key → derives spend key → claims S → B
```

1. **B** enables **Receive**: real secp256k1 spending + viewing keypairs (client vault); only **public** keys to API / optional ERC-6538 registry.
2. **A** enters B’s wallet on **Send**: app loads B’s meta-address, runs **ERC-5564 ECDH**, funds the derived stealth address (real ETH).
3. Announce stores ephemeral pubkey for scan — **no server spend key, no claim code from A**.
4. **B** opens **Scanner** on the browser that holds the Receive vault → ECDH match → **Relayer** claim with derived key.

Legacy paths (random one-time EOA + client claim code, batch with claim codes) still exist for multi-send / older flows.

Chain explorers still show public funding txs. **Sender address and amount remain visible.**

---

## Now vs fuller privacy (5 points)

### 1) Recipient address on the funding tx

| | |
|--|--|
| **Now** | Funding goes to an **ERC-5564-derived stealth address** from B’s meta-keys. Casual viewers don’t see “ETH arrived on Bob’s main address” until claim. Only B’s viewing/spending keys can detect/spend. |
| **Fuller privacy** | On-chain messenger as sole discovery; no optional `to_address` hint in API metadata at all. |

### 2) Link between sender and recipient

| | |
|--|--|
| **Now** | Weaker than plain A→B. Still linkable by: public funding + claim txs, **amount + timing**, and anyone with **API access**. |
| **Fuller privacy** | No server-held claim key; client-only scan/spend keys; optional delays; reduce amount fingerprinting; longer-term: stronger unlinkability / mixing / ZK where product needs it. |

### 3) Who can see the full story

| | |
|--|--|
| **Now** | **Blockchain:** sender, one-time address, amounts, claim path. **API:** sender, intended `to`, amount, stealth (discovery). **Default claim_mode=client:** no long-lived server-held spend key (key only presented at claim by client). Legacy `claim_mode=server` still optional. |
| **Fuller privacy** | API becomes a thin relay / optional indexer: viewing-key-only discovery (no plain `to_address`); recipients control viewing/spending keys; minimize stored payment graph. |

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

1. **Batch private transfer (1 → many)** — ✅ **Live** (`Batch send`): still one-time EOAs + client claim codes (not full ECDH per line yet).
2. **Client-held spend path** — ✅ **Live** for legacy/batch claim codes.
3. **Private A→B (ERC-5564 ECDH)** — ✅ **Default Send path**: meta-address → ECDH stealth → fund → viewing-key scan → derive claim. No claim code from sender.
4. **ERC-6538 on-chain register** — ✅ optional button on Receive; registry/messenger addresses on testnet env.
5. **SilentPrivateSend contract** — ✅ compiled/tested (atomic fund+announce); deploy when wiring `NEXT_PUBLIC_PRIVATE_SEND_ADDRESS`.
6. **Amount / sender privacy (ZK shield)** — ❌ not live (public chain limits).
7. **Public responses strip secrets** — ✅
8. **UX privacy hygiene** — ✅

Until ZK / amount privacy ships, do **not** market as fully shielded cash.

---

## Quick FAQ

**Is it really private?**  
Partially. Better than a normal send for recipient discovery; **not** full anonymity.

**Can SilentTransfer staff see who sent to whom?**  
With the **current** funded path: the **API can** see intended parties and amounts (discovery metadata). Default client-held mode means staff **cannot** recover the one-time spend key from the DB after announce. Treat the backend as trusted for the payment graph, not as a cold-storage vault for claim keys.

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
| Cryptographic private A→B (ERC-5564) | Yes (default Send) |
| Hide recipient until claim (casual) | Yes (stealth address) |
| Only B can derive spend key | Yes (ECDH + vault) |
| Hide spend key from server | Yes (stealth mode) |
| Hide payment graph from API operator | Partial (optional to_address hint; amounts logged) |
| Hide from chain analysts | No (funding+claim linkable) |
| Hide sender | No |
| Hide amount | No |
| Batch 1→many | Yes (legacy claim-code path) |
| Full ZK / shielded pool | No |

---

*Update this file when amount/sender shielding or pure on-chain discovery ships.*
