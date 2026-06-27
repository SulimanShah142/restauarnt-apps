# Complete Monorepo Split - Automated Script
# This script handles everything: splitting, initializing, and setup

$ErrorActionPreference = "Stop"
$RootPath = "C:\Users\Administrator\restaurant-app"
$ParentPath = "C:\Users\Administrator"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MONOREPO SPLIT - COMPLETE AUTOMATION" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Split repos
Write-Host "[1/4] Running split-repos.ps1..." -ForegroundColor Yellow
& "$RootPath\split-repos.ps1"

# Step 2: Initialize each repo
Write-Host "`n[2/4] Initializing admins-app repo..." -ForegroundColor Yellow
& "$RootPath\init-admins-app.ps1"

Write-Host "`n[3/4] Initializing deliverapp repo..." -ForegroundColor Yellow
& "$RootPath\init-deliverapp.ps1"

Write-Host "`n[4/4] Initializing userapp repo..." -ForegroundColor Yellow
& "$RootPath\init-userapp.ps1"

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  ✓ ALL REPOS CREATED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

Write-Host "Created repositories:" -ForegroundColor Cyan
Write-Host "  • $ParentPath\admins-app-repo" -ForegroundColor White
Write-Host "  • $ParentPath\deliverapp-repo" -ForegroundColor White
Write-Host "  • $ParentPath\userapp-repo`n" -ForegroundColor White

Write-Host "IMPORTANT NEXT STEPS:" -ForegroundColor Yellow
Write-Host "================================`n" -ForegroundColor Yellow

Write-Host "For EACH app repo, you need to:" -ForegroundColor White
Write-Host ""
Write-Host "1. Create a NEW GitHub repository (one for each app)" -ForegroundColor White
Write-Host "   - Go to GitHub → New Repository" -ForegroundColor Gray
Write-Host "   - Name it (e.g., 'admins-app', 'deliverapp', 'userapp')" -ForegroundColor Gray
Write-Host "   - DO NOT initialize with README or .gitignore" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Link and push to GitHub:" -ForegroundColor White
Write-Host "   cd $ParentPath\<repo-name>" -ForegroundColor Gray
Write-Host "   git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git" -ForegroundColor Gray
Write-Host "   git branch -M main" -ForegroundColor Gray
Write-Host "   git push -u origin main" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Configure EAS Build:" -ForegroundColor White
Write-Host "   cd $ParentPath\<repo-name>" -ForegroundColor Gray
Write-Host "   eas init --force" -ForegroundColor Gray
Write-Host ""
Write-Host "   This will create a NEW EAS project ID for this specific app," -ForegroundColor Gray
Write-Host "   ensuring builds are independent and ~130MB → ~40-50MB each" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Delete the old monorepo (AFTER verifying new repos work)" -ForegroundColor Red
Write-Host "   BACKUP FIRST! Then delete: $RootPath" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================`n" -ForegroundColor Yellow
