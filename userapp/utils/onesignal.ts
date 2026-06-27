// OneSignal v5 Push Notification Setup
import { OneSignal, LogLevel } from 'react-native-onesignal';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const ONESIGNAL_APP_ID = '38e20d47-839b-4944-8455-daf65977aaf9';

// Store listener cleanup function
let subscriptionListener: any = null;

/**
 * Initialize OneSignal v5 SDK
 * Call this early in app initialization
 */
export async function initializeOneSignal() {
  console.log('[OneSignal] === Initializing OneSignal SDK ===');

  try {
    OneSignal.Debug.setLogLevel(LogLevel.Verbose);
    console.log('[OneSignal] ✅ Debug logging enabled');

    OneSignal.initialize(ONESIGNAL_APP_ID);
    console.log('[OneSignal] ✅ SDK initialized');

    // Setup subscription observer to catch tokens when they arrive
    setupSubscriptionObserver();
  } catch (error: any) {
    console.error('[OneSignal] ❌ Initialization error:', error);
  }
}

/**
 * Setup subscription observer to catch tokens when they arrive
 * This is CRITICAL for OneSignal v5 - tokens arrive asynchronously after optIn()
 */
function setupSubscriptionObserver() {
  // Remove existing listener if any
  if (subscriptionListener) {
    try {
      OneSignal.User.pushSubscription.removeEventListener('change', subscriptionListener);
    } catch (e) {
      console.log('[OneSignal] ⚠️ Error removing old listener:', e);
    }
  }

  // Add new listener
  subscriptionListener = (event: any) => {
    const id = event.current?.id;
    const token = event.current?.token;
    const optedIn = event.current?.optedIn;

    console.log('[OneSignal] 📡 Subscription changed event:', {
      hasId: !!id,
      hasToken: !!token,
      optedIn,
      id: id?.substring(0, 8) + '...',
      token: token?.substring(0, 20) + '...',
    });

    // When tokens arrive, save them to database
    if (id && token && optedIn) {
      console.log('[OneSignal] ✅ Tokens received via subscription event!');
      console.log('[OneSignal] ID:', id);
      console.log('[OneSignal] Token:', token.substring(0, 20) + '...');

      // Save to database
      saveTokensToDatabase(id, token).catch((err) => {
        console.error('[OneSignal] ❌ Error saving tokens from event:', err);
      });
    }
  };

  OneSignal.User.pushSubscription.addEventListener('change', subscriptionListener);
  console.log('[OneSignal] ✅ Subscription observer setup complete');
}

/**
 * Save tokens to database
 */
async function saveTokensToDatabase(onesignalId: string, pushToken: string) {
  try {
    // Get current user - try Supabase first, fallback to cached
    let userId: string | null = null;

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!authError && user) {
        userId = user.id;
        console.log('[OneSignal] 💾 Got user ID from supabase.auth.getUser()');
      }
    } catch (e) {
      console.log('[OneSignal] ⚠️ supabase.auth.getUser() failed, trying cached');
    }

    // Fallback: get cached user ID
    if (!userId) {
      const cachedUserId = await AsyncStorage.getItem('user_id');
      if (cachedUserId) {
        userId = cachedUserId;
        console.log('[OneSignal] 💾 Got user ID from cached AsyncStorage');
      }
    }

    if (!userId) {
      console.log('[OneSignal] ⚠️ No authenticated user found for token save');
      return;
    }

    console.log('[OneSignal] 💾 Saving tokens for user:', userId);

    // Update profiles table
    const { error } = await (supabase
      .from('profiles')
      .update({
        onesignal_player_id: onesignalId,
        expo_push_token: pushToken,
        push_token: pushToken,
        updated_at: new Date().toISOString(),
      } as unknown as never)
      .eq('id', userId)
      .select() as unknown as { data: any; error: any });

    if (error) {
      console.error('[OneSignal] ❌ Error saving tokens:', error.message);
    } else {
      console.log('[OneSignal] ✅ Tokens saved to profiles table');
    }

    // Update onesignal_players table
    const { error: playerError } = await (supabase
      .from('onesignal_players')
      .upsert({
        user_id: userId,
        onesignal_player_id: onesignalId,
        app_type: 'user',
        updated_at: new Date().toISOString(),
      } as unknown as never, {
        onConflict: 'user_id,app_type',
      }) as unknown as { data: any; error: any });

    if (playerError) {
      console.error('[OneSignal] ❌ Error saving to onesignal_players:', playerError.message);
    } else {
      console.log('[OneSignal] ✅ Tokens saved to onesignal_players table');
    }

    // Force server sync with a tag
    OneSignal.User.addTag("last_sync", new Date().toISOString());
    console.log('[OneSignal] 🎉 Token sync complete!');
  } catch (error: any) {
    console.error('[OneSignal] ❌ Error in saveTokensToDatabase:', error);
    throw error;
  }
}

/**
 * Get OneSignal subscription details
 */
export function getOneSignalSubscription() {
  const pushSubscription = OneSignal.User.pushSubscription as any;

  return {
    onesignalId: pushSubscription.id || null,
    pushToken: pushSubscription.token || null,
    optedIn: pushSubscription.optedIn || false,
  };
}

/**
 * Sync OneSignal tokens to Supabase
 * Call this AFTER user logs in
 * 
 * NOTE: In OneSignal v5, tokens are generated ASYNCHRONOUSLY after optIn().
 * The subscription observer will catch them and save to DB automatically.
 * This function handles the login + opt-in flow.
 */
export async function syncOneSignalTokens() {
  try {
    console.log('[OneSignal] === Starting Token Sync ===');

    // 1. Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[OneSignal] ❌ No authenticated user found');
      return;
    }

    const userId = user.id;
    console.log('[OneSignal] 👤 User ID:', userId);

    // Cache user ID for subscription event fallback
    await AsyncStorage.setItem('user_id', userId);
    console.log('[OneSignal] 💾 Cached user_id for subscription events');

    // 2. Identify the user FIRST
    console.log('[OneSignal] 🔑 Logging into OneSignal...');
    OneSignal.login(userId);
    console.log('[OneSignal] ✅ User identified');

    // 3. Request notification permission
    console.log('[OneSignal] 🔔 Requesting permission...');
    const granted = await OneSignal.Notifications.requestPermission(true);
    console.log('[OneSignal] Permission granted:', granted);

    if (!granted) {
      console.log('[OneSignal] ❌ Permission Denied');
      return;
    }

    // 4. Force Opt-In - this triggers async token generation
    console.log('[OneSignal] 🚀 Opting in...');
    OneSignal.User.pushSubscription.optIn();
    console.log('[OneSignal] ✅ Opted in - tokens will arrive via subscription event');

    // 5. Check if tokens are already available (rare, but possible if re-login)
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

    const pushSub = OneSignal.User.pushSubscription as any;
    const id = pushSub.id;
    const token = pushSub.token;

    if (id && token) {
      console.log('[OneSignal] ✅ Tokens already available!');
      console.log('[OneSignal] ID:', id);
      console.log('[OneSignal] Token:', token.substring(0, 20) + '...');

      // Save immediately
      await saveTokensToDatabase(id, token);
    } else {
      console.log('[OneSignal] ⏳ Tokens not ready yet - waiting for subscription event...');
      console.log('[OneSignal] The subscription observer will save them automatically when they arrive');
    }
  } catch (error: any) {
    console.error('[OneSignal] ❌ Sync error:', error);
    throw error;
  }
}

/**
 * Clear OneSignal tokens on logout
 */
export async function clearOneSignalTokens() {
  try {
    console.log('[OneSignal] Clearing tokens...');
    OneSignal.logout();
    OneSignal.User.pushSubscription.optOut();
    await AsyncStorage.removeItem('user_id');
    console.log('[OneSignal] ✅ Tokens cleared');
  } catch (error) {
    console.error('[OneSignal] Error clearing tokens:', error);
  }
}

/**
 * Check notification permission
 */
export async function checkNotificationPermission(): Promise<boolean> {
  try {
    const permission = await OneSignal.Notifications.permissionNative();
    return String(permission) === 'authorized';
  } catch (error) {
    return false;
  }
}
