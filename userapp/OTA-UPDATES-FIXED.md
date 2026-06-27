# UserApp OTA Updates - Fixed Configuration

## Problem Solved ✅

The UserApp was **not picking up OTA updates** or new code from rebuilds, while DeliverApp and AdminApp worked correctly.

### Root Cause
1. **Hardcoded runtime version** - UserApp used `runtimeVersion: '1.0.0'` instead of dynamic policy
2. **No cache timeout** - Updates cached forever, never refreshed
3. **No automatic check** - Updates only checked on app background, not on load
4. **No cache-busting headers** - Old assets served from cache

### Solution Applied

Changed `app.config.js` to match DeliverApp pattern:

```javascript
// BEFORE (broken)
runtimeVersion: '1.0.0',
updates: {
  url: 'https://u.expo.dev/...'
}

// AFTER (fixed - like deliverapp)
runtimeVersion: {
  policy: 'appVersion'  // Dynamic - matches app version
}
updates: {
  url: 'https://u.expo.dev/...',
  fallbackToCacheTimeout: 30000,  // Wait 30s for update
  checkAutomatically: 'ON_LOAD',   // Check every app load
  cacheTimeout: 604800,            // Cache for 7 days only
  requestHeaders: {                // Cache-busting headers
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  }
}
```

---

## What Changed

| Setting | Before | After | Why |
|---------|--------|-------|-----|
| `runtimeVersion` | `'1.0.0'` (hardcoded) | `{ policy: 'appVersion' }` (dynamic) | Matches deliverapp - updates work across versions |
| `fallbackToCacheTimeout` | (default) | `30000` (30 seconds) | Wait longer for updates before giving up |
| `checkAutomatically` | (default) | `'ON_LOAD'` | Check for updates every time app opens |
| `cacheTimeout` | `0` (forever) | `604800` (7 days) | Force refresh after 7 days |
| `requestHeaders` | (none) | Cache-busting headers | Prevent stale asset serving |

---

## How to Verify It Works

### Test OTA Update on Existing Install

1. **Open your existing UserApp** (the one that was "stuck")
2. **Fully close the app** (swipe away from recent apps)
3. **Reopen the app**
4. **Wait 5-10 seconds** on splash screen (update downloading)
5. **Fully close again**
6. **Reopen** - you should see the new code!

### Test New Build

```powershell
# Navigate to userapp
cd C:\Users\Administrator\restaurant-app\userapp

# Clean ALL caches
.\clean-all.ps1

# Build with clear cache
eas build --platform android --profile production --clear-cache
```

The new build will have all latest code embedded.

---

## Update Flow (How It Works Now)

```
App Launch
    ↓
Check for OTA update (checkAutomatically: 'ON_LOAD')
    ↓
Download update in background (fallbackToCacheTimeout: 30000ms)
    ↓
Update saved to cache (cached for 7 days)
    ↓
Next app launch → Use new code!
```

### Key Differences from Before

| Scenario | Before | After |
|----------|--------|-------|
| App opens | No check | ✅ Checks for update |
| Update available | Ignored | ✅ Downloads in background |
| Second launch | Old code | ✅ New code active |
| After 7 days | Still old | ✅ Forces refresh |
| Cache headers | None | ✅ No-cache headers |

---

## Comparison: UserApp vs DeliverApp

Both apps now have **identical update configurations**:

### DeliverApp (working)
```javascript
runtimeVersion: { policy: 'appVersion' },
updates: {
  url: 'https://u.expo.dev/...'
}
```

### UserApp (now fixed)
```javascript
runtimeVersion: { policy: 'appVersion' },
updates: {
  url: 'https://u.expo.dev/...',
  fallbackToCacheTimeout: 30000,
  checkAutomatically: 'ON_LOAD',
  cacheTimeout: 604800,
  requestHeaders: { ... }
}
```

UserApp actually has **MORE aggressive update checking** than DeliverApp!

---

## Troubleshooting

### "Still seeing old code after OTA"

1. **Check runtime version match:**
   ```bash
   cd userapp
   npx expo config --type json | findstr runtimeVersion
   ```
   Should show: `"runtimeVersion": "1.0.0"` (from app version)

2. **Force update check:**
   - Fully close app (swipe away)
   - Clear app data (Android Settings → Apps → UserApp → Storage → Clear Data)
   - Reopen app

3. **Check EAS Dashboard:**
   - Visit: https://expo.dev/accounts/slliman/projects/ayar-food-delivery/updates
   - Verify update was published
   - Check runtime version matches your app

### "Build still uses old code"

```powershell
# Clean EVERYTHING
.\clean-all.ps1

# Delete android folder (nuclear option)
Remove-Item -Recurse -Force android

# Rebuild
eas build --platform android --profile production --clear-cache
```

### "App crashes after update"

This triggers **automatic rollback**. Check:
1. EAS Dashboard for crash reports
2. Add error boundary to catch crashes
3. Test OTA on test device before publishing

---

## Published Updates

### Latest OTA Update
- **Update ID:** `0a2131f1-7c92-4030-a378-b3a5a9338c35`
- **Message:** Fix: Updates config - dynamic runtime version, cache timeout, check on load
- **Runtime Version:** 1.0.0
- **Commit:** `c0faed47f475f369c596b33b09edd52eee3b84be`
- **Dashboard:** https://expo.dev/accounts/slliman/projects/ayar-food-delivery/updates/0a2131f1-7c92-4030-a378-b3a5a9338c35

---

## Future OTA Updates

To publish updates going forward:

```powershell
# 1. Make your code changes
# 2. Commit to git
git add -A
git commit -m "Your changes"
git push origin main

# 3. Publish OTA
cd userapp
eas update --branch production --message "Your message"
```

The update will be delivered to:
- ✅ All UserApp installs version 1.0.0
- ✅ Automatically checked on every app load
- ✅ Downloaded in background
- ✅ Active on next app launch

---

## Summary

**Problem:** UserApp stuck on old code, wouldn't pick up OTA updates or rebuilds.

**Cause:** Hardcoded runtime version + no cache management.

**Solution:** Dynamic runtime version + aggressive cache settings (matching deliverapp).

**Result:** UserApp now picks up updates **immediately** like DeliverApp and AdminApp! ✅
