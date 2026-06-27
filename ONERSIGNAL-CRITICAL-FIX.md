# ✅ CRITICAL ONESIGNAL FIX - Token Generation

## The REAL Problem

Your logs showed:
```
[OneSignal] Initial subscription status: {"onesignalId": "❌ null", "optedIn": false, "pushToken": "❌ null", "subscribed": false}
[OneSignal] Poll # 1-5 - Status: {"hasOneSignalId": false, "hasPushToken": false, "optedIn": false, "subscribed": false}
```

**Tokens were NEVER being generated!**

## Root Cause

The `initializeOneSignal()` function was calling `optIn()` during **app initialization** (before login). By the time you logged in (minutes later), the OneSignal subscription had expired or was never properly created because:

1. Firebase handshake happens when `optIn()` is called
2. If called before user session exists, Firebase doesn't properly register the device
3. The subscription becomes "dead" - no tokens are generated

## The Fix

### Changed `initializeOneSignal()` (app/_layout.tsx)
**Before:**
```typescript
OneSignal.User.pushSubscription.optIn(); // ❌ Called too early!
await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for tokens
```

**After:**
```typescript
// Just initialize SDK and request permission
OneSignal.initialize(ONESIGNAL_APP_ID);
await OneSignal.Notifications.requestPermission(true);
// DO NOT call optIn() - wait for user login!
```

### Changed `syncOneSignalTokens()` (sign-in.tsx)
**Before:**
```typescript
// Just checked if tokens exist
let { onesignalId, pushToken } = getOneSignalSubscription();
```

**After:**
```typescript
// FRESH opt-in to generate new tokens
OneSignal.User.pushSubscription.optIn(); // ✅ Called when user is logged in!
await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for Firebase
// NOW get tokens
let { onesignalId, pushToken } = getOneSignalSubscription();
```

## Files Changed

| File | Change |
|------|--------|
| `userapp/utils/onesignal.ts` | ✅ Added `LogLevel` import |
| `userapp/utils/onesignal.ts` | ✅ `initializeOneSignal()` - removed `optIn()` call |
| `userapp/utils/onesignal.ts` | ✅ `syncOneSignalTokens()` - added FRESH `optIn()` call |

## Expected Behavior Now

### On App Start:
```
[OneSignal] === Initializing OneSignal SDK ===
[OneSignal] ✅ Debug logging enabled
[OneSignal] ✅ SDK initialized - waiting for user login to generate tokens
[OneSignal] Requesting notification permission...
[OneSignal] Permission granted: true
[OneSignal] === SDK Ready - Will generate tokens on user login ===
```

### On Login:
```
[SignIn] Registering push token...
[OneSignal] === Starting Token Sync ===
[OneSignal] Opting in to push notifications (fresh)...
[OneSignal] ✅ Opted in - waiting for Firebase to generate tokens...
[OneSignal] ⏳ Waiting 3 seconds for token generation...
[OneSignal] After opt-in: {
  onesignalId: "✅ abc12345...",
  pushToken: "✅ fCM_Token_ABC...",
  subscribed: true,
  optedIn: true
}
[OneSignal] ✅ Tokens obtained successfully
[OneSignal] OneSignal Subscription ID: abc12345-6789-abcd-efgh-ijklmnopqrst
[OneSignal] Push Token (FCM/APNs): fCM_Token_ABC123456789...
[OneSignal] ✅ profiles table updated successfully
[OneSignal] ✅ onesignal_players table updated
[OneSignal] 🎉 Token sync complete!
```

## How to Test

### 1. Reload the app
```cmd
# Shake device and tap "Reload"
# OR fully restart:
cd C:\Users\Administrator\restaurant-app\userapp
npx expo start
```

### 2. Login
- Enter credentials
- Watch console logs

### 3. Verify tokens generated
You should see:
```
[OneSignal] After opt-in: {
  onesignalId: "✅ ...",
  pushToken: "✅ ..."
}
```

### 4. Verify in Supabase
```sql
SELECT * FROM onesignal_players ORDER BY created_at DESC LIMIT 5;
SELECT id, onesignal_player_id, expo_push_token, push_token 
FROM profiles 
WHERE onesignal_player_id IS NOT NULL 
ORDER BY updated_at DESC 
LIMIT 5;
```

## If Still Not Working

If you still see `onesignalId: null` after opt-in:

### Option 1: Clear App Data
1. Go to Android Settings → Apps → AYAR Food Delivery
2. Storage → Clear Data
3. Reopen app and login

### Option 2: Rebuild App
```cmd
cd C:\Users\Administrator\restaurant-app\userapp
npx expo prebuild --clean --platform android
npx expo run:android
```

### Option 3: Check Firebase Config
1. Verify `google-services.json` exists in `userapp/` folder
2. Verify SHA-256 in Firebase Console:
   ```
   FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C
   ```
3. Wait 5 minutes for Firebase to propagate

## Summary

| Issue | Solution |
|-------|----------|
| Tokens not generating | Call `optIn()` when user logs in, not on app start |
| Subscription expired | Fresh `optIn()` on every login |
| Firebase handshake fails | Now happens when user session exists |

**This fix ensures tokens are generated FRESH every time a user logs in!**
