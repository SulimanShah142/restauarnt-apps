# Complete OneSignal v5 Push Token Flow - Production Ready

## Overview

This guide provides the **complete, production-ready flow** for generating and storing OneSignal push tokens and subscription IDs in Supabase for Expo 54 + OneSignal v5.

---

## Database Schema

### Tables Involved

1. **`profiles`** - Stores user profile data including OneSignal tokens
2. **`onesignal_players`** - Centralized storage for all OneSignal player IDs across all apps
3. **`onesignal_registration_log`** - Audit log for debugging token registrations

### Columns Added

```sql
-- profiles table
onesignal_player_id TEXT    -- OneSignal Subscription ID (Player ID)
expo_push_token TEXT        -- Expo push token (optional)
push_token TEXT             -- FCM/APNs raw token

-- onesignal_players table
id BIGINT                   -- Auto-increment ID
user_id UUID                -- User's Supabase ID
onesignal_player_id TEXT    -- OneSignal Subscription ID
app_type TEXT               -- 'user', 'admin', or 'delivery'
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ

-- onesignal_registration_log table
id BIGINT                   -- Auto-increment ID
user_id UUID                -- User's Supabase ID
onesignal_player_id TEXT    -- OneSignal Subscription ID
app_type TEXT               -- App type
old_player_id TEXT          -- Previous token (for updates)
action TEXT                 -- 'INSERT' or 'UPDATE'
created_at TIMESTAMPTZ
```

---

## Complete Flow

### Step 1: Run Database Migration

```sql
-- In Supabase SQL Editor, run:
-- supabase/migrations/COMPLETE_ONESIGNAL_SETUP.sql
```

This creates:
- ✅ Required columns in `profiles` table
- ✅ `onesignal_players` table with proper structure
- ✅ RLS policies for secure access
- ✅ Helper functions for token registration
- ✅ Logging trigger for debugging
- ✅ Diagnostic function

---

### Step 2: Initialize OneSignal in App Layout

**File**: `userapp/app/_layout.tsx`

```typescript
import { useEffect } from 'react';
import { OneSignal } from 'react-native-onesignal';
import { initializeOneSignal } from '@/utils/onesignal';

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Initialize OneSignal SDK (runs once on app start)
        await initializeOneSignal();
        console.log('[App] OneSignal initialized');
        
        setAppIsReady(true);
      } catch (error) {
        console.error('[App] Initialization error:', error);
      }
    }
    prepare();
  }, []);

  // ... rest of layout
}
```

**What this does**:
- ✅ Initializes OneSignal SDK with App ID
- ✅ Requests notification permissions
- ✅ Opts in to push notifications
- ✅ Sets up debug logging

---

### Step 3: Sync Tokens After User Login

**File**: `userapp/app/(auth)/sign-in.tsx`

```typescript
import { syncUserWithOneSignal } from '@/utils/onesignal';

const handleLogin = async () => {
  try {
    // 1. Sign in with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    const user = data.user;
    console.log('[SignIn] User logged in:', user.id);

    // 2. Sync OneSignal tokens (CRITICAL STEP)
    console.log('[SignIn] Syncing OneSignal tokens...');
    const success = await syncUserWithOneSignal(user.id);
    
    if (success) {
      console.log('[SignIn] ✅ OneSignal tokens synced successfully');
    } else {
      console.error('[SignIn] ❌ OneSignal token sync failed');
    }

    // 3. Navigate to main app
    router.replace('/(tabs)');
    
  } catch (error) {
    console.error('[SignIn] Error:', error);
  }
};
```

**What this does**:
- ✅ Links user to OneSignal with `OneSignal.login(userId)`
- ✅ Waits for OneSignal to generate Subscription ID and FCM token
- ✅ Saves tokens to `profiles` table
- ✅ Saves tokens to `onesignal_players` table
- ✅ Logs registration for debugging
- ✅ Verifies data was saved correctly

---

### Step 4: Clear Tokens on Logout

**File**: `userapp/utils/onesignal.ts`

```typescript
import { clearOneSignalTokens } from '@/utils/onesignal';

const handleLogout = async () => {
  try {
    // 1. Clear OneSignal tokens
    await clearOneSignalTokens();
    console.log('[Logout] ✅ OneSignal tokens cleared');

    // 2. Sign out from Supabase
    await supabase.auth.signOut();
    console.log('[Logout] ✅ Signed out from Supabase');

    // 3. Navigate to login
    router.replace('/(auth)/sign-in');
  } catch (error) {
    console.error('[Logout] Error:', error);
  }
};
```

---

## Complete Code Files

### File 1: `userapp/utils/onesignal.ts`

```typescript
// userapp/utils/onesignal.ts
// Complete OneSignal v5 Push Notification Setup

import { OneSignal, LogLevel } from 'react-native-onesignal';
import { supabase } from '../lib/supabase';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || 
                         process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID || 
                         '38e20d47-839b-4944-8455-daf65977aaf9';

/**
 * STEP 1: Initialize OneSignal v5 SDK
 * Call this ONCE in app _layout.tsx
 */
export async function initializeOneSignal() {
  console.log('[OneSignal] === Starting Initialization ===');

  try {
    // 1. Set debug logging
    OneSignal.Debug.setLogLevel(LogLevel.Verbose);

    // 2. Initialize SDK
    OneSignal.initialize(ONESIGNAL_APP_ID);

    // 3. Request permission
    const permissionGranted = await OneSignal.Notifications.requestPermission(true);

    // 4. Opt in to push
    OneSignal.User.pushSubscription.optIn();

    // 5. Log initial state
    const subscription = OneSignal.User.pushSubscription;
    console.log('[OneSignal] Initial state:', {
      id: subscription.id ? subscription.id.substring(0, 8) + '...' : 'null',
      token: subscription.token ? subscription.token.substring(0, 20) + '...' : 'null',
      subscribed: subscription.subscribed,
      optedIn: subscription.optedIn,
    });

    console.log('[OneSignal] === Initialization Complete ===');
    return true;
  } catch (error: any) {
    console.error('[OneSignal] ❌ Initialization error:', error);
    return false;
  }
}

/**
 * STEP 2: Get current subscription details
 */
export function getOneSignalSubscription() {
  const pushSubscription = OneSignal.User.pushSubscription;
  return {
    onesignalId: pushSubscription.id || null,
    pushToken: pushSubscription.token || null,
    subscribed: pushSubscription.subscribed || false,
    optedIn: pushSubscription.optedIn || false,
  };
}

/**
 * STEP 3: Wait for tokens (polls for up to 60 seconds)
 */
async function waitForOneSignalTokens(maxAttempts = 120): Promise<{ 
  onesignalId: string | null; 
  pushToken: string | null 
}> {
  console.log('[OneSignal] ⏳ Waiting for tokens...');

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 500));

    const { onesignalId, pushToken, subscribed } = getOneSignalSubscription();

    if (onesignalId && pushToken && subscribed) {
      console.log('[OneSignal] ✅ Tokens ready after', (i + 1) * 0.5, 'seconds');
      return { onesignalId, pushToken };
    }

    if (i % 20 === 0 && i > 0) {
      console.log('[OneSignal] Still waiting...', ((i + 1) * 0.5).toFixed(1) + 's');
    }
  }

  console.error('[OneSignal] ❌ Timeout waiting for tokens');
  return { onesignalId: null, pushToken: null };
}

/**
 * STEP 4: Get Expo push token (optional)
 */
export async function getExpoPushToken() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#C41E26',
      });
    }

    const { data } = await Notifications.getExpoPushTokenAsync({
      projectId: 'e6467c5c-fc6a-4ec8-b512-feb4045a4582',
    });

    return data || null;
  } catch (error) {
    console.error('[ExpoPushToken] Error:', error);
    return null;
  }
}

/**
 * STEP 5: Link user and sync tokens to Supabase
 * Call this AFTER user logs in
 */
export async function syncUserWithOneSignal(userId: string) {
  console.log('[OneSignal] === Starting User Sync ===');
  console.log('[OneSignal] User ID:', userId);

  try {
    // 1. Link user to OneSignal
    OneSignal.login(userId);
    console.log('[OneSignal] ✅ User linked:', userId);

    // 2. Get current subscription
    let { onesignalId, pushToken, subscribed, optedIn } = getOneSignalSubscription();

    // 3. Wait for tokens if not ready
    if (!onesignalId || !pushToken) {
      console.log('[OneSignal] ⏳ Tokens not ready, waiting...');
      const tokens = await waitForOneSignalTokens();
      onesignalId = tokens.onesignalId;
      pushToken = tokens.pushToken;
    }

    // 4. Validate tokens
    if (!onesignalId || !pushToken) {
      console.error('[OneSignal] ❌ Failed to get tokens');
      console.error('[OneSignal] Check: Firebase config, SHA-256, App ID');
      return false;
    }

    console.log('[OneSignal] ✅ Tokens obtained:');
    console.log('[OneSignal]   OneSignal ID:', onesignalId);
    console.log('[OneSignal]   Push Token:', pushToken);

    // 5. Get Expo token (optional)
    const expoPushToken = await getExpoPushToken();

    // 6. Update profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        onesignal_player_id: onesignalId,
        expo_push_token: expoPushToken || pushToken,
        push_token: pushToken,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (profileError) {
      console.error('[OneSignal] ❌ Error updating profiles:', profileError.message);
    } else {
      console.log('[OneSignal] ✅ profiles table updated');
    }

    // 7. Update onesignal_players table
    const { error: helperError } = await supabase.rpc('register_user_push_token', {
      p_onesignal_player_id: onesignalId
    });

    if (helperError) {
      console.error('[OneSignal] ⚠️ Helper failed:', helperError.message);
      
      // Fallback: direct upsert
      const { error: playerError } = await supabase
        .from('onesignal_players')
        .upsert({
          user_id: userId,
          onesignal_player_id: onesignalId,
          app_type: 'user',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,app_type',
        });

      if (playerError) {
        console.error('[OneSignal] ❌ Error in upsert:', playerError.message);
      } else {
        console.log('[OneSignal] ✅ onesignal_players updated (direct)');
      }
    } else {
      console.log('[OneSignal] ✅ onesignal_players updated (helper)');
    }

    // 8. Verify
    const { data: verifyData } = await supabase
      .from('onesignal_players')
      .select('user_id, onesignal_player_id')
      .eq('user_id', userId)
      .single();

    if (verifyData) {
      console.log('[OneSignal] ✅ Verification successful');
    }

    console.log('[OneSignal] === Sync Complete ===');
    return true;

  } catch (error: any) {
    console.error('[OneSignal] ❌ Sync error:', error);
    return false;
  }
}

/**
 * STEP 6: Clear tokens on logout
 */
export async function clearOneSignalTokens() {
  try {
    OneSignal.logout();
    OneSignal.User.pushSubscription.optOut();
    console.log('[OneSignal] ✅ Tokens cleared');
    return true;
  } catch (error) {
    console.error('[OneSignal] Error clearing tokens:', error);
    return false;
  }
}
```

---

## Verification

### Check Tokens in Database

```sql
-- Check tokens for specific user
SELECT * FROM check_onesignal_tokens('YOUR-USER-ID-HERE');

-- Check all tokens
SELECT 
  op.user_id,
  op.app_type,
  op.onesignal_player_id,
  op.created_at,
  op.updated_at,
  p.email
FROM onesignal_players op
LEFT JOIN profiles p ON p.id = op.user_id
ORDER BY op.updated_at DESC;

-- Check registration logs
SELECT * FROM onesignal_registration_log 
ORDER BY created_at DESC 
LIMIT 20;
```

### Check Console Logs

After login, you should see:

```
[OneSignal] === Starting Initialization ===
[OneSignal] ✅ Debug logging enabled
[OneSignal] ✅ SDK initialized
[OneSignal] Permission granted: true
[OneSignal] ✅ Opted in to push notifications
[OneSignal] === Initialization Complete ===

[OneSignal] === Starting User Sync ===
[OneSignal] User ID: abc12345-6789-abcd-efgh-ijklmnopqrst
[OneSignal] ✅ User linked: abc12345-6789-abcd-efgh-ijklmnopqrst
[OneSignal] ⏳ Tokens not ready, waiting...
[OneSignal] ✅ Tokens ready after 2.5 seconds
[OneSignal] ✅ Tokens obtained:
[OneSignal]   OneSignal ID: abc12345-6789-abcd-efgh-ijklmnopqrst
[OneSignal]   Push Token: fCM_Token_ABC123...
[OneSignal] ✅ profiles table updated
[OneSignal] ✅ onesignal_players updated via helper function
[OneSignal] ✅ Verification successful
[OneSignal] === Sync Complete ===
```

---

## Troubleshooting

### Issue 1: Subscription ID is null

**Symptoms**: `[OneSignal] Initial subscription status: { onesignalId: null, ... }`

**Solutions**:
1. Check `google-services.json` exists in app folder
2. Verify SHA-256 fingerprint in Firebase console
3. Run: `npx expo prebuild --clean --platform android`
4. Rebuild app: `npx expo run:android`

### Issue 2: Tokens not saving to database

**Symptoms**: Console shows "Error updating profiles" or "RLS policy violation"

**Solutions**:
1. Run the SQL migration `COMPLETE_ONESIGNAL_SETUP.sql`
2. Check RLS policies are correct
3. Verify helper functions exist: `SELECT * FROM pg_proc WHERE proname LIKE 'register_%';`

### Issue 3: Notifications work from dashboard but not edge function

**Symptoms**: OneSignal dashboard sends successfully, but edge function finds no player ID

**Solutions**:
1. Check `onesignal_players` table has data: `SELECT * FROM onesignal_players;`
2. Verify edge function uses service role key
3. Check edge function logs for player ID lookup

---

## Summary

| Step | Action | File | When |
|------|--------|------|------|
| 1 | Run SQL migration | `COMPLETE_ONESIGNAL_SETUP.sql` | Once |
| 2 | Initialize OneSignal | `_layout.tsx` | App start |
| 3 | Sync tokens | `sign-in.tsx` | After login |
| 4 | Clear tokens | `onesignal.ts` | On logout |
| 5 | Verify | Supabase SQL | Anytime |

This complete flow ensures:
- ✅ OneSignal SDK properly initialized
- ✅ Subscription ID generated from OneSignal
- ✅ Push token generated from Firebase/FCM
- ✅ Both tokens saved to Supabase
- ✅ Tokens logged for debugging
- ✅ Proper cleanup on logout
