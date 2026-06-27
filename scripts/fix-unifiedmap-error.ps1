# Quick Fix: Comment Out All UnifiedMap Usages

## Run This PowerShell Script

```powershell
cd C:\Users\Administrator\restaurant-app

# Find all UnifiedMap usages and replace with placeholder
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
  Write-Host "Processing $file..."
  $content = Get-Content $file -Raw
  
  # Replace UnifiedMap component with placeholder
  $content = $content -replace '<UnifiedMap\s+[^>]*\/>', '<View style={{ flex: 1, minHeight: 200, justifyContent: "center", alignItems: "center", backgroundColor: "#f0f0f0" }}><Text>🗺️ Map temporarily disabled</Text></View>'
  
  Set-Content $file $content -NoNewline
  Write-Host "✅ Fixed $file"
}

Write-Host "`n🎉 All UnifiedMap usages commented out!"
```

## Or Manually Replace

In each file, find:
```tsx
<UnifiedMap
  ...props
/>
```

Replace with:
```tsx
{/* <UnifiedMap ...props /> */}
<View style={{ flex: 1, minHeight: 200, justifyContent: "center", alignItems: "center", backgroundColor: "#f0f0f0" }}>
  <Text>🗺️ Map temporarily disabled</Text>
</View>
```

## Files to Fix

### User App (4 files)
1. `userapp/app/(tabs)/checkout.tsx`
2. `userapp/app/(tabs)/order-status.tsx` (8 instances)
3. `userapp/app/(tabs)/order.tsx` (2 instances)
4. `userapp/app/track-order.tsx`

### Delivery App (3 files)
1. `deliverapp/app/delivery-task.tsx`
2. `deliverapp/app/(tabs)/orders.tsx`
3. `deliverapp/app/(tabs)/delivery-tracking.tsx`

### Admin App (4 files)
1. `admins-app/app/admin/orders.tsx`
2. `admins-app/app/admin/fleet-overview.tsx`
3. `admins-app/app/admin/delivery-tracking.tsx`
4. `admins-app/app/(tabs)/tracking.tsx`

## After Fixing

```bash
# Reload app
# Shake device → Reload
# Or press 'r' in terminal
```
