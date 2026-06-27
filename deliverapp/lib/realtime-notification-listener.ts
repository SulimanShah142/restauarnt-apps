// Realtime Notification Listener for Expo/React Native
// Listens to Supabase notifications table and triggers system notifications

import { supabase } from './supabase';
import { sendLocalNotification } from './notification-service';
import { Platform } from 'react-native';

let isListening = false;
let realtimeChannel: any = null;

// Get current user ID from storage or context
let currentUserId: string | null = null;

export const setCurrentUserId = (userId: string) => {
  currentUserId = userId;
};

export const getCurrentUserId = (): string | null => {
  return currentUserId;
};

// Start listening for new notifications from Supabase
export const startNotificationListener = async (userId: string) => {
  if (isListening) {
    return;
  }

  setCurrentUserId(userId);

  try {
    // Subscribe to notifications table changes
    realtimeChannel = supabase
      .channel('notifications-listener')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        async (payload) => {
          const newNotification = payload.new;

          // Trigger system notification with sound
          await sendLocalNotification({
            title: newNotification.title || 'New Notification',
            body: newNotification.message || '',
            type: newNotification.type as any || 'info',
            sound: true,
            badge: 1,
            data: {
              notificationId: newNotification.id,
              orderId: newNotification.order_id,
              type: newNotification.type
            }
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          isListening = true;
        } else {
          console.error('[NotificationListener] ❌ Subscription error:', status);
          isListening = false;
        }
      });
  } catch (error) {
    console.error('[NotificationListener] Error starting listener:', error);
    isListening = false;
  }
};

// Stop listening for notifications
export const stopNotificationListener = async () => {
  if (!isListening || !realtimeChannel) {
    return;
  }

  try {
    await supabase.removeChannel(realtimeChannel);
    isListening = false;
  } catch (error) {
    console.error('[NotificationListener] Error stopping listener:', error);
  }
};

// Check if listener is active
export const isNotificationListenerActive = (): boolean => {
  return isListening;
};

// Initialize listener when app starts (call from _layout.tsx after auth is ready)
export const initializeNotificationListener = async (userId: string) => {
  if (!userId) {
    return;
  }

  // Wait a bit for app to be fully loaded
  await new Promise(resolve => setTimeout(resolve, 2000));

  await startNotificationListener(userId);
};

// Cleanup on unmount
export const cleanupNotificationListener = async () => {
  await stopNotificationListener();
};
