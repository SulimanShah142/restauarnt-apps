# Split Monorepo into Separate Repositories
# This script creates three independent repos from the monorepo

$ErrorActionPreference = "Stop"
$RootPath = "C:\Users\Administrator\restaurant-app"
$ParentPath = "C:\Users\Administrator"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Splitting Monorepo into Separate Repos" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Function to copy app directory with shared files
function Copy-AppRepo {
    param(
        [string]$AppName,
        [string]$SourcePath,
        [string]$DestPath
    )
    
    Write-Host "`nProcessing $AppName..." -ForegroundColor Yellow
    
    # Remove existing directory if it exists
    if (Test-Path $DestPath) {
        Write-Host "  Removing existing $AppName directory..." -ForegroundColor Gray
        Remove-Item -Recurse -Force $DestPath
    }
    
    # Create new directory
    Write-Host "  Creating new $AppName directory..." -ForegroundColor Gray
    New-Item -ItemType Directory -Path $DestPath -Force | Out-Null
    
    # Copy app directory (excluding node_modules and .git)
    Write-Host "  Copying app files..." -ForegroundColor Gray
    robocopy $SourcePath $DestPath /MIR /XD node_modules .git .expo dist /XF *.tsbuildinfo /NFL /NDL /NJH /NJS /NC /NS /NP
    
    # Copy shared directories/files that this app might use
    $SharedItems = @(
        "hooks",
        "utils", 
        "types",
        "prisma",
        "scripts",
        "supabase",
        "lib"
    )
    
    foreach ($item in $SharedItems) {
        $source = Join-Path $RootPath $item
        $dest = Join-Path $DestPath $item
        if (Test-Path $source) {
            Write-Host "  Copying shared: $item" -ForegroundColor Gray
            if (-not (Test-Path (Split-Path $dest))) {
                New-Item -ItemType Directory -Path (Split-Path $dest) -Force | Out-Null
            }
            robocopy $source $dest /MIR /XD node_modules .git /NFL /NDL /NJH /NJS /NC /NS /NP
        }
    }
    
    # Copy root-level shared files
    $RootFiles = @(
        ".gitignore",
        ".env.example",
        "package.json",
        "tsconfig.json",
        "eas.json",
        ".npmrc",
        ".easignore",
        "README.md"
    )
    
    foreach ($file in $RootFiles) {
        $source = Join-Path $RootPath $file
        $dest = Join-Path $DestPath $file
        if (Test-Path $source) {
            if (-not (Test-Path $dest)) {
                Write-Host "  Copying root file: $file" -ForegroundColor Gray
                Copy-Item $source $dest -Force
            }
        }
    }
    
    Write-Host "  ✓ $AppName files copied successfully" -ForegroundColor Green
}

# Process each app
$Apps = @(
    @{Name="admins-app"; Source="admins-app"; Dest="admins-app-repo"},
    @{Name="deliverapp"; Source="deliverapp"; Dest="deliverapp-repo"},
    @{Name="userapp"; Source="userapp"; Dest="userapp-repo"}
)

foreach ($app in $Apps) {
    $sourcePath = Join-Path $RootPath $app.Source
    $destPath = Join-Path $ParentPath $app.Dest
    
    if (Test-Path $sourcePath) {
        Copy-AppRepo -AppName $app.Name -SourcePath $sourcePath -DestPath $destPath
    } else {
        Write-Host "  ✗ Source not found: $($app.Source)" -ForegroundColor Red
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "1. Each app repo is ready in: $ParentPath" -ForegroundColor White
Write-Host "   - admins-app-repo" -ForegroundColor White
Write-Host "   - deliverapp-repo" -ForegroundColor White  
Write-Host "   - userapp-repo" -ForegroundColor White
Write-Host ""
Write-Host "2. Initialize git repos (run separately for each):" -ForegroundColor White
Write-Host "   cd $ParentPath\admins-app-repo" -ForegroundColor Gray
Write-Host "   git init && git add . && git commit -m 'Initial commit'" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Add remotes:" -ForegroundColor White
Write-Host "   git remote add origin <your-github-repo-url>" -ForegroundColor Gray
Write-Host "   git push -u origin main" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Remove old monorepo when ready:" -ForegroundColor White
Write-Host "   WARNING: Backup first! Then delete this directory" -ForegroundColor Red
Write-Host ""
Write-Host "========================================`n" -ForegroundColor Cyan
