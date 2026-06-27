# EAS Update Diagnostic Script
# Run this to check your update configuration

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "EAS UPDATE DIAGNOSTICS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check 1: Git status
Write-Host "`n[1] Git Status:" -ForegroundColor Yellow
$currentBranch = git branch --show-current
Write-Host "  Branch: $currentBranch" -ForegroundColor $(if ($currentBranch -eq "main") { "Green" } else { "Red" })

$isClean = (git status --porcelain) -eq ""
Write-Host "  Working tree clean: $(if ($isClean) { "YES ✓" } else { "NO ✗" })" -ForegroundColor $(if ($isClean) { "Green" } else { "Red" })

# Check 2: Runtime version
Write-Host "`n[2] Runtime Version:" -ForegroundColor Yellow
$configContent = Get-Content "app.config.js" -Raw
if ($configContent -match "runtimeVersion:\s*'([^']+)'") {
    $runtimeVersion = $matches[1]
    Write-Host "  Current runtime: $runtimeVersion" -ForegroundColor Green
    Write-Host "  ⚠️  IMPORTANT: Must increment for new builds!" -ForegroundColor Yellow
}

# Check 3: Updates configuration
Write-Host "`n[3] Updates Configuration:" -ForegroundColor Yellow
if ($configContent -match "fallbackToCacheTimeout:\s*(\d+)") {
    $timeout = $matches[1]
    Write-Host "  fallbackToCacheTimeout: ${timeout}ms" -ForegroundColor $(if ([int]$timeout -eq 0) { "Red" } else { "Green" })
    if ([int]$timeout -eq 0) {
        Write-Host "  ⚠️  WARNING: Set to 0 - will immediately fallback to embedded code!" -ForegroundColor Red
    }
}

# Check 4: Channel configuration
Write-Host "`n[4] EAS Channels:" -ForegroundColor Yellow
Write-Host "Checking production channel..." -ForegroundColor Cyan
$channelOutput = npx eas channel:list --json 2>&1
if ($channelOutput -match '"production"') {
    Write-Host "  ✓ Production channel exists" -ForegroundColor Green
} else {
    Write-Host "  ✗ Production channel NOT found!" -ForegroundColor Red
}

# Check 5: .easignore check
Write-Host "`n[5] Critical Files Check:" -ForegroundColor Yellow
$criticalFiles = @("app.config.js", "package.json", "app")
foreach ($file in $criticalFiles) {
    $exists = Test-Path $file
    Write-Host "  $file : $(if ($exists) { "EXISTS ✓" } else { "MISSING ✗" })" -ForegroundColor $(if ($exists) { "Green" } else { "Red" })
}

# Check 6: Environment variables
Write-Host "`n[6] Environment Variables (.env check):" -ForegroundColor Yellow
$envFileExists = Test-Path ".env"
Write-Host "  .env file: $(if ($envFileExists) { "EXISTS ✓" } else { "NOT FOUND ✗" })" -ForegroundColor $(if ($envFileExists) { "Green" } else { "Red" })

# Read from .env file instead of system env
if ($envFileExists) {
    $envContent = Get-Content ".env"
    Write-Host "  Required env vars from .env:" -ForegroundColor Cyan
    @("ONESIGNAL_APP_ID", "ONESIGNAL_REST_API_KEY", "EXPO_PUBLIC_ONESIGNAL_APP_ID", 
      "EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY") | ForEach-Object {
        $varName = $_
        $line = $envContent | Where-Object { $_ -match "^$varName=" }
        $hasValue = $line -ne $null -and ($line -split '=', 2)[1] -ne ""
        # Mask the value for security
        if ($hasValue) {
            $rawValue = ($line -split '=', 2)[1]
            $maskedValue = if ($rawValue.Length -gt 10) { $rawValue.Substring(0, 4) + "****" + $rawValue.Substring($rawValue.Length - 4) } else { "****" }
            Write-Host "    $varName : SET ✓ ($maskedValue)" -ForegroundColor Green
        } else {
            Write-Host "    $varName : NOT SET ✗" -ForegroundColor Red
        }
    }
}

# Check 7: Recent commits
Write-Host "`n[7] Recent Commits:" -ForegroundColor Yellow
git log --oneline -3 | ForEach-Object { Write-Host "  $_" }

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "DIAGNOSTIC COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nRECOMMENDATIONS:" -ForegroundColor Yellow
Write-Host "1. If code is stuck: UNINSTALL app from device, rebuild, reinstall" -ForegroundColor White
Write-Host "2. Increment runtimeVersion if making native changes" -ForegroundColor White
Write-Host "3. Run: .\build-production-fresh.ps1 for a clean build" -ForegroundColor White
Write-Host "4. Check logs: adb logcat | findstr 'ReactNativeJS'" -ForegroundColor White
