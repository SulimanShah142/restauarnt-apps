# Initialize userapp Repository
# Run this AFTER running split-repos.ps1

$ErrorActionPreference = "Stop"
$RepoPath = "C:\Users\Administrator\userapp-repo"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Initializing userapp Repository" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

if (-not (Test-Path $RepoPath)) {
    Write-Host "✗ Error: Repository directory not found at $RepoPath" -ForegroundColor Red
    Write-Host "Please run split-repos.ps1 first!" -ForegroundColor Yellow
    exit 1
}

Set-Location $RepoPath

Write-Host "Initializing git repository..." -ForegroundColor Yellow
git init

Write-Host "`nAdding all files..." -ForegroundColor Yellow
git add .

Write-Host "`nCreating initial commit..." -ForegroundColor Yellow
git commit -m "Initial commit: userapp

- Migrated from monorepo to standalone repository
- React Native Expo app for restaurant customers
- Includes shared utilities and database modules"

Write-Host "`n✓ Repository initialized successfully!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Create a new GitHub repository (do NOT use existing monorepo)" -ForegroundColor White
Write-Host "2. Run:" -ForegroundColor White
Write-Host "   git remote add origin https://github.com/YOUR_USERNAME/userapp.git" -ForegroundColor Gray
Write-Host "   git branch -M main" -ForegroundColor Gray
Write-Host "   git push -u origin main" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Update EAS project ID in eas.json if needed" -ForegroundColor White
Write-Host "   Run: eas init --force" -ForegroundColor Gray
Write-Host ""
Write-Host "Repository location: $RepoPath" -ForegroundColor Yellow
Write-Host ""
