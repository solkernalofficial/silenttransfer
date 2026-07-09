# Next: Testnet (only after security hardening)

**Do not send real funds until contracts are deployed to a real testnet and `DEMO_MODE=false` with a real RPC.**

## Prerequisites
- MetaMask (or another wallet) with **testnet** tokens only
- Free RPC (Alchemy / Infura / public Hoodi or Sepolia)
- Deployer private key funded on that testnet (never commit the key)

## 1. Configure contracts

Create `contracts/.env`:

```env
RPC_URL=https://your-testnet-rpc.example
DEPLOYER_PRIVATE_KEY=0xYOUR_TESTNET_KEY
TESTNET_CHAIN_ID=11155111
# Hoodi example was 4663 in hardhat.config — match your network
```

## 2. Deploy

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat run scripts/deploy.js --network hoodiTestnet
# or add sepolia network in hardhat.config.js and use --network sepolia
```

Copy printed addresses for Registry, Messenger, Paymaster, tokens.

## 3. Configure API + web

`apps/api/.env` (example):

```env
DEMO_MODE=false
JWT_SECRET=<openssl rand -hex 32>
CORS_ORIGINS=https://your-frontend.example
DATABASE_URL=postgresql+asyncpg://...
RPC_URL=https://your-testnet-rpc.example
CHAIN_ID=11155111
REGISTRY_CONTRACT_ADDRESS=0x...
MESSENGER_CONTRACT_ADDRESS=0x...
PAYMASTER_CONTRACT_ADDRESS=0x...
# Real gasless only after bundler is wired:
# RELAYER_PRIVATE_KEY=...
# BUNDLER_URL=...
```

`apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=https://your-api.example
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_RPC_URL=https://your-testnet-rpc.example
NEXT_PUBLIC_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_MESSENGER_ADDRESS=0x...
```

## 4. Important security notes (current code)

- Mutating APIs require **Bearer JWT** (SIWE in real mode; `demo-login` only when `DEMO_MODE=true`).
- Real mode **will not** fake successful relay txs (returns 503/501 until EntryPoint/bundler is implemented).
- `/docs` is disabled when `DEMO_MODE=false`.

## 5. Still not “production money ready”

- Paymaster is still a mock vs full ERC-4337 EntryPoint.
- Client stealth key derivation is demo-grade (not production ECC).
- Run independent audit before mainnet value.
