# Privacy Disclaimer — SilentTransfer

**Last updated: July 2026**

---

## 1. No Guarantee of Complete Anonymity

SilentTransfer implements stealth address technology (ERC-5564 / ERC-6538) to provide **recipient privacy** for token transfers on public blockchains. However, this technology **does not guarantee complete anonymity**. Users should be aware of the following limitations:

- **Metadata leakage:** Transaction timestamps, gas amounts, calldata patterns, and contract interaction sequences are publicly visible on the blockchain and can be used for statistical analysis.
- **Timing analysis:** The timing between announcement creation and scanning/withdrawal may reveal links between stealth addresses and their recipients.
- **IP leakage:** Standard RPC connections expose the user's IP address to the RPC provider and any network observer.
- **Withdrawal linkability:** Moving funds from a stealth address to a known address (e.g., a centralized exchange deposit address) publicly links the stealth address to the recipient.

## 2. No Sender Privacy

The stealth address protocol provides **recipient privacy, not sender privacy**. When tokens are sent to a stealth address, the sender's address and the amount sent are visible on-chain. If sender privacy is required, additional techniques beyond the scope of this protocol are necessary.

## 3. Forward-Looking Privacy Only

Stealth addresses provide **forward-looking privacy** for tokens entering the stealth system. They do **not** mask the history of tokens before they entered the stealth system, nor do they retroactively privatize past transactions. Tokens that were previously associated with a known address may still carry that association when moved into a stealth address.

## 4. Users Must Comply with Applicable Laws

Users of SilentTransfer are solely responsible for ensuring their use of the protocol complies with all applicable laws and regulations in their jurisdiction. This includes, but is not limited to:

- Anti-money laundering (AML) regulations
- Counter-terrorism financing (CTF) regulations
- Sanctions compliance
- Tax reporting obligations
- Data protection and privacy laws (GDPR, CCPA, etc.)

This product does not require KYC. Users remain responsible for legal compliance in their jurisdiction.

## 5. Product identity

**SilentTransfer** (silenttransfer.com) is an independent privacy transfer project. Token ticker: **SILENT**.  
It is not affiliated with Robinhood Markets, Inc. or any other third-party trading platform.

## 6. Recommended Privacy Practices

To maximize your privacy when using SilentTransfer:

- **Use a VPN or Tor** for all blockchain RPC interactions to prevent IP leakage.
- **Introduce randomized delays** between scanning announcements and initiating withdrawals.
- **Withdraw to fresh stealth addresses** rather than known addresses whenever possible.
- **Avoid consolidating funds** from multiple stealth addresses into a single known address.
- **Use consistent gas amounts** to reduce metadata fingerprinting.
- **Be mindful of amount privacy** — if you receive a unique amount that only one person would send you, the privacy benefit is diminished.

## 7. No Warranty

SilentTransfer is provided "as is" without warranty of any kind, express or implied. The protocol developers and contributors make no guarantees regarding the privacy, security, or fitness for a particular purpose of the software. Users assume all risk associated with using the protocol.

## 8. Third-Party Services

The SilentTransfer API and frontend may interact with third-party services including RPC providers, blockchain bundlers, and indexing services. These third parties have their own privacy policies and data handling practices. Users should review the privacy policies of any third-party services they interact with through the protocol.

---

*For questions about this disclaimer, please contact legal@silenttransfer.com.*
