# Deployment Guide — SilentTransfer

## Prerequisites

### Local Development
- **Node.js** v18 or later
- **Python** 3.11 or later
- **PostgreSQL** 16 (or Docker Desktop)
- **Git**
- **MetaMask** or another Ethereum wallet browser extension

### Production
- A cloud provider account (Vercel, Railway, Render, AWS, or similar)
- Managed PostgreSQL database (Railway Postgres, Render Postgres, AWS RDS, etc.)
- Ethereum RPC endpoint (Alchemy, Infura, or self-hosted node)
- ERC-4337 Bundler endpoint (stackup.sh, Pimlico, or self-hosted)
- Domain name(s) for API and frontend
- Ethereum wallet with funds for smart contract deployment

---

## Local Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/silenttransfer.git
cd silenttransfer
```

### 2. Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and fill in the required values. For local development, the defaults are sufficient:

```bash
API_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/silenttransfer
API_DEMO_MODE=true
API_JWT_SECRET=local-dev-secret-not-for-production
```

### 3. Start PostgreSQL

**Option A: Local PostgreSQL**

```bash
# macOS
brew install postgresql@16
brew services start postgresql@16
createdb silenttransfer

# Ubuntu/Debian
sudo apt install postgresql
sudo systemctl start postgresql
sudo -u postgres createdb silenttransfer

# Windows (using Winget)
winget install PostgreSQL.PostgreSQL.16
# Then use pgAdmin or psql to create the database
```

**Option B: Docker PostgreSQL**

```bash
docker run -d \
  --name silenttransfer-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=silenttransfer \
  -p 5432:5432 \
  postgres:16
```

**Option C: Docker Compose (recommended)**

```bash
docker compose up -d postgres
```

### 4. API Backend Setup

```bash
cd apps/api

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Seed demo data (optional)
python scripts/seed.py

# Start the API server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at http://localhost:8000 with interactive docs at http://localhost:8000/docs.

### 5. Frontend Setup

```bash
cd apps/web

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will be available at http://localhost:3000.

### 6. Smart Contract Development

```bash
cd contracts

# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npm test

# Start local Hardhat node
npx hardhat node

# In a separate terminal, deploy contracts
npx hardhat run scripts/deploy.ts --network localhost
```

After deploying, copy the contract addresses from the deployment output and add them to your `.env` file.

---

## Smart Contract Deployment

### Production Deployment

1. **Set up deployment wallet** with sufficient native tokens for gas.

2. **Configure network in `hardhat.config.ts`:**
   ```typescript
   networks: {
     polygon: {
       url: process.env.POLYGON_RPC_URL || "",
       accounts: [process.env.DEPLOYER_PRIVATE_KEY || ""],
     },
   },
   ```

3. **Deploy contracts:**
   ```bash
   cd contracts
   npx hardhat run scripts/deploy.ts --network polygon
   ```

4. **Verify contracts on block explorer:**
   ```bash
   npx hardhat verify --network polygon <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
   ```

5. **Transfer ownership** to a multi-sig wallet:
   ```bash
   npx hardhat run scripts/transfer-ownership.ts --network polygon
   ```

6. **Update environment variables** with deployed contract addresses.

---

## API Deployment

### Option A: Docker (Recommended for Production)

Build and run the API Docker container:

```bash
cd apps/api
docker build -t silenttransfer-api .
docker run -d \
  --name silenttransfer-api \
  --env-file ../../.env \
  -p 8000:8000 \
  silenttransfer-api
```

### Option B: Railway

1. Install Railway CLI: `npm i -g @railway/cli`
2. Login: `railway login`
3. Link project: `railway link`
4. Deploy: `railway up --service api`

Railway auto-detects the Dockerfile and provisions a PostgreSQL database. Environment variables are configurable via the Railway dashboard or CLI.

### Option C: Render

1. Create a new **Web Service** on Render.
2. Connect your GitHub repository.
3. Set **Root Directory** to `apps/api`.
4. Set **Runtime** to `Docker`.
5. Add environment variables in the Render dashboard.
6. Create a **PostgreSQL** database from the Render dashboard and link it.

### Manual Server Deployment

```bash
# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start with production server
gunicorn app.main:app \
  -k uvicorn.workers.UvicornWorker \
  --workers 4 \
  --bind 0.0.0.0:8000 \
  --timeout 120
```

### Reverse Proxy (Nginx)

```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate /etc/ssl/certs/yourdomain.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.key;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Frontend Deployment

### Vercel (Recommended)

1. Push your repository to GitHub.
2. Go to [vercel.com](https://vercel.com) and import the repository.
3. Set **Root Directory** to `apps/web`.
4. Configure environment variables in the Vercel dashboard:
   - `NEXT_PUBLIC_API_URL` — Production API URL
   - `NEXT_PUBLIC_DEMO_MODE` — `false`
   - `NEXT_PUBLIC_CHAIN_ID` — Target chain ID
   - `NEXT_PUBLIC_RPC_URL` — Production RPC endpoint
   - `NEXT_PUBLIC_REGISTRY_ADDRESS` — Deployed Registry contract
   - `NEXT_PUBLIC_MESSENGER_ADDRESS` — Deployed Messenger contract
5. Deploy. Vercel auto-detects Next.js.

### Other Hosting

```bash
cd apps/web
npm run build

# Deploy the .next/ and public/ directories to your hosting provider.
# For static export (if applicable):
npm run export
```

---

## Database Migrations

### Running Migrations

```bash
cd apps/api
alembic upgrade head
```

### Creating a New Migration

```bash
alembic revision --autogenerate -m "description of change"
alembic upgrade head
```

### Rollback

```bash
alembic downgrade -1    # Rollback one migration
alembic downgrade <revision>  # Rollback to specific revision
```

---

## Environment Variable Reference

| Variable | Required | Description |
|---|---|---|
| `API_DATABASE_URL` | Yes | PostgreSQL connection string |
| `API_JWT_SECRET` | Yes | Secret for JWT token signing |
| `API_CORS_ORIGINS` | Yes | Comma-separated allowed origins |
| `API_RPC_URL` | Yes* | Ethereum RPC endpoint (*required when DEMO_MODE=false) |
| `API_CHAIN_ID` | Yes | Target Ethereum chain ID |
| `API_REGISTRY_CONTRACT_ADDRESS` | Yes* | Deployed Registry contract (*when DEMO_MODE=false) |
| `API_MESSENGER_CONTRACT_ADDRESS` | Yes* | Deployed Messenger contract (*when DEMO_MODE=false) |
| `API_PAYMASTER_CONTRACT_ADDRESS` | Yes* | Deployed Paymaster contract (*when DEMO_MODE=false) |
| `API_BUNDLER_URL` | Yes* | ERC-4337 bundler endpoint (*when DEMO_MODE=false) |
| `API_PAYMASTER_URL` | Yes* | ERC-4337 paymaster endpoint (*when DEMO_MODE=false) |
| `API_RELAYER_PRIVATE_KEY` | Yes* | Relayer wallet private key (*when DEMO_MODE=false) |
| `API_SIWE_DOMAIN` | Yes | SIWE signing domain |
| `API_SIWE_URI` | Yes | SIWE signing URI |
| `API_RATE_LIMIT_PER_MINUTE` | No | Rate limit (default: 60) |
| `API_LOG_LEVEL` | No | Logging level (default: INFO) |
| `API_DEMO_MODE` | No | Enable demo mode (default: true) |
| `NEXT_PUBLIC_API_URL` | Yes | Public API URL for frontend |
| `NEXT_PUBLIC_RPC_URL` | Yes* | Public RPC URL for wagmi |
| `NEXT_PUBLIC_REGISTRY_ADDRESS` | Yes* | Registry contract address |
| `NEXT_PUBLIC_MESSENGER_ADDRESS` | Yes* | Messenger contract address |

---

## Production Checklist Reference

For a complete walkthrough of production readiness tasks, see [PRODUCTION_CHECKLIST.md](../PRODUCTION_CHECKLIST.md).
