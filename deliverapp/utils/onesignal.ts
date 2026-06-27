// OneSignal v5 Push Notification Setup for Delivery App
import { OneSignal, LogLevel } from 'react-native-onesignal';
import { supabase } from '@/lib/supabase';
import { getStoredDeliverySession } from '@/lib/delivery-auth'; // 👈 Import your actual helper

const ONESIGNAL_APP_ID ='da1609d1-cebc-47a1-9b0c-4d797997344c';

// Store listener cleanup function
let subscriptionListener: any = null;

/**
 * Initialize OneSignal v5 SDK
 */
export async function initializeOneSignal() {
  console.log('[OneSignal] === Initializing OneSignal SDK ===');

  try {
    OneSignal.Debug.setLogLevel(LogLevel.Verbose);
    console.log('[OneSignal] ✅ Debug logging enabled');

    OneSignal.initialize(ONESIGNAL_APP_ID);
    console.log('[OneSignal] ✅ SDK initialized');

    // Setup subscription observer to catch tokens when they arrive asynchronously
    setupSubscriptionObserver();
  } catch (error: any) {
    console.error('[OneSignal] ❌ Initialization error:', error);
  }
}

/**
 * Setup subscription observer to catch tokens when they arrive
 */
function setupSubscriptionObserver() {
  if (subscriptionListener) {
    try {
      OneSignal.User.pushSubscription.removeEventListener('change', subscriptionListener);
    } catch (e) {
      console.log('[OneSignal] ⚠️ Error removing old listener:', e);
    }
  }

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

    if (id && token && optedIn) {
      console.log('[OneSignal] ✅ Tokens received via subscription event!');
      saveTokensToDatabase(id, token).catch((err) => {
        console.error('[OneSignal] ❌ Error saving tokens from event:', err);
      });
    }
  };

  OneSignal.User.pushSubscription.addEventListener('change', subscriptionListener);
  console.log('[OneSignal] ✅ Subscription observer setup complete');
}

/**
 * Save tokens to database using the verified session schema
 */
async function saveTokensToDatabase(onesignalId: string, pushToken: string) {
  try {
    // 💡 FIXED: Pulling directly using your file's logic
    const session = await getStoredDeliverySession();
    if (!session) {
      console.log('[OneSignal] ⚠️ No delivery session found via helper for token save');
      return;
    }

    // Capture the ID matching your session object shape (delivery_person_id)
    const deliveryPersonId = session.delivery_person_id || session.id;

    if (!deliveryPersonId) {
      console.log('[OneSignal] ⚠️ No valid delivery person ID found in session object');
      return;
    }

    console.log('[OneSignal] 💾 Saving tokens for delivery person:', deliveryPersonId);

    // 1. Update delivery_people table
    const { error: dbError } = await supabase
      .from('delivery_persons') // 👈 Double check if your table name is delivery_persons or delivery_people
      .update({
        onesignal_id: onesignalId,
        push_token: pushToken,
        updated_at: new Date().toISOString(),
      })
      .eq('id', deliveryPersonId);

    if (dbError) {
      console.error('[OneSignal] ❌ Error updating delivery_persons table:', dbError.message);
    } else {
      console.log('[OneSignal] ✅ Tokens saved to delivery_persons table');
    }

    // 2. Save to onesignal_players table (matching your working admin triggers pattern!)
    try {
      await supabase
        .from('onesignal_players')
        .upsert({
          user_id: deliveryPersonId,
          onesignal_player_id: onesignalId,
          app_type: 'delivery',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,app_type',
        } as any);
      console.log('[OneSignal] ✅ Tokens saved to onesignal_players table (app_type: delivery)');
    } catch (playerErr: any) {
      console.error('[OneSignal] ❌ Error saving to onesignal_players:', playerErr.message);
    }

    OneSignal.User.addTag("last_sync", new Date().toISOString());
  } catch (error: any) {
    console.error('[OneSignal] ❌ Error in saveTokensToDatabase:', error);
  }
}

/**
 * Sync OneSignal tokens to Supabase for delivery app
 */
export async function syncOneSignalTokens() {
  try {
    console.log('[OneSignal] === Starting Token Sync ===');

    // 💡 FIXED: Read directly from your custom authorization state
    const session = await getStoredDeliverySession();
    if (!session) {
      console.log('[OneSignal] ❌ No delivery session found via helper during sync initialization');
      return;
    }

    const deliveryPersonId = session.delivery_person_id || session.id;
    if (!deliveryPersonId) {
      console.log('[OneSignal] ❌ No delivery person ID found in session configuration details');
      return;
    }

    console.log('[OneSignal] 👤 Delivery User ID Verified:', deliveryPersonId);

    // Identify the user with OneSignal core
    OneSignal.login(deliveryPersonId);
    console.log('[OneSignal] ✅ User identified');

    console.log('[OneSignal] 🔔 Requesting permission...');
    const granted = await OneSignal.Notifications.requestPermission(true);
    console.log('[OneSignal] Permission granted:', granted);

    if (!granted) {
      console.log('[OneSignal] ❌ Permission Denied');
      return;
    }

    console.log('[OneSignal] 🚀 Opting in...');
    OneSignal.User.pushSubscription.optIn();
    console.log('[OneSignal] ✅ Opted in - tokens will process asynchronously via listener event');

    // Run the short 2-second check loop matching your admin layout
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const pushSub = OneSignal.User.pushSubscription as any;
    const id = pushSub.id;
    const token = pushSub.token;

    if (id && token) {
      console.log('[OneSignal] ✅ Tokens immediate match!');
      await saveTokensToDatabase(id, token);
    } else {
      console.log('[OneSignal] ⏳ Tokens processing asynchronously in background listener thread...');
    }
  } catch (error: any) {
    console.error('[OneSignal] ❌ Sync error:', error);
  }
}

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
