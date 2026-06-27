# Fix All Broken Comment Syntax

Run these PowerShell commands to fix all broken `</> */}` patterns:

```powershell
cd C:\Users\Administrator\restaurant-app

# Fix admins-app
Get-ChildItem -Path "admins-app" -Recurse -Filter "*.tsx" -Exclude "node_modules" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $content = $content -replace '</> \*/}', '</>}'
    $content = $content -replace '{/\* <UnifiedMap', '{/* <UnifiedMap'
    $content = $content -replace 'UnifiedMap /> \*/}', 'UnifiedMap /> */}'
    Set-Content $_.FullName $content -NoNewline
    Write-Host "Fixed: $($_.Name)"
}

# Fix deliverapp  
Get-ChildItem -Path "deliverapp" -Recurse -Filter "*.tsx" -Exclude "node_modules" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $content = $content -replace '</> \*/}', '</>}'
    $content = $content -replace '{/\* <UnifiedMap', '{/* <UnifiedMap'
    $content = $content -replace 'UnifiedMap /> \*/}', 'UnifiedMap /> */}'
    Set-Content $_.FullName $content -NoNewline
    Write-Host "Fixed: $($_.Name)"
}

# Fix userapp
Get-ChildItem -Path "userapp" -Recurse -Filter "*.tsx" -Exclude "node_modules" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $content = $content -replace '</> \*/}', '</>}'
    $content = $content -replace '{/\* <UnifiedMap', '{/* <UnifiedMap'
    $content = $content -replace 'UnifiedMap /> \*/}', 'UnifiedMap /> */}'
    Set-Content $_.FullName $content -NoNewline
    Write-Host "Fixed: $($_.Name)"
}

Write-Host "`n✅ All files fixed!" -ForegroundColor Green
```

## Manual Fix (If Script Fails)

Search for these patterns and fix manually:

1. `</> */}` → `</>}`
2. `{/* <UnifiedMap` → Keep as is (this is correct)
3. `UnifiedMap /> */}` → `UnifiedMap /> */}`

## After Fixing

```bash
# Reload apps
# Shake device → Reload
# Or press 'r' in terminal
```
