# Push Notification & Profile Creation Fix

This document describes the fixes implemented for automatic profile creation and push token registration in the restaurant app.

## Issues Fixed

### 1. User App - Profile Not Created on Sign-Up/Sign-In
**Problem:** When users signed up or signed in via Supabase Auth, their profile was not being created in the `profiles` table.

**Solution:**
- Created database trigger `on_auth_user_profile_created` on `auth.users` table
- Created function `handle_new_user_profile()` to auto-create profiles
- Added fallback function `ensure_profile_exists()` to be called from client side
- Updated sign-in and sign-up pages to call `ensure_profile_exists()` as a safety net

### 2. Admin App - Push Token Not Being Fetched
**Problem:** Admin app could save push tokens but couldn't fetch them properly, showing "user or admin doesn't have a push token" error.

**Solution:**
- Updated `useGetAdminPushToken` hook to check multiple sources:
  1. `admins.expo_push_token`
  2. `admins.onesignal_player_id`
  3. `onesignal_players` table (using `user_id`)
  4. `profiles` table (as fallback)
- Fixed RLS policies on `onesignal_players` table to allow admin app access
- Updated admin login to properly save tokens to both `admins` and `onesignal_players` tables

### 3. Admin App - Profile Not Created on Login
**Problem:** Admin profiles were not being created automatically during admin login.

**Solution:**
- Updated `createAdminRecord()` function to create user → profile → admin chain
- Ensured proper foreign key relationships: `admins.user_id` → `profiles.id` → `users.id`

## Files Modified

### SQL Migrations

1. **`supabase/migrations/010_auto_create_profile_on_signup.sql`**
   - Creates trigger on `auth.users` for auto-creating profiles
   - Creates `ensure_profile_exists()` function for client-side calls
   - Migrates existing users without profiles

2. **`supabase/migrations/011_fix_onesignal_rls_for_admin.sql`**
   - Fixes RLS policies on `onesignal_players` table
   - Creates `register_admin_push_token()` helper function
   - Grants proper permissions to anon and authenticated users
   - Cleans up duplicate records before adding unique constraint

3. **`supabase/migrations/012_sync_profiles_with_onesignal.sql`** (NEW)
   - Creates trigger to sync OneSignal tokens from `onesignal_players` to `profiles`
   - Creates `register_user_push_token()` helper function
   - Ensures profiles.expo_push_token and profiles.onesignal_player_id are populated

### User App Files

3. **`userapp/app/(auth)/sign-in.tsx`**
   - Added call to `ensure_profile_exists()` after successful login
   - Added push token registration after login

4. **`userapp/app/(auth)/sign-up.tsx`**
   - Added call to `ensure_profile_exists()` after successful signup
   - Ensures profile exists before push token registration

### Admin App Files

5. **`admins-app/app/admin/login.tsx`**
   - Updated `createAdminRecord()` to create full user→profile→admin chain
   - Improved `registerAdminPushToken()` with retry logic for OneSignal
   - Fixed `savePushToken()` to use proper conflict resolution

6. **`admins-app/hooks/useGetAdminPushToken.ts`**
   - Multi-source token fetching (admins, onesignal_players, profiles tables)
   - Added detailed logging for debugging
   - Returns both `pushToken` and `onesignalPlayerId`

## Setup Instructions

### Step 1: Run SQL Migrations

Run these migrations in your Supabase SQL Editor **in order**:

```sql
-- First, run the auto-create profile migration
-- (Copy contents of supabase/migrations/010_auto_create_profile_on_signup.sql)

-- Second, run the RLS fix migration
-- (Copy contents of supabase/migrations/011_fix_onesignal_rls_for_admin.sql)

-- Third, run the sync profiles migration (IMPORTANT for push tokens)
-- (Copy contents of supabase/migrations/012_sync_profiles_with_onesignal.sql)
```

**Important:** Run migration 012 last because it creates a trigger that depends on the tables and constraints from the previous migrations.

### Step 2: Verify Database Triggers

Check that the triggers are created:

```sql
-- Check if trigger exists for auth.users
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgname = 'on_auth_user_profile_created';

-- Check if function exists
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'handle_new_user_profile';

-- Check if ensure_profile_exists function exists
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'ensure_profile_exists';

-- Check if sync trigger exists (NEW)
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgname = 'sync_onesignal_to_profiles';

-- Check if sync function exists (NEW)
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'sync_onesignal_to_profiles';
```

### Step 3: Test User Sign-Up

1. Open user app
2. Sign up with a new email
3. Check logs for:
   - `[SignUp] ✅ Profile ensured to exist`
   - `[UserPushToken] ✅ Profiles table updated successfully`
   - `[UserPushToken] ✅ OneSignal player ID saved successfully`
4. Verify in Supabase:
   ```sql
   -- Check profile was created
   SELECT * FROM profiles WHERE email = 'test@example.com';
   
   -- Check expo_push_token and onesignal_player_id are populated
   SELECT id, email, expo_push_token, onesignal_player_id 
   FROM profiles 
   WHERE email = 'test@example.com';
   
   -- Check OneSignal player ID was saved to onesignal_players
   SELECT * FROM onesignal_players 
   WHERE user_id = (SELECT id FROM profiles WHERE email = 'test@example.com');
   ```

### Step 4: Test Admin Login

1. Open admin app
2. Login with admin credentials
3. Check logs for:
   - `[AdminLogin] ✅ Admin record created successfully`
   - `[AdminLogin] ✅ Profiles table updated with push token`
   - `[AdminLogin] ✅ OneSignal player ID saved successfully for admin`
4. Verify in Supabase:
   ```sql
   -- Check admin record
   SELECT * FROM admins WHERE email = 'Mohammadseyar885@gmail.com';
   
   -- Check profile has push token
   SELECT id, email, expo_push_token, onesignal_player_id 
   FROM profiles 
   WHERE email = 'Mohammadseyar885@gmail.com';
   
   -- Check OneSignal player ID
   SELECT * FROM onesignal_players WHERE app_type = 'admin';
   ```

### Step 5: Test Push Token Fetching

1. In admin app, check if push token is fetched:
   - Look for log: `[AdminPushToken] ✅ Push token retrieved:`
2. Verify token exists in database:
   ```sql
   SELECT 
     a.email,
     a.expo_push_token,
     a.onesignal_player_id,
     op.onesignal_player_id as player_table_token
   FROM admins a
   LEFT JOIN onesignal_players op ON op.user_id = a.user_id AND op.app_type = 'admin'
   WHERE a.email = 'Mohammadseyar885@gmail.com';
   ```

## Database Schema Relationships

```
auth.users (Supabase Auth)
    ↓ (id)
    ↓
users (Public table)
    ↓ (id)
    ↓
profiles (Public table) ← admins.user_id references this
    ↓ (id)               ↓
    ↓                    ↓
    └────────────────────┘
```

## OneSignal Integration

### Token Storage Strategy

Tokens are stored in **two places** for redundancy:

1. **App-specific tables:**
   - `profiles.expo_push_token` / `profiles.onesignal_player_id` (user app)
   - `admins.expo_push_token` / `admins.onesignal_player_id` (admin app)
   - `delivery_persons.expo_push_token` / `delivery_persons.onesignal_player_id` (delivery app)

2. **Centralized table:**
   - `onesignal_players` table with `user_id`, `onesignal_player_id`, `app_type`

### Fetch Priority

When fetching push tokens, the system checks in this order:

1. App-specific table (`admins`, `profiles`, `delivery_persons`)
2. `onesignal_players` table
3. Fallback to other tables if needed

## Troubleshooting

### Profile Not Created

1. Check if trigger exists:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_profile_created';
   ```

2. Manually create profile:
   ```sql
   SELECT ensure_profile_exists(
     p_user_id := 'user-uuid-here',
     p_email := 'user@example.com'
   );
   ```

### Push Token Not Saved

1. Check RLS policies:
   ```sql
   SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
   FROM pg_policies
   WHERE tablename = 'onesignal_players';
   ```

2. Test manual insert:
   ```sql
   INSERT INTO onesignal_players (user_id, onesignal_player_id, app_type)
   VALUES ('user-uuid', 'test-token', 'admin');
   ```

### Push Token Not Fetched

1. Check all token sources:
   ```sql
   -- For admin
   SELECT 'admins' as source, email, expo_push_token, onesignal_player_id
   FROM admins WHERE email = 'admin@example.com'
   UNION ALL
   SELECT 'onesignal_players' as source, '' as email, onesignal_player_id, onesignal_player_id
   FROM onesignal_players 
   WHERE user_id = (SELECT user_id FROM admins WHERE email = 'admin@example.com')
     AND app_type = 'admin';
   ```

## API Keys Configuration

Make sure your edge functions have the correct OneSignal App IDs:

```typescript
// In supabase/functions/push-notifications/index.ts
const ONESIGNAL_CONFIG = {
  user: {
    appId: 'YOUR-USER-APP-ONESIGNAL-ID',
    restApiKey: 'YOUR-USER-APP-REST-API-KEY'
  },
  admin: {
    appId: 'YOUR-ADMIN-APP-ONESIGNAL-ID',
    restApiKey: 'YOUR-ADMIN-APP-REST-API-KEY'
  },
  delivery: {
    appId: 'YOUR-DELIVERY-APP-ONESIGNAL-ID',
    restApiKey: 'YOUR-DELIVERY-APP-REST-API-KEY'
  }
};
```

## Testing Checklist

- [ ] User sign-up creates profile automatically
- [ ] User sign-in creates profile if missing
- [ ] User push token is saved to `onesignal_players`
- [ ] Admin login creates profile if missing
- [ ] Admin push token is saved to `admins` and `onesignal_players`
- [ ] Admin push token can be fetched from database
- [ ] Edge functions can fetch tokens for notifications
- [ ] RLS policies allow proper access

## Additional Notes

- OneSignal v5 is being used
- Admin app uses custom authentication (not Supabase Auth)
- User app uses Supabase Auth
- Delivery app uses Supabase Auth with custom flow
