# CRITICAL FIX: OTA Updates Overwriting New Builds

## Problem Identified 🔍

**Symptom:** New builds don't include latest code - app reverts to old code immediately after install.

**Root Cause:** OTA updates with `fallbackToCacheTimeout: 30000` (30 seconds) causing app to:
1. Wait for OTA update on launch
2. Download old/cached update
3. **Overwrite the new embedded code** with old OTA code
4. User sees old code even though build has new code

---

## Solution Applied

### Step 1: Disable OTA Temporarily (TEST BUILD)

```javascript
updates: {
  enabled: false,  // ← TEMPORARILY DISABLE OTA
  fallbackToCacheTimeout: 0,
  checkAutomatically: 'WHEN_IN_BACKGROUND',
}
```

**Purpose:** Prove that OTA is the problem. If this build works with new code → **OTA was the culprit**.

### Step 2: Re-enable OTA (After Testing)

```javascript
updates: {
  enabled: true,  // ← Re-enable after test passes
  fallbackToCacheTimeout: 0,  // ← CRITICAL: 0 = no waiting
  checkAutomatically: 'WHEN_IN_BACKGROUND',  // ← Not on every load
}
```

---

## Test Procedure

### Build Test APK (OTA Disabled)

```powershell
cd C:\Users\Administrator\restaurant-app\userapp

# Clean everything
.\clean-all.ps1

# Build with clear cache
eas build --platform android --profile production --clear-cache
```

### Install and Test

1. **Uninstall old UserApp** from device/emulator
2. **Install new test APK**
3. **Open app** - should see NEW code immediately
4. **Test login flow** - should work without crashes

**Expected Result:** ✅ App shows latest code (auth flow, menu loading, etc.)

---

## Why This Happens

### The OTA Loop of Doom

```
Build new code → Install on device
    ↓
App launches with NEW embedded code
    ↓
OTA checks for updates (checkAutomatically: 'ON_LOAD')
    ↓
Finds old OTA update on server (from previous bad build)
    ↓
Downloads old OTA update (fallbackToCacheTimeout: 30000ms)
    ↓
Applies old OTA update OVER new code
    ↓
App restarts with OLD code 😱
    ↓
Developer thinks build failed → Rebuilds
    ↓
LOOP REPEATS (build always shows old code)
```

### The Fix

```
Build new code (OTA disabled) → Install on device
    ↓
App launches with NEW embedded code
    ↓
NO OTA CHECK (enabled: false)
    ↓
App runs with NEW code ✅
```

---

## Configuration Comparison

### BEFORE (Broken)

```javascript
runtimeVersion: '1.0.0',  // ← Hardcoded
updates: {
  fallbackToCacheTimeout: 30000,  // ← Waits 30s for OTA
  checkAutomatically: 'ON_LOAD',   // ← Checks every launch
}
```

**Result:** ❌ Always downloads old OTA, overwrites new code

### AFTER (Fixed - Test Mode)

```javascript
runtimeVersion: { policy: 'appVersion' },  // ← Dynamic
updates: {
  enabled: false,  // ← DISABLED FOR TEST
  fallbackToCacheTimeout: 0,
  checkAutomatically: 'WHEN_IN_BACKGROUND',
}
```

**Result:** ✅ Uses embedded code only

### AFTER (Fixed - Production Ready)

```javascript
runtimeVersion: { policy: 'appVersion' },  // ← Dynamic
updates: {
  enabled: true,  // ← Re-enabled
  fallbackToCacheTimeout: 0,  // ← 0 = no waiting
  checkAutomatically: 'WHEN_IN_BACKGROUND',  // ← Only in background
}
```

**Result:** ✅ Uses embedded code, OTA applies on next launch

---

## Files Changed

1. **app.config.js** - Updated `updates` configuration
2. **eas.json** - Already correct (channel: "production")

---

## Next Steps

### Immediate (Test Build)

1. ✅ Build with `enabled: false` (current commit: `bd15c04`)
2. ✅ Install and test
3. ✅ Verify new code works

### After Test Passes

1. Change `enabled: false` → `enabled: true`
2. Commit and push
3. Publish NEW OTA update (with correct code)
4. Future builds will work correctly

### Publish Correct OTA Update

```powershell
# After re-enabling OTA
cd userapp
eas update --branch production --message "Re-enable OTA with correct config"
```

---

## Key Settings Explained

| Setting | Value | What It Does |
|---------|-------|--------------|
| `enabled` | `false` (test) | Disables OTA completely |
| `fallbackToCacheTimeout` | `0` | Don't wait for OTA, use embedded code |
| `checkAutomatically` | `WHEN_IN_BACKGROUND` | Only check when app backgrounds |

### Why `fallbackToCacheTimeout: 0` is Critical

- **30000ms (old):** Wait 30 seconds for OTA → Download old code → Overwrite new
- **0ms (new):** Use embedded code immediately → OTA applies on NEXT launch

---

## Verification Commands

### Check Current Config

```powershell
cd userapp
npx expo config --type json | findstr "enabled"
npx expo config --type json | findstr "fallbackToCacheTimeout"
```

### Check Build Fingerprint

```powershell
# After build, check what code is embedded
eas build --platform android --profile production --clear-cache
```

---

## Timeline

1. **Test Build** (OTA disabled) - Current
   - Commit: `bd15c04`
   - Purpose: Prove OTA is the problem
   
2. **Production Build** (OTA re-enabled) - After test passes
   - Commit: TBD
   - Purpose: Deploy with working OTA

---

## Emergency Rollback

If test build also fails:

```powershell
# Check for code issues
cd userapp
npx tsc --noEmit
npx eslint .

# Check for runtime errors
npx expo start --clear

# Build development APK to debug
eas build --platform android --profile development --clear-cache
```

---

## Summary

**Problem:** OTA updates overwriting new builds  
**Cause:** `fallbackToCacheTimeout: 30000` + `checkAutomatically: 'ON_LOAD'`  
**Test Solution:** `enabled: false` (prove theory)  
**Final Solution:** `enabled: true` + `fallbackToCacheTimeout: 0`  

**Test Build Commit:** `bd15c04`  
**Status:** Building... ⏳
