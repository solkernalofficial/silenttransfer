# API Reference — SilentTransfer

Base URL: `http://localhost:8000` (local) or `https://api.yourdomain.com` (production)

All API responses are JSON. Authentication is via SIWE (Sign-In with Ethereum) using JWT bearer tokens.

---

## GET /health

Health check endpoint. Returns API status, version, and demo mode flag.

**Response `200`:**

```json
{
  "status": "ok",
  "version": "0.1.0",
  "demo_mode": true
}
```

**Example:**

```bash
curl http://localhost:8000/health
```

---

## GET /api/config/public

Returns public configuration values needed by the frontend.

**Response `200`:**

```json
{
  "demo_mode": true,
  "chain_id": 1337,
  "siwe_domain": "localhost:3000",
  "siwe_uri": "http://localhost:3000",
  "registry_address": null,
  "messenger_address": null
}
```

**Example:**

```bash
curl http://localhost:8000/api/config/public
```

---

## GET /api/stats

Returns aggregate statistics for the dashboard.

**Authentication:** None (public)

**Response `200`:**

```json
{
  "total_registrations": 42,
  "total_announcements": 156,
  "total_relays": 89,
  "unique_users": 38,
  "demo_mode": true
}
```

**Example:**

```bash
curl http://localhost:8000/api/stats
```

---

## POST /api/auth/siwe/nonce

Generates a SIWE nonce for wallet authentication.

**Response `200`:**

```json
{
  "nonce": "a1b2c3d4e5f6..."
}
```

**Example:**

```bash
curl -X POST http://localhost:8000/api/auth/siwe/nonce
```

---

## POST /api/auth/siwe/verify

Verifies a SIWE signature and returns a JWT token.

**Request Body:**

```json
{
  "message": "localhost:3000 wants you to sign in...",
  "signature": "0x...",
  "address": "0x1234567890123456789012345678901234567890"
}
```

**Response `200`:**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "address": "0x1234567890123456789012345678901234567890"
}
```

**Response `401`:**

```json
{
  "detail": "Invalid signature"
}
```

**Example:**

```bash
curl -X POST http://localhost:8000/api/auth/siwe/verify \
  -H "Content-Type: application/json" \
  -d '{
    "message": "localhost:3000 wants you to sign in with your Ethereum account:\n0x1234...\n\nThis request will not trigger a blockchain transaction or cost any gas fees.\n\nURI: http://localhost:3000\nVersion: 1\nChain ID: 1337\nNonce: abc123\nIssued At: 2026-01-01T00:00:00.000Z",
    "signature": "0x...",
    "address": "0x1234567890123456789012345678901234567890"
  }'
```

---

## POST /api/register

Registers a stealth meta-address (spending pubkey + viewing pubkey) for a user. In demo mode, this stores the registration in the database without an on-chain transaction.

**Authentication:** JWT bearer token required

**Request Body:**

```json
{
  "user_address": "0x1234567890123456789012345678901234567890",
  "spending_pubkey": "0x04aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "viewing_pubkey": "0x04bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
}
```

**Response `200` (demo mode):**

```json
{
  "success": true,
  "message": "Meta-address registered (demo)",
  "kyc_status": true,
  "mode": "demo"
}
```

**Response `200` (production mode):**

```json
{
  "success": true,
  "message": "Meta-address registered on-chain",
  "tx_hash": "0x...",
  "kyc_status": true,
  "mode": "production"
}
```

**Example:**

```bash
curl -X POST http://localhost:8000/api/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "user_address": "0x1234567890123456789012345678901234567890",
    "spending_pubkey": "0x04aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "viewing_pubkey": "0x04bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  }'
```

---

## GET /api/registrations

Lists all registered stealth meta-addresses.

**Authentication:** None in demo mode (JWT in production)

**Response `200`:**

```json
[
  {
    "id": 1,
    "user_address": "0x1234567890123456789012345678901234567890",
    "spending_pubkey": "0x04aa...",
    "viewing_pubkey": "0x04bb...",
    "kyc_status": true,
    "created_at": "2026-01-01T00:00:00Z",
    "tx_hash": null
  }
]
```

**Example:**

```bash
curl http://localhost:8000/api/registrations
```

---

## GET /api/kyc/{address}

Returns KYC status for a specific Ethereum address.

**Parameters:**
- `address` (path): Ethereum address to query

**Response `200`:**

```json
{
  "address": "0x1234567890123456789012345678901234567890",
  "kyc_status": true,
  "registered": true,
  "registered_at": "2026-01-01T00:00:00Z"
}
```

**Response `404`:**

```json
{
  "detail": "Address not found"
}
```

**Example:**

```bash
curl http://localhost:8000/api/kyc/0x1234567890123456789012345678901234567890
```

---

## POST /api/announce

Creates a stealth address announcement. In demo mode, this logs the announcement in the database. In production, it submits a transaction to the Messenger contract.

**Authentication:** JWT bearer token required

**Request Body:**

```json
{
  "stealth_address": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "caller": "0x1234567890123456789012345678901234567890",
  "ephemeral_pubkey": "0x04cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  "token_address": "0xUSDG_token",
  "amount": "1500000000000000000"
}
```

**Response `200` (demo mode):**

```json
{
  "success": true,
  "message": "Announcement logged (demo)",
  "mode": "demo"
}
```

**Response `200` (production mode):**

```json
{
  "success": true,
  "message": "Announcement emitted on-chain",
  "tx_hash": "0x...",
  "mode": "production"
}
```

**Example:**

```bash
curl -X POST http://localhost:8000/api/announce \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "stealth_address": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "caller": "0x1234567890123456789012345678901234567890",
    "ephemeral_pubkey": "0x04cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    "token_address": "0xUSDG_token",
    "amount": "1500000000000000000"
  }'
```

---

## GET /api/announcements

Lists all announcements. Supports optional filtering by stealth address.

**Query Parameters:**
- `stealth_address` (optional): Filter by stealth address

**Response `200`:**

```json
[
  {
    "id": 1,
    "stealth_address": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "caller": "0x1234567890123456789012345678901234567890",
    "ephemeral_pubkey": "0x04cc...",
    "token_address": "0xUSDG_token",
    "amount": "1500000000000000000",
    "created_at": "2026-01-01T00:00:00Z",
    "tx_hash": null
  }
]
```

**Example:**

```bash
curl http://localhost:8000/api/announcements
curl "http://localhost:8000/api/announcements?stealth_address=0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
```

---

## GET /api/scan

Scans announcements for a given viewer address. Returns announcements that can be decrypted by the viewer's viewing key.

**Query Parameters:**
- `viewer` (required): The viewer's Ethereum address

**Response `200`:**

```json
{
  "viewer": "0x1234567890123456789012345678901234567890",
  "found": 3,
  "announcements": [
    {
      "id": 1,
      "stealth_address": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "caller": "0x...",
      "ephemeral_pubkey": "0x04cc...",
      "token_address": "0xUSDG_token",
      "amount": "1500000000000000000",
      "created_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

**Example:**

```bash
curl "http://localhost:8000/api/scan?viewer=0x1234567890123456789012345678901234567890"
```

---

## POST /api/relay/withdraw

Initiates a gasless withdrawal from a stealth address using the SilentTransfer Paymaster.

**Authentication:** JWT bearer token required

**Request Body:**

```json
{
  "stealth_address": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "target_owner": "0x1234567890123456789012345678901234567890",
  "fee_token": "0xUSDG_token",
  "amount": "1000000000000000000"
}
```

**Response `200` (demo mode):**

```json
{
  "success": true,
  "tx_hash": "0x0000000000000000000000000000000000000000000000000000000000000000",
  "gas_sponsored": 21000,
  "fee_deducted": "0.000042",
  "message": "Gasless withdrawal completed via SilentTransfer Paymaster (demo)",
  "mode": "demo"
}
```

**Response `200` (production mode):**

```json
{
  "success": true,
  "tx_hash": "0x...",
  "gas_sponsored": 21000,
  "fee_deducted": "0.000042",
  "message": "Gasless withdrawal completed via SilentTransfer Paymaster",
  "mode": "production"
}
```

**Error `400`:**

```json
{
  "detail": "Insufficient balance in stealth address"
}
```

**Example:**

```bash
curl -X POST http://localhost:8000/api/relay/withdraw \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "stealth_address": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "target_owner": "0x1234567890123456789012345678901234567890",
    "fee_token": "0xUSDG_token",
    "amount": "1000000000000000000"
  }'
```

---

## GET /api/relay/history

Returns the relay (withdrawal) history.

**Authentication:** JWT bearer token required

**Response `200`:**

```json
[
  {
    "id": 1,
    "stealth_address": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "target_owner": "0x1234567890123456789012345678901234567890",
    "fee_token": "0xUSDG_token",
    "amount": "1000000000000000000",
    "gas_sponsored": 21000,
    "fee_deducted": "0.000042",
    "tx_hash": "0x...",
    "created_at": "2026-01-01T00:00:00Z",
    "status": "completed"
  }
]
```

**Example:**

```bash
curl http://localhost:8000/api/relay/history \
  -H "Authorization: Bearer <token>"
```

---

## GET /api/contracts

Returns the deployed smart contract addresses and their verification status.

**Authentication:** None (public)

**Response `200`:**

```json
{
  "registry": {
    "address": "0x...",
    "deployed": true,
    "verified": true
  },
  "messenger": {
    "address": "0x...",
    "deployed": true,
    "verified": true
  },
  "paymaster": {
    "address": "0x...",
    "deployed": true,
    "verified": true
  },
  "chain_id": 137
}
```

**Example:**

```bash
curl http://localhost:8000/api/contracts
```

---

## GET /api/me

Returns the currently authenticated user's profile and registration status.

**Authentication:** JWT bearer token required

**Response `200`:**

```json
{
  "address": "0x1234567890123456789012345678901234567890",
  "registered": true,
  "kyc_status": true,
  "registration": {
    "spending_pubkey": "0x04aa...",
    "viewing_pubkey": "0x04bb...",
    "created_at": "2026-01-01T00:00:00Z"
  },
  "announcement_count": 5,
  "relay_count": 2
}
```

**Response `401`:**

```json
{
  "detail": "Not authenticated"
}
```

**Example:**

```bash
curl http://localhost:8000/api/me \
  -H "Authorization: Bearer <token>"
```
