# Public GitHub release checklist

Use this before the first public push. **Do not push until the owner explicitly requests it.**

## Never publish

| Item | Why |
|------|-----|
| `contracts/.env` | Deployer private key |
| `apps/api/.env`, `apps/web/.env.local`, root `.env*` | JWT secrets, local config |
| `*.db` / `dev.db` | Local user/session data |
| `FINAL_STATUS.md`, `GAP_ANALYSIS.md`, `report*` | Internal status / PRD-style material |
| `app.py`, `frontend/`, `index (3).html` | Legacy prototypes |
| `AGENTS.md`, `CLAUDE.md` | Agent tooling notes |
| Any real `RELAYER_PRIVATE_KEY` / API keys | Credentials |

## Safe to publish

- Source under `apps/`, `contracts/src`, `contracts/scripts`, `contracts/test`
- Public contract addresses (on-chain)
- `.env.example` templates (no real secrets)
- `README.md`, `SECURITY.md`, `docs/*` (product-facing)
- `contracts/deployments/*.json` (addresses only; `*.env` ignored)

## Steps (when owner says “push”)

1. Run `.\scripts\preflight-public.ps1` (or `bash scripts/preflight-public.sh`) — must PASS.
2. `git init` (if needed), create branch `main`.
3. `git status` — confirm no `.env`, no `contracts/.env`, no `*.db`.
4. `git add` carefully; prefer `git add apps contracts docs README.md SECURITY.md docker-compose.yml scripts .gitignore .env.example`.
5. Review `git diff --cached`.
6. Commit with a professional message.
7. Add remote and push only after owner approval:
   ```bash
   git remote add origin git@github.com:ORG/silenttransfer.git
   git push -u origin main
   ```

## If a secret was ever committed

1. Rotate the key immediately (deployer wallet, JWT secret, etc.).
2. Remove from history (`git filter-repo` / BFG) — force-push only with explicit approval.
3. Assume the old key is compromised forever.
