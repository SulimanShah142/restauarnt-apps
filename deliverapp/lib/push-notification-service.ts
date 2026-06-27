// Push Notification Service for Background Notifications
// Uses Expo Push API to send notifications even when app is closed

import { supabase } from '@/lib/supabase';

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

/**
 * Send BACKGROUND push notification via Expo Push API
 * Works even when app is CLOSED!
 */
export async function sendBackgroundPushNotification({
  email,
  title,
  body,
  data = {},
  appType = 'delivery'
}: {
  email: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  appType?: 'admin' | 'user' | 'delivery';
}) {

  try {
    // Get push token from database
    let pushToken: string | null = null;

    if (appType === 'delivery') {
      const { data: deliveryData } = await supabase
        .from('delivery_persons')
        .select('expo_push_token')
        .eq('email', email)
        .not('expo_push_token', 'is', null)
        .single();

      pushToken = deliveryData?.expo_push_token || null;
    } else if (appType === 'admin' || appType === 'user') {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('expo_push_token')
        .eq('email', email)
        .not('expo_push_token', 'is', null)
        .single();

      pushToken = profileData?.expo_push_token || null;
    }

    if (!pushToken) {
      console.warn('[PushService] ⚠️ No push token found for:', email);
      return { success: false, error: 'No push token found' };
    }

    // Send via Expo API

    const response = await fetch(EXPO_PUSH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: pushToken,
        title: title,
        body: body,
        sound: 'default',
        badge: 1,
        priority: 'high',
        channelId: appType === 'delivery' ? 'delivery-assignments' : 'order-updates',
        data: {
          ...data,
          type: data.type || 'push-notification',
          timestamp: new Date().toISOString(),
          appType: appType
        }
      })
    });

    const result = await response.json();

    if (result.status === 'ok' || result.status === 'sent') {
      return { success: true, data: result };
    } else {
      console.error('[PushService] ❌ Expo API error:', result);
      return { success: false, error: result };
    }

  } catch (error) {
    console.error('[PushService] ❌ Error:', error);
    return { success: false, error: error };
  }
}

/**
 * Send delivery assignment push notification
 */
export async function sendDeliveryAssignmentPushNotification({
  deliveryEmail,
  assignmentId,
  orderId,
  orderNumber,
  restaurantName
}: {
  deliveryEmail: string;
  assignmentId: string;
  orderId: string;
  orderNumber: string;
  restaurantName: string;
}) {
  return sendBackgroundPushNotification({
    email: deliveryEmail,
    title: '🚴 New Delivery Assigned!',
    body: `Order #${orderNumber} from ${restaurantName} - Ready for pickup`,
    data: {
      assignmentId,
      orderId,
      orderNumber,
      restaurantName,
      type: 'delivery-assignment'
    },
    appType: 'delivery'
  });
}

/**
 * Send order status update push notification
 */
export async function sendOrderStatusPushNotification({
  deliveryEmail,
  orderId,
  orderNumber,
  status
}: {
  deliveryEmail: string;
  orderId: string;
  orderNumber: string;
  status: string;
}) {
  return sendBackgroundPushNotification({
    email: deliveryEmail,
    title: `📦 Order ${status}`,
    body: `Order #${orderNumber} status: ${status}`,
    data: {
      orderId,
      orderNumber,
      status,
      type: 'order-status'
    },
    appType: 'delivery'
  });
}
