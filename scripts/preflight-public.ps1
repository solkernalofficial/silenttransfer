# SilentTransfer public push preflight
# Run from repo root:  powershell -File .\scripts\preflight-public.ps1

$ErrorActionPreference = "Continue"
$here = $PSScriptRoot
Set-Location (Join-Path $here "..")

$script:failed = 0

function Fail([string]$msg) {
  Write-Host "FAIL  $msg" -ForegroundColor Red
  $script:failed = $script:failed + 1
}
function Ok([string]$msg) {
  Write-Host "OK    $msg" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== SilentTransfer public preflight ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path ".git")) {
  Fail "Not a git repository"
} else {
  $tracked = @(git ls-files)
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
  foreach ($f in $forbidden) {
    if ($tracked -contains $f) {
      Fail "Tracked by git: $f"
    }
  }
  foreach ($t in $tracked) {
    if ($t -like "*.db") { Fail "Database tracked: $t" }
    if (($t -like "*.env" -or $t -like "*.env.*") -and ($t -notlike "*.env.example")) {
      Fail "Env tracked: $t"
    }
  }
  Ok "Git index checked against forbidden paths"
}

foreach ($f in @("apps/api/.env.example", "apps/web/.env.example", "contracts/.env.example", "README.md", ".gitignore", "LICENSE")) {
  if (Test-Path $f) { Ok "Present: $f" } else { Fail "Missing: $f" }
}

Get-ChildItem -Recurse -Filter ".env.example" -ErrorAction SilentlyContinue | ForEach-Object {
  $content = Get-Content $_.FullName -Raw
  if ($content -match "0x[a-fA-F0-9]{64}") {
    Fail "Private-key-like hex in $($_.FullName)"
  } else {
    Ok "Clean: $($_.FullName)"
  }
}

# Local secrets should stay untracked
foreach ($f in @("contracts/.env", "apps/api/.env", "apps/web/.env.local")) {
  if (Test-Path $f) {
    $ignored = git check-ignore $f 2>$null
    if ($ignored) { Ok "Ignored local secret: $f" }
    else { Fail "NOT ignored (danger): $f" }
  }
}

# app.py core must NOT be ignored
$coreIgnore = git check-ignore "apps/api/src/core/app.py" 2>$null
if ($coreIgnore) {
  Fail "apps/api/src/core/app.py is ignored - fix .gitignore (use /app.py not app.py)"
} else {
  Ok "FastAPI core app.py is trackable"
}

Write-Host ""
if ($script:failed -gt 0) {
  Write-Host "RESULT: $($script:failed) failure(s). Do NOT push." -ForegroundColor Red
  exit 1
}
Write-Host "RESULT: PASS. Review git status. Push only when owner requests." -ForegroundColor Green
exit 0
