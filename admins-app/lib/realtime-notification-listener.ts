// Realtime Notification Listener for Orders
// Listens to Supabase orders table changes directly (no notifications table needed)
// This is more efficient and doesn't waste database space

import { supabase } from './supabase';
import { sendLocalNotification } from './notification-service';

let isListening = false;
let realtimeChannel: any = null;

// Start listening for new orders from Supabase
export const startNotificationListener = async (userId: string) => {
  if (isListening) {
    return;
  }

  try {

    // Subscribe to orders table changes directly
    realtimeChannel = supabase
      .channel('orders-listener')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders'
        },
        async (payload) => {

          const newOrder = payload.new;

          // Trigger system notification with sound
          await sendLocalNotification({
            title: '🔔 New Order Received!',
            body: `Order #${newOrder.order_number?.substring(0, 8) || 'New'} - AFG ${newOrder.total_amount || 0}`,
            type: 'order',
            sound: true,
            badge: 1,
            data: {
              orderId: newOrder.id,
              orderNumber: newOrder.order_number,
              type: 'new-order'
            }
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders'
        },
        async (payload) => {
          const order = payload.new;
          const oldOrder = payload.old;

          // Only notify if status changed to delivered
          if (oldOrder.status !== order.status && order.status === 'delivered') {

            await sendLocalNotification({
              title: '✅ Order Delivered',
              body: `Order #${order.order_number?.substring(0, 8)} has been delivered successfully!`,
              type: 'success',
              sound: true,
              badge: 0,
              data: {
                orderId: order.id,
                type: 'order-delivered'
              }
            });
          }
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

// Initialize listener when app starts
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
