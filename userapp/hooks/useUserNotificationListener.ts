// Realtime Notification Hook for User App
// Listens to Supabase orders table changes directly
// Does NOT use notifications table (saves space)

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useUserNotificationListener(userId: string | null) {
  const [notification, setNotification] = useState<{
    title: string;
    message: string;
    visible: boolean;
  }>({ title: '', message: '', visible: false });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Wait for userId to be provided
    if (!userId) {
      setIsReady(false);
      return;
    }

    // Mark as ready once userId is available
    setIsReady(true);

    // ============================================
    // LISTEN TO ORDERS TABLE - STATUS CHANGES
    // ============================================
    const ordersChannel = supabase
      .channel('user-orders')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const order = payload.new;
          const oldOrder = payload.old;

          // Show notification based on status
          let title = '';
          let message = '';

          if (order.status === 'confirmed' && oldOrder.status !== 'confirmed') {
            title = '✅ Order Confirmed!';
            message = `Your order from ${order.restaurant_name} has been confirmed`;
          } else if (order.status === 'preparing' && oldOrder.status !== 'preparing') {
            title = '👨‍🍳 Order Preparing!';
            message = 'Your order is being prepared';
          } else if (order.status === 'ready' && oldOrder.status !== 'ready') {
            title = '📦 Order Ready!';
            message = 'Your order is ready for pickup';
          } else if (order.status === 'on_the_way' && oldOrder.status !== 'on_the_way') {
            title = '🚴 Order On The Way!';
            message = 'Your order is on the way to you';
          } else if (order.status === 'delivered' && oldOrder.status !== 'delivered') {
            title = '🎉 Order Delivered!';
            message = 'Your order has been delivered. Enjoy your meal!';
          }

          if (title && message) {
            // Show in-app notification
            setNotification({
              title,
              message,
              visible: true
            });

            // Auto-hide after 5 seconds
            setTimeout(() => {
              setNotification(prev => ({ ...prev, visible: false }));
            }, 5000);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // console.log('[UserNotificationListener] ✅ Subscribed to order updates');
        }
      });

    // ============================================
    // CLEANUP
    // ============================================
    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, [userId]);

  return {
    notification,
    setNotification,
    isListening: !!userId,
    isReady,
  };
}
