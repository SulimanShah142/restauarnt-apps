# ✅ OneSignal Push Notification Fix - COMPLETE

## What Was Wrong

### The Core Issue
We were saving the **WRONG ID** to the database:
- ❌ **User ID** from `OneSignal.User.getOnesignalId()` 
- ✅ **Subscription ID** from `OneSignal.User.pushSubscription.id` (needed)

### Why It Failed
OneSignal v5 has **two different IDs**:
1. **User ID** - Identifies the user account (stays the same)
2. **Subscription ID** - Identifies the device/push token (changes on reinstall)

When sending push notifications, OneSignal needs the **Subscription ID** in `include_player_ids`.

## What Was Fixed

### 1. App Code (All 3 Apps)
**Files Updated:**
- `admins-app/hooks/useRegisterPushToken.ts`
- `admins-app/utils/onesignal.ts`
- `deliverapp/hooks/useRegisterPushToken.ts`
- `deliverapp/utils/onesignal.ts`
- `userapp/hooks/useRegisterPushToken.ts`
- `userapp/utils/onesignal.ts`

**Change:**
```typescript
// BEFORE (WRONG)
const id = await OneSignal.User.getOnesignalId();

// AFTER (CORRECT)
const id = OneSignal.User.pushSubscription.id;
```

### 2. OneSignal SDK
Reinstalled latest version in all apps:
- `react-native-onesignal@5.4.1`
- `onesignal-expo-plugin@2.4.0`

### 3. Firebase Dependencies
Updated `withFirebase` plugin to add Firebase BoM and FCM:
```gradle
implementation platform('com.google.firebase:firebase-bom:33.10.0')
implementation 'com.google.firebase:firebase-messaging'
```

### 4. Edge Function
Updated `supabase/functions/send-onesignal-notification/index.ts`:
- Added player ID validation
- Added better error logging
- Added helpful error messages for debugging

## 🚀 Steps to Complete the Fix

### Step 1: Clear Old IDs (IMPORTANT!)
Run this SQL in Supabase SQL Editor:

```sql
-- Run: supabase/CLEAR_OLD_ONESIGNAL_IDS.sql
UPDATE onesignal_players SET onesignal_player_id = NULL WHERE id IS NOT NULL;
UPDATE admins SET onesignal_player_id = NULL, expo_push_token = NULL WHERE id IS NOT NULL;
UPDATE delivery_persons SET onesignal_player_id = NULL, expo_push_token = NULL WHERE id IS NOT NULL;
UPDATE profiles SET onesignal_player_id = NULL, expo_push_token = NULL WHERE id IS NOT NULL;
```

### Step 2: Rebuild All Apps

**Admin App:**
```bash
cd admins-app
npx expo prebuild --clean --platform android
npx expo run:android
```

**Delivery App:**
```bash
cd deliverapp
npx expo prebuild --clean --platform android
npx expo run:android
```

**User App:**
```bash
cd userapp
npx expo prebuild --clean --platform android
npx expo run:android
```

### Step 3: Test Each App

1. Open each app and log in
2. Check logs for:
   ```
   [AdminPushToken] ✅ Got OneSignal Subscription ID: <uuid-here>
   ```
3. The ID should be a UUID format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### Step 4: Verify Database

Check Supabase that new IDs are saved:
```sql
SELECT user_id, app_type, onesignal_player_id, created_at 
FROM onesignal_players 
ORDER BY created_at DESC;
```

### Step 5: Test Push Notifications

**Option A: Test from Edge Function**
```sql
SELECT test_onesignal_notification();
```

**Option B: Test from Dashboard**
1. Go to OneSignal Dashboard > Messages > New Push
2. Target "Specific Devices"
3. Find your test user
4. Send test notification

**Option C: Trigger Real Notification**
1. Create a test order in the app
2. Check if admin receives notification
3. Change order status
4. Check if user receives notification

## ✅ Success Indicators

### In App Logs:
```
[OneSignal] ✅ Got push token after 3 seconds: <token>
[AdminPushToken] ✅ Got OneSignal Subscription ID: <uuid>
[AdminPushToken] ✅ Saved to onesignal_players table
```

### In Supabase Logs:
```
✅ OneSignal API Response: { status: 200, result: { id: "notification-id" } }
✅ Successfully sent notification to admin player: <uuid>
```

### In OneSignal Dashboard:
- Audience > All Users shows your device as "Subscribed"
- Messages shows successful delivery

## 🔍 Troubleshooting

### Still Getting "Not Subscribed" Error?

1. **Verify ID Format:**
   ```sql
   SELECT onesignal_player_id, LENGTH(onesignal_player_id) FROM onesignal_players;
   ```
   Should be UUID format (36 characters)

2. **Check OneSignal Dashboard:**
   - Go to Audience > All Users
   - Click on your test user
   - Verify the Subscription ID matches database

3. **Re-clear IDs:**
   - Run CLEAR_OLD_ONESIGNAL_IDS.sql again
   - Rebuild app
   - Let it re-register

### No Push Token in Logs?

1. Check `google-services.json` exists in app folder
2. Verify Firebase project matches OneSignal dashboard
3. Use physical device (not emulator)
4. Grant notification permission when prompted

### Edge Function Returns 401?

1. Go to Supabase Dashboard > Functions
2. Select `send-onesignal-notification`
3. Disable "Require JWT" / "Verify JWT"
4. Save and redeploy

## 📝 Summary of Changes

| Component | Change | Status |
|-----------|--------|--------|
| App Code | Use `pushSubscription.id` | ✅ Fixed |
| OneSignal SDK | Updated to v5.4.1 | ✅ Fixed |
| Firebase | Added FCM dependencies | ✅ Fixed |
| Edge Function | Better validation/logging | ✅ Fixed |
| Database | Clear old IDs script | ✅ Ready |

## 📞 Support

If issues persist:
1. Check logs at: https://gjyipzhhgxgumgbnpikg.supabase.co/dashboard/logs/explorer
2. Review OneSignal Dashboard: https://dashboard.onesignal.com
3. See detailed guide: `FIX-ONESIGNAL-V5-SUBSCRIPTION-ID.md`

---

**Last Updated:** March 31, 2026
**Fixed Version:** react-native-onesignal@5.4.1
