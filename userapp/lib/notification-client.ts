// supabase/lib/notification-client.ts
// Client-side notification sender - more reliable than database triggers

import { supabase } from './supabase';

interface OrderNotification {
  record: {
    id: string;
    order_number: string;
    user_id: string;
    restaurant_id?: string;
    total_amount: number;
    status: string;
    created_at?: string;
  };
  old_record?: {
    status?: string;
    delivery_person_id?: string;
  };
  table: 'orders' | 'delivery_assignments';
  type: 'INSERT' | 'UPDATE';
}

/**
 * Send OneSignal notification via edge function
 * Call this directly from app code instead of relying on database triggers
 */
export async function sendOrderNotification(notification: OrderNotification) {
  console.log('[NotificationClient] Sending notification:', notification);
  
  try {
    const { data, error } = await supabase.functions.invoke('send-onesignal-notification', {
      body: notification
    });

    if (error) {
      console.error('[NotificationClient] Error sending notification:', error);
      return { success: false, error };
    }

    console.log('[NotificationClient] Notification sent successfully:', data);
    return { success: true, data };
  } catch (error) {
    console.error('[NotificationClient] Exception sending notification:', error);
    return { success: false, error };
  }
}

/**
 * Send new order notification (to admin and user)
 */
export async function sendNewOrderNotification(order: {
  id: string;
  order_number: string;
  user_id: string;
  total_amount: number;
  status: string;
}) {
  return sendOrderNotification({
    record: order,
    table: 'orders',
    type: 'INSERT'
  });
}

/**
 * Send order status update notification (to user)
 */
export async function sendOrderStatusUpdateNotification(
  newOrder: {
    id: string;
    order_number: string;
    user_id: string;
    status: string;
    total_amount?: number;
  },
  oldStatus: string
) {
  return sendOrderNotification({
    record: newOrder as any,
    old_record: { status: oldStatus },
    table: 'orders',
    type: 'UPDATE'
  });
}

/**
 * Send delivery assignment notification (to delivery person)
 */
export async function sendDeliveryAssignmentNotification(assignment: {
  id: string;
  order_id: string;
  delivery_person_id: string;
}) {
  return sendOrderNotification({
    record: assignment as any,
    table: 'delivery_assignments',
    type: 'INSERT'
  });
}
