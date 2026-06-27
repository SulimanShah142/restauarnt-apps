# OneSignal Push Notification Fix - Complete

## Problem Summary

Notifications sent from the OneSignal dashboard work, but notifications triggered via the `send-onesignal-notification` edge function fail silently (returns 200 but no notification is sent).

### Root Cause

The edge function couldn't find push tokens in the database because:

1. **RLS Policy Issues**: The Row Level Security policies were blocking inserts/updates from the admin and delivery apps (which use custom authentication, not Supabase auth)
2. **Missing Helper Functions**: No validated helper functions for delivery app to save tokens
3. **Insufficient Logging**: No debugging logs to identify where token registration was failing
4. **Missing Unique Constraint**: The `(user_id, app_type)` unique constraint may not exist in all environments

---

## Files Changed

### 1. Database Migration (NEW)
**File**: `supabase/migrations/FIX_ONESIGNAL_TOKEN_REGISTRATION.sql`

This migration:
- ✅ Fixes RLS policies to allow all three apps to save tokens
- ✅ Creates helper functions for each app type:
  - `register_user_push_token()` - for userapp
  - `register_admin_push_token()` - for admins-app
  - `register_delivery_push_token()` - for deliverapp
- ✅ Adds logging trigger for debugging
- ✅ Ensures unique constraint on `(user_id, app_type)`
- ✅ Creates diagnostic function `check_onesignal_tokens()`

### 2. User App
**File**: `userapp/utils/onesignal.ts`

Changes:
- ✅ Added detailed console logging at every step
- ✅ Shows OneSignal Subscription ID in logs
- ✅ Shows Push Token (FCM/APNs) in logs
- ✅ Uses helper function `register_user_push_token()` with fallback
- ✅ Verifies data was saved correctly
- ✅ Better error messages with troubleshooting checklist

### 3. Admin App
**File**: `admins-app/utils/onesignal.ts`

Changes:
- ✅ Added detailed console logging at every step
- ✅ Shows OneSignal Subscription ID in logs
- ✅ Uses helper function `register_admin_push_token()` with fallback
- ✅ Fetches user_id from session or database
- ✅ Verifies data was saved correctly
- ✅ Better error messages with troubleshooting checklist

### 4. Delivery App
**File**: `deliverapp/utils/onesignal.ts`

Changes:
- ✅ Added detailed console logging at every step
- ✅ Shows OneSignal Subscription ID in logs
- ✅ Uses helper function `register_delivery_push_token()` with fallback
- ✅ Fetches user_id from delivery_persons table
- ✅ Verifies data was saved correctly
- ✅ Better error messages with troubleshooting checklist

### 5. Edge Function
**File**: `supabase/functions/send-onesignal-notification/index.ts`

Changes:
- ✅ Added extensive debugging logs
- ✅ Logs configuration status (API keys, Supabase URL)
- ✅ Logs each notification attempt with player ID lookup
- ✅ Logs OneSignal API request and response
- ✅ Shows clear error messages when player ID is not found
- ✅ Logs status changes for order updates

---

## How to Apply the Fix

### Step 1: Run the Database Migration

1. Open Supabase Dashboard → SQL Editor
2. Copy the contents of `supabase/migrations/FIX_ONESIGNAL_TOKEN_REGISTRATION.sql`
3. Run the SQL script
4. Verify success (you should see a summary table)

### Step 2: Clear Old Tokens (Optional but Recommended)

Since old tokens may have been saved incorrectly, clear them:

1. Open Supabase Dashboard → SQL Editor
2. Copy the contents of `supabase/CLEAR_OLD_ONESIGNAL_IDS.sql`
3. Run the SQL script

### Step 3: Rebuild the Apps

```bash
# User App
cd userapp
npx expo prebuild --clean --platform android
npx expo run:android

# Admin App
cd admins-app
npx expo prebuild --clean --platform android
npx expo run:android

# Delivery App
cd deliverapp
npx expo prebuild --clean --platform android
npx expo run:android
```

### Step 4: Test Token Registration

1. Open each app (user, admin, delivery)
2. Log in to each app
3. Watch the console logs - you should see:
   ```
   [OneSignal] === Starting Token Sync ===
   [OneSignal] Initial subscription status: { onesignalId: '✅ abc12345...', ... }
   [OneSignal] OneSignal Subscription ID: <full-uuid>
   [OneSignal] Push Token (FCM/APNs): <full-token>
   [OneSignal] ✅ profiles/admins/delivery_persons table updated
   [OneSignal] ✅ onesignal_players table updated via helper function
   [OneSignal] ✅ Verification successful - data saved correctly
   ```

### Step 5: Verify in Database

Run this query in Supabase SQL Editor:

```sql
-- Check all registered tokens
SELECT 
  op.user_id,
  op.app_type,
  op.onesignal_player_id,
  op.created_at,
  op.updated_at,
  p.email as user_email,
  a.email as admin_email
FROM onesignal_players op
LEFT JOIN profiles p ON p.id = op.user_id
LEFT JOIN admins a ON a.user_id = op.user_id
ORDER BY op.updated_at DESC;

-- Check registration logs
SELECT * FROM onesignal_registration_log 
ORDER BY created_at DESC 
LIMIT 20;

-- Diagnostic function for specific user
SELECT * FROM check_onesignal_tokens('YOUR-USER-ID-HERE');
```

### Step 6: Test Edge Function

1. Create a new order in the user app
2. Check Supabase Edge Function logs:
   - Go to Supabase Dashboard → Edge Functions → Logs
   - Look for `send-onesignal-notification` logs
3. You should see detailed logs like:
   ```
   [OneSignal] 📬 Edge Function Invoked
   [OneSignal] 📦 Processing orders table event
   [OneSignal] 🔍 Looking up player ID for user: <uuid> appType: admin
   [OneSignal] ✅ Found player ID for admin: <uuid>
   [OneSignal] 📤 Attempting to send to admin: <uuid>
   [OneSignal] 📡 OneSignal API Response Status: 200
   [OneSignal] ✅ Successfully sent to admin
   ```

---

## Debugging Guide

### If Tokens Are Not Being Saved

1. **Check Console Logs**: Look for error messages in the app console
2. **Check RLS Policies**: Run this in Supabase:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'onesignal_players';
   ```
3. **Check Helper Functions**: Verify they exist:
   ```sql
   SELECT proname FROM pg_proc WHERE proname LIKE 'register_%push_token';
   ```
4. **Test Helper Function Manually**:
   ```sql
   -- For user app
   SELECT register_user_push_token('test-token-123');
   
   -- For admin app
   SELECT register_admin_push_token('admin-user-id', 'test-token-123', 'admin@email.com');
   
   -- For delivery app
   SELECT register_delivery_push_token('delivery-user-id', 'test-token-123', 'delivery-person-id');
   ```

### If Edge Function Can't Find Player IDs

1. **Verify Data Exists**:
   ```sql
   SELECT * FROM onesignal_players WHERE user_id = 'YOUR-USER-ID';
   ```

2. **Check Edge Function Logs**: Look for messages like:
   - `⚠️ No player ID found for user` - Token not saved
   - `❌ Error fetching player ID` - Database error

3. **Check OneSignal API Response**: The edge function now logs the full API response

### If Notifications Still Don't Work

1. **Check OneSignal Dashboard**: Verify the player ID exists in OneSignal
2. **Check Firebase Config**: Ensure `google-services.json` is correct
3. **Check SHA-256 Fingerprint**: Must match in Firebase console
4. **Test from OneSignal Dashboard**: Send a test notification manually

---

## Expected Console Output

### Successful Token Registration (User App)
```
[OneSignal] === Starting Token Sync ===
[OneSignal] Timestamp: 2026-04-01T12:00:00.000Z
[OneSignal] Initial subscription status: {
  onesignalId: "✅ abc12345...",
  pushToken: "✅ fCM_Token_ABC123...",
  subscribed: true,
  optedIn: true
}
[OneSignal] ✅ Tokens obtained successfully
[OneSignal] OneSignal Subscription ID: abc12345-6789-abcd-efgh-ijklmnopqrst
[OneSignal] Push Token (FCM/APNs): fCM_Token_ABC123456789...
[OneSignal] Authenticated User ID: user-uuid-here
[OneSignal] Updating profiles table...
[OneSignal] ✅ profiles table updated successfully
[OneSignal] Updating onesignal_players table...
[OneSignal] ✅ onesignal_players table updated via helper function
[OneSignal] Verifying saved data...
[OneSignal] ✅ Verification successful - data saved correctly
[OneSignal] 🎉 Token sync complete!
```

### Successful Edge Function Execution
```
[OneSignal] ==========================================
[OneSignal] 📬 Edge Function Invoked
[OneSignal] Timestamp: 2026-04-01T12:00:00.000Z
[OneSignal] 📦 Processing orders table event
[OneSignal] 🆕 NEW ORDER event
[OneSignal] 🔔 Attempting to notify admin...
[OneSignal] 🔍 Looking up admin user ID for email: admin@example.com
[OneSignal] ✅ Found admin user ID: admin-uuid-here
[OneSignal] 🔍 Looking up player ID for user: admin-uuid-here appType: admin
[OneSignal] ✅ Found player ID for admin: player-id-here
[OneSignal] 📤 Attempting to send to admin: player-id-here
[OneSignal] 📡 OneSignal API Response Status: 200
[OneSignal] ✅ Successfully sent to admin: player-id-here
[OneSignal] ==========================================
```

---

## Summary

This fix addresses all identified issues:

1. ✅ **Token Generation**: OneSignal SDK generates subscription ID (logged in console)
2. ✅ **Token Saving**: Helper functions save to both app-specific table AND `onesignal_players`
3. ✅ **RLS Policies**: Fixed to allow all three apps to save tokens
4. ✅ **Debugging**: Extensive console logs in apps and edge function
5. ✅ **Verification**: Data verification after saving
6. ✅ **Fallback**: Direct upsert if helper function fails

After applying these fixes, your push notifications should work correctly from the edge function.
