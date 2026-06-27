# UserApp Build Fix - Silent Rollback & Git Source Mismatch

## Problem
When building the userapp, the new build was picking up old code instead of the new changes, even after OTA updates fixed the errors. This was caused by:

1. **Silent Rollback**: Expo's Emergency Recovery feature was rolling back to the last known working bundle
2. **OTA Update Logic in _layout.tsx**: Code was checking for OTA updates on startup, causing conflicts
3. **Stale Native Folders**: android/ios folders may have cached old bundles

## Fixes Applied

### 1. Disabled OTA Updates in app.config.js ✅
```javascript
updates: {
  enabled: false,
  // url: 'https://u.expo.dev/e6467c5c-fc6a-4ec8-b512-feb4045a4582',
  // fallbackToCacheTimeout: 0,
},
```

**Why**: Prevents Expo from automatically rolling back to previous versions when the app encounters any startup error.

### 2. Removed OTA Update Logic from _layout.tsx ✅
- Removed the `import * as Updates from 'expo-updates'` 
- Removed the OTA update check code that was running on app startup
- This prevents the app from trying to download/reload OTA updates

**Why**: With updates disabled in config, this code was unnecessary and could cause confusion/conflicts.

### 3. Git Status Verified ✅
- Confirmed all changes are committed: `git status` shows clean working tree
- EAS Build will now pull the latest code from Git

### 4. eas.json Configuration ✅
- Current channel configuration is fine (development, preview, production)
- Each build profile uses a separate channel to avoid conflicts
- Cache key set to "fresh-build-v1" to force fresh builds

## Build Instructions

### Before Building (REQUIRED STEPS)

```bash
cd C:\Users\Administrator\restaurant-app\userapp

# 1. Delete native folders (they may have stale bundles)
rmdir /s /q android
rmdir /s /q ios

# 2. Verify git status is clean
git status

# 3. If any changes, commit them
git add .
git commit -m "fix: [describe your changes]"

# 4. Push to git (EAS pulls from remote)
git push
```

### Build Commands

#### Local Build (uses local code directly)
```bash
cd C:\Users\Administrator\restaurant-app\userapp
npx expo prebuild --clean
npx expo run:android --variant Release
```

#### EAS Build (remote - pulls from Git)
```bash
cd C:\Users\Administrator\restaurant-app\userapp

# Development build
eas build --profile development --platform android

# Preview build
eas build --profile preview --platform android

# Production build
eas build --profile production --platform android
```

### After Building

1. **Uninstall old app** from your device/emulator (to clear any cached OTA updates)
2. **Install the new APK**
3. **Test thoroughly** - the app should now run with the baked-in code

## How to Verify the Fix Worked

1. **Check app.config.js**: `updates.enabled` should be `false`
2. **Check _layout.tsx**: No `Updates.checkForUpdateAsync()` calls
3. **Build succeeds**: No silent rollbacks
4. **App runs correctly**: New code is active immediately

## Re-enabling OTA Updates (Future)

If you want to re-enable OTA updates in the future:

1. **After a stable build is working**, update app.config.js:
```javascript
updates: {
  enabled: true,
  url: 'https://u.expo.dev/e6467c5c-fc6a-4ec8-b512-feb4045a4582',
  fallbackToCacheTimeout: 0,
},
```

2. **Add back OTA logic** to _layout.tsx (optional - only if you want auto-updates)

3. **Use different channels** for OTA vs builds:
```bash
# Push OTA update to preview channel
eas update --channel preview --message "Bug fixes"

# Build always goes to production channel
eas build --profile production
```

## Key Takeaways

- **Always commit code to git** before EAS build (EAS pulls from git, not your folders)
- **Disable updates during development** to prevent silent rollbacks
- **Delete android/ios folders** if you suspect stale bundles
- **Uninstall old app** before testing new builds
- **Use different channels** for OTA updates vs production builds

## Troubleshooting

### App still crashes after build
1. Check logs: `adb logcat | grep -i "userapp\|expo\|react"`
2. Look for errors in the first 10 seconds of app startup
3. The crash is likely in your code, not an OTA issue

### Build still uses old code
1. Verify `git push` completed successfully
2. Check EAS build logs to see which commit was pulled
3. Try `eas build --profile production --platform android --clear-cache`

### OTA update conflicts
1. Uninstall app completely from device
2. Clear app data: Settings > Apps > AYAR Food > Clear Data
3. Install fresh build
