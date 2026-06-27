# EAS UPDATE "STUCK ON OLD CODE" - COMPLETE FIX

## ✅ WHAT WAS FIXED

### 1. **Increased fallbackToCacheTimeout** (0ms → 30000ms)
   - **Problem**: Was set to `0`, meaning the app would **immediately fallback** to embedded code if there was ANY issue loading OTA updates
   - **Solution**: Set to `30000ms` (30 seconds) to give OTA updates time to load properly

### 2. **Added explicit update settings**
   - `checkAutomatically: 'ON_LAUNCH'` - Ensures app checks for updates on every launch
   - `enabled: true` - Explicitly enables EAS Updates

---

## 🔍 ROOT CAUSE ANALYSIS

Your app was experiencing the **EAS Update Automatic Rollback** issue:

1. **Old Build Crashed**: The original EAS build had code that crashed on startup
2. **EAS Detected Crash**: Expo's crash detection saw the app fail during initialization
3. **Automatic Rollback Triggered**: EAS automatically reverted to the last "stable" OTA update
4. **Fallback Timeout = 0**: With `fallbackToCacheTimeout: 0`, the app **instantly** fell back to the embedded build code
5. **Cached Failure Flag**: The app stored a "this update failed" flag and refused to use new code

---

## 🚀 HOW TO BUILD FRESH CODE (3 METHODS)

### METHOD 1: Run Diagnostic First ⭐ RECOMMENDED
```powershell
cd userapp
.\diagnose-eas-update.ps1
```
This will show you:
- Current git status
- Runtime version
- Update configuration
- Channel status
- Missing environment variables

### METHOD 2: Automated Fresh Build Script
```powershell
cd userapp
.\build-production-fresh.ps1
```
This script:
- ✅ Commits all changes
- ✅ Clears Metro cache
- ✅ Clears EAS cache
- ✅ Exports and verifies bundle
- ✅ Builds with `--clear-cache` flag
- ✅ Disables bundle caching

### METHOD 3: Manual Complete Rebuild
```powershell
cd userapp

# 1. Ensure code is committed
git add .
git commit -m "Production build - $(Get-Date -Format 'yyyy-MM-dd')"
git push origin main

# 2. Clear ALL caches
Remove-Item -Recurse -Force .expo -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:USERPROFILE\.expo\state" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:USERPROFILE\.expo\cache" -ErrorAction SilentlyContinue

# 3. Build with maximum cache clearing
$env:EAS_BUILD_DISABLE_BUNDLE_JAVASCRIPT_STEP = "1"
eas build --platform android --profile production --clear-cache
```

---

## ⚠️ CRITICAL: AFTER BUILD - MUST UNINSTALL OLD APP

**This is the #1 reason builds appear "stuck":**

1. **UNINSTALL** the old app from your device **COMPLETELY**
2. Install the new APK
3. The old app has cached "rollback" flags that prevent new code from loading

### Why Uninstalling is Required:
- EAS stores update failure flags in app storage
- These flags tell the app "this version crashed, use old code"
- Only a complete uninstall clears this cache
- Simply reinstalling over the old app **does not** clear the cache

---

## 🔧 IF APP STILL CRASHES AFTER REBUILD

### Step 1: Check Device Logs
```bash
# Connect device via USB with debugging enabled
adb logcat | findstr "ReactNativeJS"
```

Look for:
- `TypeError`, `ReferenceError`, `SyntaxError` - JavaScript crashes
- `ONESIGNAL`, `SUPABASE`, `API` - Missing configuration
- `Network`, `timeout` - API/connection issues

### Step 2: Verify Environment Variables
The build might be missing environment variables that exist locally.

**Check what's needed:**
```powershell
cd userapp
type .env.example
```

**Set environment variables in EAS:**
```bash
eas env:create --environment production --name YOUR_VAR_NAME --value YOUR_VALUE
```

### Step 3: Increment Runtime Version (If Making Native Changes)
If you changed native code (gradle, permissions, etc.):

In `app.config.js`:
```javascript
runtimeVersion: '1.0.9',  // Increment from 1.0.8
```

Then rebuild:
```bash
eas build --platform android --profile production --clear-cache
```

---

## 📊 EAS UPDATE CHANNEL STATUS

Your current setup:
- **Channel**: `production`
- **Branch**: `production`
- **Project ID**: `4bf38f36-5b72-47d0-9eaa-9993c4b2ee8e`

**Verify channel is receiving updates:**
```bash
eas update:list --branch production
eas channel:view production
```

---

## 🔥 NUCLEAR OPTION: Disable EAS Updates Temporarily

If you want to **completely disable** OTA updates and only use embedded builds:

In `app.config.js`:
```javascript
updates: {
  url: 'https://u.expo.dev/4bf38f36-5b72-47d0-9eaa-9993c4b2ee8e',
  fallbackToCacheTimeout: 0,
  checkAutomatically: 'NEVER',  // ← Change this
  enabled: false,                 // ← And this
},
```

Then rebuild and reinstall. The app will **only** use the code embedded in the APK.

---

## ✅ PRE-BUILD CHECKLIST

Before every EAS production build:

- [ ] All code committed to git (`git status` shows clean)
- [ ] Changes pushed to remote (`git push origin main`)
- [ ] Runtime version incremented (if native changes)
- [ ] `.easignore` not excluding critical files
- [ ] Environment variables configured in EAS
- [ ] `.env` file not in `.easignore` (if using secrets)
- [ ] Run `npx expo export` locally to verify bundle works
- [ ] Old app **uninstalled** from test device

---

## 📞 TROUBLESHOOTING COMMANDS

```bash
# View EAS channels
eas channel:list

# View updates on production branch
eas update:list --branch production

# Publish OTA update (if build is already running)
eas update --branch production --message "Hotfix description"

# Check build status
eas build:list --platform android --status in_progress

# View build logs (replace with your build ID)
eas build:view [BUILD_ID]
```

---

## 🎯 QUICK FIX SUMMARY

**The fastest way to get your new code running:**

1. Run: `.\build-production-fresh.ps1`
2. **UNINSTALL** old app from device
3. Install new APK from EAS
4. If it crashes: `adb logcat | findstr "ReactNativeJS"` to see errors
5. Fix errors, rebuild, repeat

---

**Last Updated**: 2026-04-12
**Runtime Version**: 1.0.8
**Build Profile**: production
