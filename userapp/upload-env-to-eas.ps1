# Upload Environment Variables to EAS
# This script uploads all required env vars from .env to EAS production environment

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "UPLOADING ENV VARS TO EAS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Read .env file
$envFile = ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: .env file not found!" -ForegroundColor Red
    exit 1
}

$envContent = Get-Content $envFile

# Define required variables
$envVars = @(
    "EXPO_PUBLIC_SUPABASE_URL",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
    "EXPO_PUBLIC_SUPABASE_KEY",
    "ONESIGNAL_APP_ID",
    "EXPO_PUBLIC_ONESIGNAL_APP_ID",
    "EXPO_PUBLIC_MAPTILER_KEY",
    "EXPO_PUBLIC_LOCATION_IQ_TOKEN",
    "EXPO_PUBLIC_ADMIN_EMAIL",
    "EXPO_NO_DOCTOR"
)

Write-Host "`nUploading variables to EAS production environment..." -ForegroundColor Yellow
Write-Host ""

$uploaded = 0
$failed = 0

foreach ($varName in $envVars) {
    # Find the variable in .env
    $line = $envContent | Where-Object { $_ -match "^$varName=" }
    
    if ($line) {
        $value = ($line -split '=', 2)[1]
        
        # Skip empty values
        if ([string]::IsNullOrWhiteSpace($value)) {
            Write-Host "[SKIP] $varName - empty value" -ForegroundColor Yellow
            continue
        }
        
        Write-Host "[UPLOAD] $varName" -ForegroundColor Cyan
        
        # Upload to EAS
        $process = Start-Process -FilePath "eas" -ArgumentList "env:create", "--environment", "production", "--name", $varName, "--value", $value, "--force" -Wait -NoNewWindow -PassThru
        
        if ($process.ExitCode -eq 0) {
            Write-Host "  [SUCCESS] $varName uploaded" -ForegroundColor Green
            $uploaded++
        } else {
            Write-Host "  [FAILED] $varName upload failed" -ForegroundColor Red
            $failed++
        }
        
        # Small delay to avoid rate limiting
        Start-Sleep -Milliseconds 500
    } else {
        Write-Host "[SKIP] $varName - not found in .env" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "UPLOAD COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Uploaded: $uploaded" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host ""
Write-Host "Next step: Run 'eas build --platform android --profile production --clear-cache'" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
