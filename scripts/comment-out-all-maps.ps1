# Comment out all UnifiedMap usages in all three apps

Write-Host "🔧 Commenting out all UnifiedMap components..." -ForegroundColor Cyan

$files = @(
  "userapp\app\(tabs)\checkout.tsx",
  "userapp\app\(tabs)\order-status.tsx",
  "userapp\app\(tabs)\order.tsx",
  "userapp\app\track-order.tsx",
  "deliverapp\app\delivery-task.tsx",
  "deliverapp\app\(tabs)\orders.tsx",
  "deliverapp\app\(tabs)\delivery-tracking.tsx",
  "admins-app\app\admin\orders.tsx",
  "admins-app\app\admin\fleet-overview.tsx",
  "admins-app\app\admin\delivery-tracking.tsx",
  "admins-app\app\(tabs)\tracking.tsx"
)

foreach ($file in $files) {
  $fullPath = Join-Path "C:\Users\Administrator\restaurant-app" $file
  Write-Host "Processing $file..."
  
  if (Test-Path $fullPath) {
    $content = Get-Content $fullPath -Raw
    
    # Replace UnifiedMap component with placeholder comment
    $placeholder = "{/* <UnifiedMap temporarily commented out for rebuild /> */}`n                      <View style={{ flex: 1, minHeight: 300, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }}>
                        <Text>🗺️ Map temporarily disabled - will be enabled after notifications setup</Text>
                      </View>"
    
    # Simple replacement
    $content = $content -replace '<UnifiedMap\s+[^>]*\/>', $placeholder
    
    Set-Content $fullPath $content -NoNewline
    Write-Host "  ✅ Fixed" -ForegroundColor Green
  } else {
    Write-Host "  ⚠️ File not found" -ForegroundColor Yellow
  }
}

Write-Host "`n🎉 All UnifiedMap usages commented out!" -ForegroundColor Green
Write-Host "`nNext: Reload your app (shake device → Reload)" -ForegroundColor Yellow
