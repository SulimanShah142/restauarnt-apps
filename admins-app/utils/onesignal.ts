// OneSignal v5 Push Notification Setup
import { OneSignal, LogLevel } from 'react-native-onesignal';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONESIGNAL_APP_ID = '2665a069-40cb-4335-8af1-0f4d8b77aeea';

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
    // Get admin session
    const sessionJson = await AsyncStorage.getItem('admin_session');
    if (!sessionJson) {
      console.log('[OneSignal] ⚠️ No admin session found for token save');
      return;
    }

    const session = JSON.parse(sessionJson);
    const email = session?.user?.email;
    const adminUserId = session?.user?.id;

    if (!email) {
      console.log('[OneSignal] ⚠️ No email in session for token save');
      return;
    }

    console.log('[OneSignal] 💾 Saving tokens for admin:', email);

    // 1. Update admins table
    const { error: adminError } = await supabase
      .from('admins')
      .update({
        onesignal_player_id: onesignalId,
        expo_push_token: pushToken,
        updated_at: new Date().toISOString(),
      })
      .eq('email', email);

    if (adminError) {
      console.error('[OneSignal] ❌ Error updating admins:', adminError.message);
    } else {
      console.log('[OneSignal] ✅ Tokens saved to admins table');
    }

    // 2. CRITICAL: Save to onesignal_players table (this is what the triggers query!)
    if (adminUserId) {
      console.log('[OneSignal] 💾 Saving to onesignal_players for user:', adminUserId);

      try {
        await supabase
          .from('onesignal_players')
          .upsert({
            user_id: adminUserId,
            onesignal_player_id: onesignalId,
            app_type: 'admin',
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,app_type',
          } as any);
        console.log('[OneSignal] ✅ Tokens saved to onesignal_players table (app_type: admin)');
      } catch (playerErr: any) {
        console.error('[OneSignal] ❌ Error saving to onesignal_players:', playerErr.message);
      }
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
 * Sync OneSignal tokens to Supabase for admin
 * Call this AFTER admin logs in
 * 
 * NOTE: In OneSignal v5, tokens are generated ASYNCHRONOUSLY after optIn().
 * The subscription observer will catch them and save to DB automatically.
 * This function handles the login + opt-in flow.
 */
export async function syncOneSignalTokens() {
  try {
    console.log('[OneSignal] === Starting Token Sync ===');

    // 1. Get admin session
    const sessionJson = await AsyncStorage.getItem('admin_session');
    if (!sessionJson) {
      console.log('[OneSignal] ❌ No admin session found');
      return;
    }

    const session = JSON.parse(sessionJson);
    const email = session?.user?.email;
    const adminUserId = session?.user?.id;

    if (!email) {
      console.log('[OneSignal] ❌ No email in session');
      return;
    }

    console.log('[OneSignal] 📧 Admin email:', email);
    console.log('[OneSignal] 👤 Admin user ID:', adminUserId || 'not available');

    // 2. Identify the user FIRST
    if (adminUserId) {
      console.log('[OneSignal] 🔑 Logging into OneSignal...');
      OneSignal.login(adminUserId);
      console.log('[OneSignal] ✅ User identified');
    }

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
