// Realtime Notification Hook for Admin App
// Listens to Supabase table changes directly (orders, delivery_assignments, etc.)
// Does NOT use notifications table (saves space)
// UPDATED: Added system notifications and detailed console logging
// UPDATED: Send notifications to all admins (no user filtering)

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { sendLocalNotification } from '@/lib/notification-service';

export function useAdminNotificationListener(adminEmail: string | null) {
  const [notification, setNotification] = useState<{
    title: string;
    message: string;
    visible: boolean;
  }>({ title: '', message: '', visible: false });

  useEffect(() => {
    // Listen to all order events regardless of admin email
    // Notifications are sent to ALL admins when orders are created/updated


    // ============================================
    // 1. LISTEN TO ORDERS TABLE - NEW ORDERS
    // ============================================
    const ordersChannel = supabase
      .channel('admin-orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders'
        },
        async (payload) => {
          const order = payload.new;

          // Show in-app notification
          setNotification({
            title: '🔔 New Order Received!',
            message: `Order #${order.order_number?.substring(0, 8) || 'N/A'} - AFG ${order.total_amount || 0}`,
            visible: true
          });

          // Auto-hide after 5 seconds
          setTimeout(() => {
            setNotification(prev => ({ ...prev, visible: false }));
          }, 5000);

          // Show SYSTEM notification (appears in notification center)
          try {
            await sendLocalNotification({
              title: '🔔 New Order Received!',
              body: `Order #${order.order_number?.substring(0, 8) || 'N/A'} - AFG ${order.total_amount || 0}`,
              type: 'order',
              sound: true,
              badge: 1,
              data: {
                orderId: order.id,
                orderNumber: order.order_number,
                type: 'new-order',
                timestamp: new Date().toISOString()
              }
            });
          } catch (error) {
            console.error('[AdminNotificationHook] ❌ Error sending system notification:', error);
            console.error('[AdminNotificationHook] Error details:', JSON.stringify(error, null, 2));
          }
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

            // Show in-app notification
            setNotification({
              title: '✅ Order Delivered',
              message: `Order #${order.order_number?.substring(0, 8) || 'N/A'} has been delivered`,
              visible: true
            });

            setTimeout(() => {
              setNotification(prev => ({ ...prev, visible: false }));
            }, 5000);

            // Show SYSTEM notification
            try {
              await sendLocalNotification({
                title: '✅ Order Delivered',
                body: `Order #${order.order_number?.substring(0, 8) || 'N/A'} has been delivered successfully`,
                type: 'success',
                sound: true,
                badge: 0,
                data: {
                  orderId: order.id,
                  orderNumber: order.order_number,
                  type: 'order-delivered',
                  timestamp: new Date().toISOString()
                }
              });
            } catch (error) {
              console.error('[AdminNotificationHook] ❌ Error sending system notification:', error);
              console.error('[AdminNotificationHook] Error details:', JSON.stringify(error, null, 2));
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.error('[AdminNotificationHook] ❌ Subscription error:', status);
          console.error('[AdminNotificationHook] 💡 Check Supabase realtime settings');
        }
      });

    // ============================================
    // 2. LISTEN TO DELIVERY_ASSIGNMENTS TABLE
    // ============================================
    const assignmentsChannel = supabase
      .channel('admin-assignments')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'delivery_assignments'
        },
        async (payload) => {
          const assignment = payload.new;

          // Show in-app notification
          setNotification({
            title: '🚴 Delivery Assigned',
            message: `Order #${assignment.order_number?.substring(0, 8) || 'N/A'} assigned to delivery person`,
            visible: true
          });

          setTimeout(() => {
            setNotification(prev => ({ ...prev, visible: false }));
          }, 5000);

          // Show SYSTEM notification
          try {
            await sendLocalNotification({
              title: '🚴 Delivery Assigned',
              body: `Order #${assignment.order_number?.substring(0, 8) || 'N/A'} assigned to delivery person`,
              type: 'info',
              sound: true,
              badge: 1,
              data: {
                assignmentId: assignment.id,
                orderNumber: assignment.order_number,
                type: 'delivery-assignment',
                timestamp: new Date().toISOString()
              }
            });
          } catch (error) {
            console.error('[AdminNotificationHook] ❌ Error sending system notification:', error);
            console.error('[AdminNotificationHook] Error details:', JSON.stringify(error, null, 2));
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.error('[AdminNotificationHook] ❌ Assignments subscription error:', status);
        }
      });

    // ============================================
    // CLEANUP
    // ============================================
    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(assignmentsChannel);
    };
  }, [adminEmail]);

  return {
    notification,
    setNotification,
    isListening: true
  };
}
