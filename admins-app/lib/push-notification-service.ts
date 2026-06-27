// Push Notification Service for Background Notifications
// Uses Expo Push API to send notifications even when app is closed
// This is DIFFERENT from sendLocalNotification which only works when app is open

import { supabase } from '@/lib/supabase';

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

/**
 * Send BACKGROUND push notification via Expo Push API
 * This works even when app is CLOSED!
 * 
 * @param email - User's email (admin or delivery)
 * @param title - Notification title
 * @param body - Notification body text
 * @param data - Additional data to pass to the app
 * @param appType - 'admin' | 'user' | 'delivery'
 */
export async function sendBackgroundPushNotification({
  email,
  title,
  body,
  data = {},
  appType = 'admin'
}: {
  email: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  appType?: 'admin' | 'user' | 'delivery';
}) {

  try {
    // Step 1: Get recipient's Expo push token from database
    let pushToken: string | null = null;

    if (appType === 'delivery') {
      // Get from delivery_persons table
      const { data: deliveryData } = await supabase
        .from('delivery_persons')
        .select('expo_push_token')
        .eq('email', email)
        .not('expo_push_token', 'is', null)
        .single();

      pushToken = deliveryData?.expo_push_token || null;
    }

    if (appType === 'admin' || appType === 'user') {
      // Get from profiles table (admin/user)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('expo_push_token')
        .eq('email', email)
        .not('expo_push_token', 'is', null)
        .single();

      pushToken = profileData?.expo_push_token || null;
    }

    if (!pushToken) {
      console.warn('[PushService] ⚠️ No push token found for email:', email);
      console.warn('[PushService] 💡 User needs to open the app to register token');
      return { success: false, error: 'No push token found' };
    }

    // Step 2: Send push notification via Expo API

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
        priority: 'high',  // CRITICAL for background delivery
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
    console.error('[PushService] ❌ Error sending push notification:', error);
    console.error('[PushService] Error details:', JSON.stringify(error, null, 2));
    return { success: false, error: error };
  }
}

/**
 * Send push notification for NEW ORDER (Admin)
 */
export async function sendNewOrderPushNotification({
  adminEmail,
  orderId,
  orderNumber,
  customerName,
  totalAmount
}: {
  adminEmail: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  totalAmount: number;
}) {
  return sendBackgroundPushNotification({
    email: adminEmail,
    title: '🔔 New Order Received!',
    body: `${customerName} ordered AFG ${totalAmount} (Order #${orderNumber})`,
    data: {
      orderId,
      orderNumber,
      customerName,
      totalAmount,
      type: 'new-order'
    },
    appType: 'admin'
  });
}

/**
 * Send push notification for DELIVERY ASSIGNMENT (Delivery)
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
 * Send push notification for ORDER STATUS UPDATE (User)
 */
export async function sendOrderStatusPushNotification({
  userEmail,
  orderId,
  orderNumber,
  status,
  restaurantName
}: {
  userEmail: string;
  orderId: string;
  orderNumber: string;
  status: string;
  restaurantName: string;
}) {
  const statusMessages: Record<string, { title: string; body: string }> = {
    confirmed: {
      title: '✅ Order Confirmed!',
      body: `Your order from ${restaurantName} has been confirmed`
    },
    preparing: {
      title: '👨‍🍳 Order Preparing!',
      body: `Your order is being prepared at ${restaurantName}`
    },
    ready: {
      title: '📦 Order Ready!',
      body: 'Your order is ready for pickup'
    },
    on_the_way: {
      title: '🚗 Order On The Way!',
      body: 'Your order is on the way to your location'
    },
    delivered: {
      title: '🎉 Order Delivered!',
      body: 'Your order has been delivered. Enjoy your meal!'
    }
  };

  const message = statusMessages[status] || {
    title: 'Order Update',
    body: `Your order status has been updated to ${status}`
  };

  return sendBackgroundPushNotification({
    email: userEmail,
    title: message.title,
    body: message.body,
    data: {
      orderId,
      orderNumber,
      status,
      type: 'order-status'
    },
    appType: 'user'
  });
}

/**
 * Send push notification for ORDER DELIVERED (Admin)
 */
export async function sendOrderDeliveredPushNotification({
  adminEmail,
  orderId,
  orderNumber
}: {
  adminEmail: string;
  orderId: string;
  orderNumber: string;
}) {
  return sendBackgroundPushNotification({
    email: adminEmail,
    title: '✅ Order Delivered',
    body: `Order #${orderNumber} has been delivered successfully`,
    data: {
      orderId,
      orderNumber,
      type: 'order-delivered'
    },
    appType: 'admin'
  });
}

/**
 * Batch send push notifications to multiple recipients
 */
export async function sendBatchPushNotifications({
  recipients,
  title,
  body,
  data = {},
  appType = 'admin'
}: {
  recipients: string[];  // Array of emails
  title: string;
  body: string;
  data?: Record<string, any>;
  appType?: 'admin' | 'user' | 'delivery';
}) {

  const results = await Promise.all(
    recipients.map(email =>
      sendBackgroundPushNotification({
        email,
        title,
        body,
        data,
        appType
      })
    )
  );

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;


  return {
    total: recipients.length,
    success: successCount,
    failed: failCount,
    results
  };
}
