# Deploy status — Robinhood Chain Testnet

> Product target is **Robinhood Chain**, not Sepolia.  
> (Sepolia was only a temporary generic option.)

## Deployed ✓

| Field | Value |
|--------|--------|
| Network | **Robinhood Chain Testnet** |
| Chain ID | **46630** |
| Deployer | `0x9d41FF3cC91b341113a89e96AF1D75c0aC06B26B` |
| Deployed at | 2026-07-09T08:34:37Z |
| Artifact | `contracts/deployments/robinhoodTestnet.json` |

### Contracts

| Contract | Address |
|----------|---------|
| ERC6538Registry | [`0x4d5aCC956c3D4a576dC6545c8B8975febDc2B125`](https://explorer.testnet.chain.robinhood.com/address/0x4d5aCC956c3D4a576dC6545c8B8975febDc2B125) |
| ERC5564Messenger | [`0x5EA9fA89796fA28dA351E3A187478eC863AFE45C`](https://explorer.testnet.chain.robinhood.com/address/0x5EA9fA89796fA28dA351E3A187478eC863AFE45C) |
| MockComplianceOracle | [`0x0fA63a04f44a6eFd55406b5901Af6723775a77df`](https://explorer.testnet.chain.robinhood.com/address/0x0fA63a04f44a6eFd55406b5901Af6723775a77df) |
| SilentPaymaster | [`0x25D8241235f5e71f008605b2E29999978C92AAC0`](https://explorer.testnet.chain.robinhood.com/address/0x25D8241235f5e71f008605b2E29999978C92AAC0) |
| USDG | `0x03592B5E147d7752000723A9AA23fc6c70d968Ce` |
| AAPL | `0x702175Be5D1888a054E5545312849464Daf29a24` |
| NVDA | `0xFb97026d12bA25e36A3D95fF5E8eF455Df6597fF` |
| GOOGL | `0x9A0bFeb84A8b2b849825190c6699280B7e9a4B04` |
| MSFT | `0x1548B9503201f6ceC79a3b71caB9432Cf905C1eB` |

### Network config (wallets)

| Property | Value |
|----------|--------|
| RPC | `https://rpc.testnet.chain.robinhood.com` |
| Chain ID | `46630` |
| Explorer | https://explorer.testnet.chain.robinhood.com |
| Currency | ETH |

## Apps wired

- `apps/api/.env` — chain id + contract addresses + RPC  
- `apps/web/.env.local` — same for frontend  

Restart API/web after env changes.

## Redeploy

```bash
cd contracts
npm run deploy:rh-testnet
npm run wire:apps
```

## Note

Contracts are **live on Robinhood Chain Testnet**.  
App Send/Receive still use the **demo API private-send log** until on-chain register/announce txs are wired in the UI.
