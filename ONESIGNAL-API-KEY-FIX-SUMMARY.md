# OneSignal API Key Fix - Summary

## Problem
Database triggers were using old/deleted OneSignal REST API keys, causing notifications to not be delivered to devices.

## Solution
Updated all SQL files with the correct OneSignal API keys from the current `.env` files.

## Correct API Keys (from .env files)

### Admin App (`admins-app/.env`)
- **App ID**: `2665a069-40cb-4335-8af1-0f4d8b77aeea`
- **REST API Key**: `os_v2_app_ezs2a2kaznbtlcxrb5gyw55o5jtu6i7tyejeedvcjikxwdbi4fqxyqlzlrujvv7n2mwmqnf7p3aiwreg7ifg4xts46sjjzfo7dawwvy`

### User App (`userapp/.env`)
- **App ID**: `38e20d47-839b-4944-8455-daf65977aaf9`
- **REST API Key**: `os_v2_app_hdra2r4dtneujbcv3l3fs55k7eourhifo63ufb4en4lfmptextciwwwbedrevmiayzmmufgamouelfuwcuspsav246una3n4wryzl5a`

### Delivery App (`deliverapp/.env`)
- **App ID**: `da1609d1-cebc-47a1-9b0c-4d797997344c`
- **REST API Key**: `os_v2_app_3ilatuooxrd2dgymjv4xtfzujqkvgixu4wtulp5tsh6lkidwsushdefp4pkeqvvlzzzvwtpp5quyeis4lsazspv3kmrnh2uogrtgrua`

## Files Updated

### Main Trigger/Function Files (CRITICAL - Run these in Supabase):
1. ✅ `supabase/UPDATE_API_KEYS_ONLY.sql` - Already had correct keys
2. ✅ `supabase/migrations/008_direct_onesignal_notifications.sql` - Already had correct keys
3. ✅ `supabase/migrations/008_onesignal_CLEAN_INSTALL.sql` - Already had correct keys
4. ✅ `supabase/migrations/008_onesignal_COMPLETE_RESET.sql` - Already had correct keys
5. ✅ `supabase/migrations/SETUP_ONESIGNAL_IOS_TRIGGERS.sql` - Already had correct keys
6. ✅ `supabase/migrations/FIX_ALL_ONESIGNAL_NOTIFICATIONS.sql` - Already had correct keys
7. ✅ `supabase/migrations/INSTALL_ONESIGNAL_NOTIFICATIONS.sql` - **FIXED** (user & delivery keys)
8. ✅ `supabase/migrations/FIX_NOTIFICATIONS_FINAL.sql` - **FIXED** (all 3 app keys)
9. ✅ `supabase/migrations/FIX_ONESIGNAL_TARGET_SPECIFIC_PLAYERS.sql` - **FIXED** (all 3 app keys)
10. ✅ `supabase/migrations/FIX_USER_API_KEY.sql` - **FIXED** (all 3 app keys)
11. ✅ `supabase/migrations/FIX_API_KEYS_FINAL.sql` - **FIXED** (delivery key)

### Order Lifecycle & Trigger Recreation Files:
12. ✅ `supabase/migrations/COMPLETE_TRIGGERS_FIX_ALL.sql` - No hardcoded keys (uses `send_onesignal_direct`)
13. ✅ `supabase/migrations/RECREATE_ALL_TRIGGERS_FROM_SCRATCH.sql` - No hardcoded keys (uses `send_onesignal_direct`)
14. ✅ `supabase/migrations/TEST_ORDER_LIFECYCLE_WITH_NOTIFICATIONS.sql` - No hardcoded keys (uses triggers)
15. ✅ `supabase/migrations/TEST_REAL_ORDER_LIFECYCLE.sql` - No hardcoded keys (uses triggers)
16. ✅ `supabase/migrations/CREATE_DELIVERY_ASSIGNMENT_TRIGGERS.sql` - No hardcoded keys (uses `send_onesignal_direct`)
17. ✅ `supabase/migrations/ADD_MISSING_DELIVERY_TRIGGERS.sql` - No hardcoded keys (uses `send_onesignal_direct`)
18. ✅ `supabase/migrations/ADD_ADMIN_NOTIFICATION_ON_ORDER_INSERT.sql` - No hardcoded keys (uses `send_onesignal_direct`)

### Test/Diagnostic Files:
19. ✅ `supabase/TEST-NOTIFICATIONS-FULL.sql` - **FIXED** (admin key)
20. ✅ `supabase/migrations/DEBUG_ONESIGNAL_HTTP.sql` - **FIXED** (admin key)
21. ✅ `supabase/migrations/DIRECT_ONESIGNAL_TEST.sql` - **FIXED** (all 3 app keys)
22. ✅ `supabase/migrations/TEST_ONESIGNAL_ALL_USERS.sql` - **FIXED** (admin key)
23. ✅ `supabase/migrations/VERIFY_ONESIGNAL_APPS.sql` - **FIXED** (all 3 app keys)
24. ✅ `supabase/migrations/FIND_CORRECT_API_KEYS.sql` - **FIXED** (user key)
25. ✅ `supabase/migrations/CHECK_API_KEYS_IN_FUNCTION.sql` - **FIXED** (reference keys)
26. ✅ `supabase/migrations/CHECK_FUNCTION_API_KEYS.sql` - **FIXED** (reference keys)
27. ✅ `supabase/migrations/CHECK_CURRENT_TRIGGER_STATE.sql` - **FIXED** (user key check)
28. ✅ `supabase/migrations/DEBUG_ADMIN_NOTIFICATION.sql` - **FIXED** (admin key check)

### Diagnostic File (No changes needed):
- `supabase/CHECK_ALL_CURRENT_TRIGGERS.sql` - Already designed to detect old vs new keys

## How to Apply

1. Go to **Supabase Dashboard → SQL Editor**
2. Copy the contents of `supabase/UPDATE_API_KEYS_ONLY.sql` 
3. Run it in the SQL Editor
4. Verify with the query:
   ```sql
   SELECT proname, 
     CASE 
       WHEN prosrc LIKE '%os_v2_app_ezs2a2kaznbtlcxrb5gyw55o5jtu6i7tyejeedvcjikxwdbi4fqxyqlzlrujvv7n2mwmqnf7p3aiwreg7ifg4xts46sjjzfo7dawwvy%' THEN '✅ Admin OK'
       WHEN prosrc LIKE '%os_v2_app_hdra2r4dtneujbcv3l3fs55k7eourhifo63ufb4en4lfmptextciwwwbedrevmiayzmmufgamouelfuwcuspsav246una3n4wryzl5a%' THEN '✅ User OK'
       WHEN prosrc LIKE '%os_v2_app_3ilatuooxrd2dgymjv4xtfzujqkvgixu4wtulp5tsh6lkidwsushdefp4pkeqvvlzzzvwtpp5quyeis4lsazspv3kmrnh2uogrtgrua%' THEN '✅ Delivery OK'
       ELSE '❌ UNKNOWN KEY'
     END as status
   FROM pg_proc
   WHERE proname = 'send_onesignal_direct';
   ```

## Old Keys (REMOVED - Do NOT use these):
- User: `os_v2_app_hdra2r4dtneujbcv3l3fs55k7e5lnsjkppvez2emgs2qzjxsweinqsify35xxyko2kj4tnidnaspsczyqhgra2l45i7ulzsoav3brfi` ❌
- Delivery: `os_v2_app_3ilatuooxrd2dgymjv4xtfzujthjubiduk3ugj5uzxgoqzdjkxkmxtltju4qh4vaheumll6zawov5ci4gcryyp2uulwc6w7p22n4jui` ❌
- Admin: `os_v2_app_ezs2a2kaznbtlcxrb5gyw55o5k2c444j3prusqvmicyzpfoo73w7rjdshqoopk7vcpti367zewckejet7czuwq5r5kdteldtnbetfui` ❌

## Date
2026-04-04
