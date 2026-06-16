# Quick push script for Salezy
# Usage: .\push.ps1 "your commit message"
# Usage (no message): .\push.ps1  -> uses auto timestamp message

param(
    [string]$Message = ""
)

if ($Message -eq "") {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    $Message = "chore: update $timestamp"
}

Write-Host "Staging all changes..." -ForegroundColor Cyan
git add -A

$staged = git diff --cached --name-only
if (-not $staged) {
    Write-Host "Nothing to commit." -ForegroundColor Yellow
    exit 0
}

Write-Host "Committing: $Message" -ForegroundColor Cyan
git commit -m $Message

Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
git push origin main

Write-Host "Done! https://github.com/tchvut1221-ops/salezy" -ForegroundColor Green
