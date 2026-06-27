# UserApp Build Issues - Cache Problem Solution

## Problem
Code changes don't appear after rebuilding the app. This is caused by **aggressive caching** in:
- Metro bundler
- Babel compiler
- Expo CLI
- Gradle (Android)
- npm

## Solution

### Quick Fix (Before Every Build)
Run the clean script:
```powershell
.\clean-all.ps1
```

Then rebuild:
```powershell
.\build-production.ps1
```

### What the Clean Script Does
1. **Stops all processes** - Node, Expo, ADB
2. **Clears project caches**:
   - `.expo` folder
   - `.expo-shared` folder
   - `.parcel-cache`
   - `node_modules/.cache`
   - `dist` folder
3. **Clears system caches**:
   - `%APPDATA%\expo` (global Expo cache)
   - npm cache
   - Windows temp files
4. **Clears Android build cache**:
   - `.gradle` folder
   - `android/app/build`
   - `android/build`

### Manual Clean (If Script Fails)
```powershell
# Navigate to userapp
cd C:\Users\Administrator\restaurant-app\userapp

# Stop processes
Stop-Process -Name "node" -Force
Stop-Process -Name "expo" -Force

# Delete caches
Remove-Item -Recurse -Force .expo
Remove-Item -Recurse -Force .expo-shared
Remove-Item -Recurse -Force .parcel-cache
Remove-Item -Recurse -Force node_modules\.cache
Remove-Item -Recurse -Force .gradle
Remove-Item -Recurse -Force android\app\build
Remove-Item -Recurse -Force android\build
Remove-Item -Recurse -Force "$env:APPDATA\expo"

# Clean npm cache
npm cache clean --force

# Reinstall dependencies
npm install
```

### Development Mode (Testing Changes)
When testing changes locally:
```powershell
# Start with clean cache
npx expo start --clear

# OR
npx expo start -c
```

### Configuration Changes Made
The following files were updated to reduce caching:

**babel.config.js**
```javascript
api.cache(false); // Changed from api.cache(true)
```

**metro.config.js**
```javascript
// Dynamic cache version in development
if (process.env.NODE_ENV !== 'production') {
  config.cacheVersion = Date.now().toString();
}
```

## Build Order
1. Make your code changes
2. Run `.\clean-all.ps1`
3. Run `.\build-production.ps1`

## Common Issues

### "Changes still don't appear"
- Make sure you ran `clean-all.ps1` BEFORE building
- Check that all Node processes are stopped
- Try restarting your computer (clears locked files)

### "Build fails after clean"
- Run `npm install` first to reinstall dependencies
- Check npm/node version compatibility
- Ensure you have enough disk space

### "Metro bundler stuck"
```powershell
# Kill Metro process
Stop-Process -Name "node" -Force

# Clear Metro cache manually
Remove-Item -Recurse -Force node_modules\.cache

# Restart
npx expo start -c
```

## Prevention
- Always run `clean-all.ps1` before production builds
- Use `npx expo start -c` for development
- Don't keep dev servers running for days (restart daily)
- Update dependencies regularly
