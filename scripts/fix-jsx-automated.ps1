#!/usr/bin/env pwsh

# Automated Fix for Broken JSX from UnifiedMap Comment-Out
# This script properly fixes all broken JSX syntax

Write-Host "🔧 Starting automated JSX fix..." -ForegroundColor Cyan
Write-Host ""

$filesToFix = @(
    # Admin App
    "admins-app\app\admin\orders.tsx",
    "admins-app\app\admin\delivery-tracking.tsx",
    "admins-app\app\admin\fleet-overview.tsx",
    "admins-app\app\(tabs)\tracking.tsx",
    
    # Delivery App
    "deliverapp\app\delivery-task.tsx",
    "deliverapp\app\(tabs)\orders.tsx",
    "deliverapp\app\(tabs)\delivery-tracking.tsx",
    
    # User App
    "userapp\app\(tabs)\checkout.tsx",
    "userapp\app\(tabs)\order-status.tsx",
    "userapp\app\(tabs)\order.tsx",
    "userapp\app\track-order.tsx"
)

$fixCount = 0
$errorCount = 0

foreach ($file in $filesToFix) {
    $fullPath = Join-Path "C:\Users\Administrator\restaurant-app" $file
    
    if (Test-Path $fullPath) {
        Write-Host "Processing: $file" -ForegroundColor Yellow
        
        try {
            $content = Get-Content $fullPath -Raw -Encoding UTF8
            
            # Fix broken fragment closings
            $content = $content -replace '</> \*/}', '</>}'
            
            # Fix broken UnifiedMap comments (remove the comment markers, keep the component)
            # This restores the original JSX structure
            $content = $content -replace '{/\* <UnifiedMap', '<UnifiedMap'
            $content = $content -replace 'UnifiedMap /> \*/}', 'UnifiedMap />'
            
            # Fix any remaining broken patterns
            $content = $content -replace '</> \*/}', '</>}'
            $content = $content -replace '<View style=\{\{ flex: 1, minHeight: \d+, justifyContent: ''center'', alignItems: ''center'', backgroundColor: ''#f0f0f0'' \}\}>', ''
            $content = $content -replace '<Text>🗺️ Map temporarily disabled.*?</Text>', ''
            
            Set-Content -Path $fullPath -Value $content -Encoding UTF8 -NoNewline
            
            Write-Host "  ✅ Fixed" -ForegroundColor Green
            $fixCount++
        }
        catch {
            Write-Host "  ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
            $errorCount++
        }
    }
    else {
        Write-Host "  ⚠️ File not found" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Fix Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ Fixed: $fixCount files"
Write-Host "  ❌ Errors: $errorCount files"
Write-Host ""
Write-Host "Next: Reload your apps (shake device → Reload)" -ForegroundColor Yellow
Write-Host ""
