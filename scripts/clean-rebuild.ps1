# ======================================
# Restaurant Apps - Clean Rebuild Script
# ======================================
# This script performs a complete clean rebuild of all three apps
# ======================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Restaurant Apps - Clean Rebuild" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "📁 Project Root: $scriptDir" -ForegroundColor Yellow
Write-Host ""

# Function to clean and rebuild an app
function Rebuild-App {
    param(
        [string]$AppName,
        [string]$AppPath
    )
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Rebuilding: $AppName" -ForegroundColor White
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Check if app directory exists
    if (-not (Test-Path $AppPath)) {
        Write-Host "❌ Error: App directory not found: $AppPath" -ForegroundColor Red
        return $false
    }
    
    Set-Location $AppPath
    
    # Step 1: Clean node_modules
    Write-Host "🧹 Cleaning node_modules..." -ForegroundColor Yellow
    if (Test-Path "node_modules") {
        Remove-Item -Recurse -Force "node_modules"
        Write-Host "✅ node_modules cleaned" -ForegroundColor Green
    } else {
        Write-Host "ℹ️  node_modules not found (already clean)" -ForegroundColor Gray
    }
    
    # Step 2: Clean .expo cache
    Write-Host "🧹 Cleaning .expo cache..." -ForegroundColor Yellow
    if (Test-Path ".expo") {
        Remove-Item -Recurse -Force ".expo"
        Write-Host "✅ .expo cache cleaned" -ForegroundColor Green
    } else {
        Write-Host "ℹ️  .expo not found (already clean)" -ForegroundColor Gray
    }
    
    # Step 3: Clean dist folder
    Write-Host "🧹 Cleaning dist folder..." -ForegroundColor Yellow
    if (Test-Path "dist") {
        Remove-Item -Recurse -Force "dist"
        Write-Host "✅ dist folder cleaned" -ForegroundColor Green
    } else {
        Write-Host "ℹ️  dist not found (already clean)" -ForegroundColor Gray
    }
    
    # Step 4: Clean Metro cache
    Write-Host "🧹 Cleaning Metro cache..." -ForegroundColor Yellow
    if (Test-Path ".metro-cache") {
        Remove-Item -Recurse -Force ".metro-cache"
        Write-Host "✅ Metro cache cleaned" -ForegroundColor Green
    } else {
        Write-Host "ℹ️  .metro-cache not found (already clean)" -ForegroundColor Gray
    }
    
    # Step 5: Check .env file
    Write-Host "🔐 Checking .env file..." -ForegroundColor Yellow
    if (Test-Path ".env") {
        Write-Host "✅ .env file found" -ForegroundColor Green
    } else {
        Write-Host "⚠️  .env file not found! Please create it from .env.example" -ForegroundColor Orange
    }
    
    # Step 6: Install dependencies
    Write-Host "📦 Installing dependencies with pnpm..." -ForegroundColor Yellow
    Write-Host ""
    
    # Check if pnpm is installed
    $pnpmExists = Get-Command pnpm -ErrorAction SilentlyContinue
    if (-not $pnpmExists) {
        Write-Host "❌ pnpm is not installed. Installing globally..." -ForegroundColor Red
        npm install -g pnpm
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Failed to install pnpm. Please install it manually." -ForegroundColor Red
            Set-Location $scriptDir
            return $false
        }
    }
    
    # Install dependencies
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
        Set-Location $scriptDir
        return $false
    }
    
    Write-Host ""
    Write-Host "✅ $AppName rebuild complete!" -ForegroundColor Green
    Set-Location $scriptDir
    return $true
}

# Main execution
$startTime = Get-Date

Write-Host "⏰ Started at: $($startTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Cyan
Write-Host ""

# Rebuild all three apps
$apps = @(
    @{ Name = "📱 User App"; Path = "userapp" },
    @{ Name = "🚴 Delivery App"; Path = "deliverapp" },
    @{ Name = "👨‍💼 Admin App"; Path = "admins-app" }
)

$successCount = 0
$failCount = 0

foreach ($app in $apps) {
    $result = Rebuild-App -AppName $app.Name -AppPath $app.Path
    
    if ($result) {
        $successCount++
    } else {
        $failCount++
    }
    
    # Small delay between apps
    Start-Sleep -Seconds 2
}

# Summary
$endTime = Get-Date
$duration = $endTime - $startTime

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Rebuild Summary" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "⏰ Started:  $($startTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Cyan
Write-Host "⏰ Finished: $($endTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Cyan
Write-Host "⏱️  Duration: $($duration.Minutes)m $($duration.Seconds)s" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Successful: $successCount / $($apps.Count)" -ForegroundColor Green
if ($failCount -gt 0) {
    Write-Host "❌ Failed: $failCount / $($apps.Count)" -ForegroundColor Red
}
Write-Host ""

if ($successCount -eq $apps.Count) {
    Write-Host "🎉 All apps rebuilt successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🚀 Next steps:" -ForegroundColor Yellow
    Write-Host "   1. cd userapp && npx expo start" -ForegroundColor White
    Write-Host "   2. cd deliverapp && npx expo start" -ForegroundColor White
    Write-Host "   3. cd admins-app && npx expo start" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "⚠️  Some apps failed to rebuild. Check the errors above." -ForegroundColor Orange
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Return to script directory
Set-Location $scriptDir
