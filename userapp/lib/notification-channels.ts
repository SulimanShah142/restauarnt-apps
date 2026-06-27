/**
 * Setup Android Notification Channels
 * Call this early in app initialization to ensure notifications work properly
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function setupNotificationChannels() {
  if (Platform.OS === 'android') {
    // Create Order Updates channel
    await Notifications.setNotificationChannelAsync('order-updates', {
      name: 'Order Updates',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#C41E26',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      description: 'Notifications about your order status (confirmed, preparing, ready, on the way, delivered)',
    });

    // Create General Notifications channel
    await Notifications.setNotificationChannelAsync('general-notifications', {
      name: 'General Notifications',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2196F3',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      description: 'General app notifications and announcements',
    });

    // Create Delivery Updates channel (for delivery app)
    await Notifications.setNotificationChannelAsync('delivery-updates', {
      name: 'Delivery Updates',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF9800',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      description: 'Delivery assignment and status updates',
    });

    console.log('[NotificationChannels] ✅ Android notification channels created');
  }
}

/**
 * Configure notification handler for when notifications are received
 */
export function setupNotificationHandler() {
  // Set handler for notifications received while app is foregrounded
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const shouldShowNotification = true;
      
      return {
        shouldShowNotification,
        shouldPlaySound: true,
        shouldSetBadge: true,
      };
    },
  });

  console.log('[NotificationHandler] ✅ Notification handler configured');
}
