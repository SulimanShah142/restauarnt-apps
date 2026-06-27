# Complete Fresh Build Script for EAS Production
# This script ensures ALL caches are cleared and new code is uploaded

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "EAS PRODUCTION FRESH BUILD" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Step 1: Check git status
Write-Host "`n[1/7] Checking git status..." -ForegroundColor Yellow
git status
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Git is not configured properly" -ForegroundColor Red
    exit 1
}

# Step 2: Commit any pending changes
Write-Host "`n[2/7] Checking for uncommitted changes..." -ForegroundColor Yellow
$hasChanges = (git status --porcelain)
if ($hasChanges) {
    Write-Host "Found uncommitted changes. Committing..." -ForegroundColor Yellow
    git add .
    $commitMessage = Read-Host "Enter commit message (or press Enter for auto)"
    if ([string]::IsNullOrWhiteSpace($commitMessage)) {
        $commitMessage = "Production build with fresh code - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    }
    git commit -m $commitMessage
    git push origin main
} else {
    Write-Host "No uncommitted changes" -ForegroundColor Green
}

# Step 3: Clear Metro cache
Write-Host "`n[3/7] Clearing Metro cache..." -ForegroundColor Yellow
# Just clear the .expo cache instead of starting metro
Remove-Item -Recurse -Force ".expo" -ErrorAction SilentlyContinue

# Step 4: Clear EAS cache
Write-Host "`n[4/7] Clearing EAS cache..." -ForegroundColor Yellow
Remove-Item -Recurse -Force "$env:USERPROFILE\.expo\state" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:USERPROFILE\.expo\cache" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ".expo" -ErrorAction SilentlyContinue

# Step 5: Export and verify bundle
Write-Host "`n[5/7] Exporting bundle to verify code..." -ForegroundColor Yellow
npx expo export
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Export failed, continuing anyway..." -ForegroundColor Yellow
}

# Step 6: Build with EAS (maximum cache clearing)
Write-Host "`n[6/7] Starting EAS production build..." -ForegroundColor Yellow
Write-Host "This will upload your code fresh from git..." -ForegroundColor Cyan

$env:EAS_BUILD_DISABLE_BUNDLE_JAVASCRIPT_STEP = "1"

eas build --platform android --profile production --clear-cache --non-interactive

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nERROR: EAS build failed!" -ForegroundColor Red
    exit 1
}

# Step 7: Success message
Write-Host "`n[7/7] Build completed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "IMPORTANT NEXT STEPS:" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "1. UNINSTALL the old app from your device completely" -ForegroundColor Red
Write-Host "2. Install the new APK from EAS" -ForegroundColor Green
Write-Host "3. If it crashes, run: adb logcat | findstr 'ReactNativeJS'" -ForegroundColor Yellow
Write-Host "4. Check for missing environment variables" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
