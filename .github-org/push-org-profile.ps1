# Push SilentTransfer organization GitHub homepage (.github / profile/README.md)
# Requires: gh auth as an org owner/admin of SilentTransfer
#
# Usage (from this folder):
#   .\push-org-profile.ps1

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# Avoid env GITHUB_TOKEN overriding the account you just logged in as
Remove-Item Env:GITHUB_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:GH_TOKEN -ErrorAction SilentlyContinue

Write-Host "Authenticated as:" (gh api user --jq .login)

$exists = $false
try {
  gh api repos/SilentTransfer/.github --jq .full_name | Out-Null
  $exists = $true
} catch {
  $exists = $false
}

if (-not $exists) {
  Write-Host "Creating SilentTransfer/.github ..."
  gh api -X POST orgs/SilentTransfer/repos `
    -f name='.github' `
    -f description='Organization profile and community health files for SilentTransfer.' `
    -F private=false `
    -F auto_init=false | Out-Null
}

if (-not (Test-Path .git)) {
  git init
  git branch -M main
}

git add README.md profile/README.md
if (git status --porcelain) {
  git commit -m "Add SilentTransfer organization profile homepage"
}

$remote = git remote 2>$null
if ($remote -notcontains 'origin') {
  git remote add origin https://github.com/SilentTransfer/.github.git
} else {
  git remote set-url origin https://github.com/SilentTransfer/.github.git
}

git push -u origin main

# Optional org metadata polish
gh api -X PATCH orgs/SilentTransfer `
  -f description='Private transfer infrastructure for public blockchains. Protocol asset: sthood. CA: 0x01f44ADdf4af1DB2d9016a4992FFef5163648c0a' `
  -f blog='https://silenttransfer.com' `
  -f email='silent@silenttransfer.com' `
  -f location='Open source' 2>$null

Write-Host ""
Write-Host "Done. Open: https://github.com/SilentTransfer"
Write-Host "Org profile renders from: SilentTransfer/.github → profile/README.md"
