// OneSignal Push Notification Hook for All Apps
// Handles registration and receiving push notifications

import { useEffect } from 'react';
import OneSignal from 'react-native-onesignal';
import { supabase } from '@/lib/supabase';

export function useOneSignal(appType: 'user' | 'admin' | 'delivery', userId?: string) {
  useEffect(() => {
    initializeOneSignal(appType, userId);
  }, [appType, userId]);
}

async function initializeOneSignal(appType: 'user' | 'admin' | 'delivery', userId?: string) {
  try {
    console.log('[OneSignal] === Initializing OneSignal ===');
    console.log('[OneSignal] App Type:', appType);
    console.log('[OneSignal] User ID:', userId);

    // Get OneSignal App ID from environment
    // You'll need to add this to your app.json or .env
    const ONE_SIGNAL_APP_ID = 'YOUR_ONESIGNAL_APP_ID_HERE'; // Replace with your actual App ID

    if (!ONE_SIGNAL_APP_ID) {
      console.error('[OneSignal] ❌ OneSignal App ID not configured');
      return;
    }

    // Initialize OneSignal
    OneSignal.setAppId(ONE_SIGNAL_APP_ID);

    // Request permission (iOS only, Android handles automatically)
    OneSignal.promptForPushNotificationsWithUserResponse(response => {
      console.log('[OneSignal] Permission response:', response);
    });

    // Get player ID when device is registered
    OneSignal.getIds(ids => {
      console.log('[OneSignal] Device IDs:', ids);
      
      if (ids.userId && userId) {
        // Save player ID to database
        savePlayerId(userId, ids.userId, appType);
      }
    });

    // Handle notification received while app is open
    const notificationOpenedHandler = (notification: any) => {
      console.log('[OneSignal] Notification opened:', notification);
      
      const data = notification.payload.additionalData;
      if (data) {
        // Handle navigation based on notification type
        if (data.type === 'new_order') {
          // Navigate to order details
          console.log('[OneSignal] Navigate to order:', data.order_id);
        } else if (data.type === 'order_status_changed') {
          // Navigate to order tracking
          console.log('[OneSignal] Navigate to order status:', data.order_id);
        } else if (data.type === 'new_assignment') {
          // Navigate to delivery details
          console.log('[OneSignal] Navigate to delivery:', data.assignment_id);
        }
      }
    };

    OneSignal.setNotificationOpenedHandler(notificationOpenedHandler);

    // Handle notification received
    const notificationReceivedHandler = (notification: any) => {
      console.log('[OneSignal] Notification received:', notification);
    };

    OneSignal.setNotificationReceivedHandler(notificationReceivedHandler);

    console.log('[OneSignal] ✅ OneSignal initialized successfully');

  } catch (error) {
    console.error('[OneSignal] ❌ Error initializing OneSignal:', error);
  }
}

async function savePlayerId(userId: string, playerId: string, appType: 'user' | 'admin' | 'delivery') {
  try {
    console.log('[OneSignal] 📝 Saving player ID to database...');
    
    const { data, error } = await supabase
      .from('onesignal_players')
      .upsert({
        user_id: userId,
        onesignal_player_id: playerId,
        app_type: appType,
      }, {
        onConflict: 'user_id,onesignal_player_id',
      });

    if (error) {
      console.error('[OneSignal] ❌ Error saving player ID:', error);
    } else {
      console.log('[OneSignal] ✅ Player ID saved successfully!');
      console.log('[OneSignal] Will receive push notifications!');
    }
  } catch (error) {
    console.error('[OneSignal] ❌ Error saving player ID:', error);
  }
}
