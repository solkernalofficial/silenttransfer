#!/usr/bin/env bash
# SilentTransfer — public push preflight
set -euo pipefail
cd "$(dirname "$0")/.."
failed=0
fail() { echo "FAIL  $1"; failed=$((failed+1)); }
ok() { echo "OK    $1"; }
warn() { echo "WARN  $1"; }

echo ""
echo "=== SilentTransfer public preflight ==="
echo ""

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  while IFS= read -r f; do
    if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
      fail "Tracked by git (remove from index): $f"
    fi
  done <<'EOF'
.env
.env.local
apps/api/.env
apps/web/.env.local
contracts/.env
apps/api/dev.db
FINAL_STATUS.md
GAP_ANALYSIS.md
report.html
app.py
apps/web/AGENTS.md
apps/web/CLAUDE.md
EOF

  if git grep -nE 'DEPLOYER_PRIVATE_KEY=0x[a-fA-F0-9]{64}|BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY|sk_live_' -- . \
    ':(exclude)*.md' ':(exclude)scripts/*' 2>/dev/null | head -5 | grep -q .; then
    fail "Possible secret material in tracked files"
  else
    ok "No high-confidence private key patterns in tracked files"
  fi
else
  warn "Not a git repository yet"
fi

for f in apps/api/.env.example apps/web/.env.example contracts/.env.example README.md .gitignore; do
  if [[ -f "$f" ]]; then ok "Present: $f"; else fail "Missing: $f"; fi
done

if grep -RInE '0x[a-fA-F0-9]{64}' --include='.env.example' . 2>/dev/null | grep -q .; then
  fail "Hex key-like value in .env.example"
else
  ok "Example env files clean of private-key hex"
fi

echo ""
if [[ "$failed" -gt 0 ]]; then
  echo "RESULT: $failed failure(s). Do NOT push."
  exit 1
fi
echo "RESULT: PASS — safe to stage and push (after you review git status)."
exit 0
