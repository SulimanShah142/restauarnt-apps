# OneSignal v5 Fix - Subscription ID vs User ID

## Problem

The error **"All included players are not subscribed"** was occurring because we were saving the **wrong ID** to the database.

### OneSignal v5 Has Two IDs:

1. **User ID** (`OneSignal.User.getOnesignalId()`) - Identifies the user account
2. **Subscription ID** (`OneSignal.User.pushSubscription.id`) - Identifies the device/push token

**We need the Subscription ID** for `include_player_ids` in the Edge Function!

## What Was Fixed

### 1. Updated All Three Apps

**Files Changed:**
- `admins-app/hooks/useRegisterPushToken.ts`
- `admins-app/utils/onesignal.ts`
- `deliverapp/hooks/useRegisterPushToken.ts`
- `deliverapp/utils/onesignal.ts`
- `userapp/hooks/useRegisterPushToken.ts`
- `userapp/utils/onesignal.ts`

**Changes:**
```typescript
// BEFORE (WRONG)
const id = await OneSignal.User.getOnesignalId();

// AFTER (CORRECT)
const id = OneSignal.User.pushSubscription.id;
```

### 2. Reinstalled OneSignal SDK

All three apps now have the latest version:
- `react-native-onesignal@5.4.1`
- `onesignal-expo-plugin@2.4.0`

### 3. Updated Firebase Plugin

Added Firebase BoM and FCM dependencies to the `withFirebase` plugin in all three apps:
- `admins-app/plugins/withFirebase.js`
- `deliverapp/plugins/withFirebase.js`
- `userapp/plugins/withFirebase.js`

## Steps to Fix

### Step 1: Clear Old IDs from Database

Run this SQL in Supabase SQL Editor:
```bash
supabase/CLEAR_OLD_ONESIGNAL_IDS.sql
```

This clears all old (incorrect) OneSignal player IDs.

### Step 2: Rebuild the Apps

For each app (admins-app, deliverapp, userapp):

```bash
cd admins-app
npx expo prebuild --clean --platform android
npx expo run:android
```

### Step 3: Test Push Notifications

1. Open each app and log in
2. Check the logs - you should see:
   ```
   [AdminPushToken] ✅ Got OneSignal Subscription ID: <uuid>
   ```
3. Verify in Supabase that the new IDs are saved in:
   - `onesignal_players` table
   - `admins` table (for admin app)
   - `delivery_persons` table (for delivery app)
   - `profiles` table (for user app)

### Step 4: Test Edge Function

Run the test function:
```sql
SELECT test_onesignal_notification();
```

Check the logs at:
https://gjyipzhhgxgumgbnpikg.supabase.co/dashboard/logs/explorer

You should see:
```
✅ OneSignal API Response: { status: 200, result: { id: "<notification-id>" } }
```

## Verification Checklist

- [ ] Cleared old OneSignal IDs from database
- [ ] Rebuilt all three apps with `npx expo prebuild --clean`
- [ ] Apps log "Got OneSignal Subscription ID" (not User ID)
- [ ] Database has new Subscription IDs saved
- [ ] Test notification returns 200 OK without errors
- [ ] Push notifications are received on devices

## Key Differences Between IDs

| Property | User ID | Subscription ID |
|----------|---------|-----------------|
| Method | `getOnesignalId()` | `pushSubscription.id` |
| Purpose | Identifies user account | Identifies device/token |
| Changes when | Never (per user) | App reinstall, new device |
| Use for | User targeting | Push notifications |
| Our use | ❌ Don't use | ✅ Use this |

## Common Mistakes to Avoid

1. **Don't use `getOnesignalId()`** - This returns User ID, not Subscription ID
2. **Don't mix IDs** - User ID and Subscription ID are NOT interchangeable
3. **Don't skip the rebuild** - Old code will still use the wrong ID
4. **Don't forget to clear old data** - Old IDs will cause "not subscribed" errors

## Troubleshooting

### Still Getting "Not Subscribed" Error?

1. Check OneSignal Dashboard > Audience > All Users
2. Find your user and click on them
3. Look at the **Subscription ID** (not User ID)
4. Compare with what's in your Supabase database
5. They should match exactly!

### No Push Token in Logs?

1. Check `google-services.json` is in place
2. Verify SHA-256 fingerprint in Firebase Console
3. Ensure Firebase Messaging is linked to OneSignal
4. Use physical device (not emulator)
5. Check Android 13+ POST_NOTIFICATIONS permission

### Edge Function Still Failing?

1. Check logs at: https://gjyipzhhgxgumgbnpikg.supabase.co/dashboard/logs/explorer
2. Verify JWT verification is disabled on the Edge Function
3. Check OneSignal API keys are set as Edge Function secrets
4. Verify the player ID in the database is a valid UUID

## References

- OneSignal v5 Migration Guide: https://documentation.onesignal.com/docs/react-native-sdk-setup
- OneSignal Expo Plugin: https://github.com/OneSignal/onesignal-expo-plugin
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
