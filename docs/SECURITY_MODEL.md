# Security & Privacy Model — SilentTransfer

This document describes the privacy guarantees, limitations, and threat model of the SilentTransfer protocol. It is intended for security researchers, integrators, and users who want to understand exactly what privacy the system provides and what it does not.

> **Live product vs target model:** The sections below describe the **target / protocol** stealth model (ERC-5564-shaped).  
> For an honest **“what ships today on testnet”** summary (server-assisted one-time addresses + claim), use **[PRIVACY_STATUS.md](./PRIVACY_STATUS.md)**.

---

## How Stealth Addresses Work

SilentTransfer’s **protocol design** follows **ERC-5564** (Stealth Addresses) and **ERC-6538** (Stealth Meta-Address Registry) to enable private token transfers on public blockchains.

### Key Generation

Each user generates two key pairs:

- **Spending key pair** (`(s, S)`): Used to control funds at a stealth address. `s` is the private spending key, `S` is the public spending key.
- **Viewing key pair** (`(v, V)`): Used to scan for incoming stealth transactions. `v` is the private viewing key, `V` is the public viewing key (also called the viewing tag).

The combination `(S, V)` is called the **stealth meta-address**. This is the only information that gets registered on-chain and stored in the API database.

### Sending (Announcing)

When Alice (sender) wants to send tokens to Bob (recipient):

1. Alice fetches Bob's stealth meta-address `(S_B, V_B)` from the Registry.
2. She generates an **ephemeral key pair** `(e, E)`.
3. She computes a **shared secret** using ECDH: `secret = e * V_B`.
4. She derives a **one-time stealth address** from the shared secret and Bob's spending public key `S_B`.
5. She emits an **announcement** containing `E` (ephemeral public key), the stealth address, the token address, and the amount. The announcement is encrypted such that only someone with Bob's viewing private key `v_B` can decrypt it.
6. She transfers the tokens to the derived stealth address.

### Receiving (Scanning)

Bob scans announcements using his viewing private key `v_B`:

1. For each announcement with ephemeral key `E`, Bob computes `secret = v_B * E`.
2. He derives the stealth address from the secret and his spending public key.
3. If the derived address matches the announced stealth address, the transaction is intended for him.
4. Bob can now control the funds at the stealth address using his spending private key `s_B`.

### Spending (Relayer)

Bob can spend from a stealth address by:

1. Constructing a transaction signed with his spending private key `s_B`.
2. Submitting it through the SilentTransfer Paymaster (ERC-4337) for gas sponsorship.
3. The paymaster covers the gas cost, deducting it from the withdrawn amount or a fee token.

---

## What Privacy Is Provided

### Recipient Privacy
The primary privacy guarantee is **recipient privacy**. When Alice sends tokens to Bob using a stealth address, an external observer cannot determine that Bob is the recipient. The stealth address is a one-time address that is not publicly linked to Bob's identity.

### Unlinkable Addresses
Each stealth transfer generates a unique stealth address. Multiple transfers to the same recipient produce different, cryptographically unlinkable addresses. An observer cannot tell that two stealth addresses belong to the same person.

### Forward-Looking Privacy
Once funds enter a stealth address, all subsequent transactions from that stealth address are unlinked from the recipient's known identity (unless the recipient deliberately links them).

### Decoy Set
Each stealth address exists within the full set of all Ethereum addresses. To an external observer, a stealth address is indistinguishable from any other externally owned account or contract address.

---

## What Privacy Is NOT Provided

### Metadata Leakage (Limited)
While the stealth address itself is private, **transaction metadata is public** on the blockchain. This includes:

- **Timestamps**: When a transaction was included in a block.
- **Gas amounts**: How much gas was spent on a transaction.
- **Calldata patterns**: The structure and size of transaction data.
- **Interaction patterns**: Which contracts were called and in what sequence.

Sophisticated adversaries can use metadata analysis to cluster transactions and reduce privacy. For example, if Bob always scans for announcements at the same time each day and immediately withdraws, the timing pattern may reveal his identity.

### IP Leakage
All RPC calls to Ethereum nodes reveal the caller's IP address. This means:

- When Alice fetches Bob's meta-address from the Registry, her IP is visible.
- When Bob scans announcements, his IP is visible.
- When any transaction is submitted, the submitter's IP is visible.

**Mitigation:** Use a VPN, Tor, or a decentralized RPC network (e.g., Pocket Network, Infura's IPFS, or a self-hosted node).

### Timing Analysis
The time between an announcement on-chain and a subsequent scan or withdrawal can reveal links. If Bob scans immediately after every announcement, an observer can notice the timing correlation and potentially identify which stealth address is Bob's.

**Mitigation:** Introduce randomized delays between scanning and withdrawal. Use a scheduled scanner that runs at fixed intervals regardless of incoming announcements.

### Withdrawal Linkability
When funds are withdrawn from a stealth address to a known address (e.g., a centralized exchange), the link between the stealth address and the recipient becomes visible on-chain. This is the **most common privacy failure mode**.

**Mitigation:** Withdraw to a **fresh stealth address** rather than a known address. Use a "churn" strategy: withdraw from stealth address A to stealth address B before moving funds to a known address. Consider using a coin swap or mixer for the final hop to a known address.

### Sender Privacy
The stealth address protocol provides **recipient privacy, not sender privacy**. The sender's identity is often visible because:

- The sender must hold tokens before transferring them.
- The sender's address is visible in the transaction that funds the stealth address.
- The sender's wallet may be identifiable through other metadata.

**This is by design.** If sender privacy is needed, additional techniques (like ring signatures or a trusted setup) would be required.

### Amount Visibility
The amount transferred to a stealth address is visible on-chain (unless the token itself implements private balances, like ERC-20 with encrypted amounts). An observer can see how much was sent to each stealth address.

**Mitigation:** Use privacy-preserving tokens or split larger transfers into multiple smaller transfers across different stealth addresses.

---

## Compliance / Oracle Model

SilentTransfer includes a compliance mechanism that enables **KYB/KYC oracle** integration. This is a design choice to support regulated use cases while maintaining privacy for compliant users.

### How It Works

1. A **compliance oracle** (operated by the protocol or a trusted third party) attests to the KYC status of registered users.
2. The Registry contract tracks KYC status per address.
3. The Paymaster contract can restrict gas sponsorship to KYC-approved addresses.
4. The API enforces KYC checks before relaying withdrawals.

### Privacy Implications

- The compliance oracle knows which addresses are KYC-approved and thus can correlate on-chain activity with off-chain identity.
- The protocol minimizes oracle involvement: it only sees registration events and KYC status updates, not individual transactions.
- The oracle model is **opt-in** for the recipient. Users who do not need KYC compliance can interact with the protocol without oracle involvement (in permissionless deployments).

### Why Include Compliance?

Many jurisdictions require regulated entities (e.g., exchanges, financial institutions) to perform KYC on their users. By including a compliance oracle, institutions can adopt stealth address technology while meeting regulatory requirements. The protocol is designed to support both permissioned and permissionless deployments.

---

## Recommended Mitigations

### For Users

1. **Use a VPN or Tor** for all RPC interactions. This prevents IP-level correlation.
2. **Avoid consolidating funds** from multiple stealth addresses into a single known address. This creates an unlinkable link.
3. **Introduce random delays** between scanning and withdrawing. Do not react immediately to announcements.
4. **Withdraw to fresh addresses.** Never withdraw from a stealth address directly to a known exchange deposit address.
5. **Use multiple wallets** for different purposes (one for stealth receiving, one for everyday spending).
6. **Be aware of amount privacy.** If you receive a unique amount that only one person would send you, the privacy is reduced.

### For Integrators

1. **Never log IP addresses alongside wallet addresses.** If you need rate limiting, use a hash of the IP rather than the raw IP.
2. **Batch scan operations** to reduce timing leakage. Scan at fixed intervals, not on-demand.
3. **Implement rate limiting** at the API level to prevent enumeration attacks.
4. **Minimize on-chain metadata.** Use the minimum necessary calldata in announcements.
5. **Consider using a decentralized RPC** for scanning to distribute metadata across multiple providers.

---

## Known Attack Vectors

| Attack | Description | Severity | Mitigation |
|---|---|---|---|
| **Timing correlation** | Observer correlates announcement time with scan time | Medium | Randomized scan intervals |
| **IP logging** | RPC provider logs user IPs associating them with query patterns | Medium | VPN/Tor, decentralized RPC |
| **Consolidation tracking** | Multiple stealth addresses sending to same known address | High | Churn strategy, fresh withdrawal addresses |
| **Metadata analysis** | Gas amounts, calldata patterns reveal user behavior | Low-Medium | Pad transactions, use consistent gas |
| **Sybil KYC attack** | Attacker registers multiple KYC-verified identities | Low | Robust KYC verification, liveness checks |
| **Replay attack** | Replaying an old announcement | Low | Nonce checking in Messenger contract |
| **Front-running** | MEV bots front-run announcements | Low | Use private mempool / flashbots |

---

## Summary

| Property | Status | Notes |
|---|---|---|
| Recipient privacy | ✅ Provided | Stealth addresses hide the recipient |
| Address unlinkability | ✅ Provided | Each transfer generates a new address |
| Amount privacy | ❌ Not provided | Transfer amounts are public |
| Sender privacy | ❌ Not provided | Sender identity is visible to observers |
| Metadata privacy | ⚠️ Partial | Timing, gas, and pattern data are public |
| IP protection | ❌ Not provided | Users must use VPN/Tor |
| Withdrawal privacy | ⚠️ Partial | Only if withdrawn to another stealth address |

SilentTransfer provides strong recipient privacy through ERC-5564/ERC-6538 stealth address technology. However, it is not a complete anonymity system. Users must take additional precautions (VPN, randomized timing, careful withdrawal practices) to maintain privacy in adversarial environments.
