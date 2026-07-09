# SilentTransfer — public push preflight (Windows PowerShell)
# Run from repository root. Exit 1 if anything unsafe is found.

$ErrorActionPreference = "Continue"
Set-Location (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path "apps")) { Set-Location $PSScriptRoot; Set-Location .. }

$script:failed = 0
function Fail([string]$msg) {
  Write-Host "FAIL  $msg" -ForegroundColor Red
  $script:failed++
}
function Ok([string]$msg) {
  Write-Host "OK    $msg" -ForegroundColor Green
}
function Warn([string]$msg) {
  Write-Host "WARN  $msg" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== SilentTransfer public preflight ===" -ForegroundColor Cyan
Write-Host ""

$forbidden = @(
  ".env",
  ".env.local",
  "apps/api/.env",
  "apps/web/.env.local",
  "contracts/.env",
  "apps/api/dev.db",
  "FINAL_STATUS.md",
  "GAP_ANALYSIS.md",
  "report.html",
  "app.py",
  "apps/web/AGENTS.md",
  "apps/web/CLAUDE.md"
)

if (Test-Path ".git") {
  $tracked = @(git ls-files)
  foreach ($f in $forbidden) {
    if ($tracked -contains $f) {
      Fail "Tracked by git (git rm --cached): $f"
    }
  }
  foreach ($t in $tracked) {
    if ($t -match '\.env' -and $t -notmatch '\.env\.example$') {
      Fail "Env file tracked: $t"
    }
    if ($t -match '\.db$') {
      Fail "Database tracked: $t"
    }
  }
  Ok "Forbidden paths checked against git index"
} else {
  Warn "Not a git repository yet"
}

foreach ($f in @("contracts/.env", "apps/api/.env", "apps/web/.env.local")) {
  if (Test-Path $f) {
    Ok "Local secret file present (must stay untracked): $f"
  }
}

foreach ($f in @("apps/api/.env.example", "apps/web/.env.example", "contracts/.env.example", "README.md", ".gitignore", "LICENSE")) {
  if (Test-Path $f) { Ok "Present: $f" } else { Fail "Missing: $f" }
}

Get-ChildItem -Recurse -Filter ".env.example" -ErrorAction SilentlyContinue | ForEach-Object {
  $hits = Select-String -Path $_.FullName -Pattern "0x[a-fA-F0-9]{64}" -ErrorAction SilentlyContinue
  if ($hits) { Fail "Private-key-like hex in $($_.FullName)" }
  else { Ok "Clean example env: $($_.FullName)" }
}

$gi = Get-Content ".gitignore" -Raw -ErrorAction SilentlyContinue
if ($gi -match 'contracts/\.env' -or $gi -match '\*\*/\.env') {
  Ok ".gitignore covers env files"
} else {
  Fail ".gitignore may not cover contracts/.env"
}

# Critical: bare app.py would ignore FastAPI app modules
if ($gi -match '(?m)^app\.py\s*$') {
  Fail ".gitignore has bare app.py (would ignore apps/**/app.py) — use /app.py only"
} else {
  Ok ".gitignore does not blanket-ignore all app.py files"
}

Write-Host ""
if ($script:failed -gt 0) {
  Write-Host "RESULT: $($script:failed) failure(s). Do NOT push." -ForegroundColor Red
  exit 1
}
Write-Host "RESULT: PASS — review git status, then you may push when the owner requests it." -ForegroundColor Green
exit 0
