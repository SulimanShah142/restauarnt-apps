/**
 * Expo Push Notification Server
 * 
 * Uses Expo Push API to send notifications to both iOS and Android
 * This is simpler than direct FCM/APNs and works uniformly across platforms
 * 
 * Install: pnpm add expo-server-sdk
 */

import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

// Initialize Expo
const expo = new Expo();

/**
 * Send a push notification to a single Expo push token
 * Works for both iOS and Android
 */
export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ success: boolean; ticket?: ExpoPushTicket; error?: string }> {
  try {
    // Validate the token
    if (!Expo.isExpoPushToken(expoPushToken)) {
      // console.error('[ExpoPush] Invalid push token:', expoPushToken);
      return { success: false, error: 'Invalid push token' };
    }

    // Create the message
    const message: ExpoPushMessage = {
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      data: data || {},
      // @ts-ignore - ios property exists in Expo Push API
      ios: {
        sound: 'default',
        badge: 1,
        priority: 'high',
      },
      android: {
        sound: 'default',
        priority: 'high',
        channelId: 'default',
      },
    };

    // Send the notification
    const tickets = await expo.sendPushNotificationsAsync([message]);
    
    
    if (tickets[0].status === 'error') {
      // console.error('[ExpoPush] Error:', tickets[0].message);
      return { success: false, error: tickets[0].message };
    }
    
    return { success: true, ticket: tickets[0] };
  } catch (error: any) {
    // console.error('[ExpoPush] ❌ Error sending notification:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send push notifications to multiple tokens
 * Automatically chunks into batches of 100 (Expo's limit)
 */
export async function sendBulkPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ success: number; failed: number; errors: any[] }> {
  try {
    // Filter out invalid tokens
    const validTokens = tokens.filter(token => Expo.isExpoPushToken(token));

    // Create messages
    const messages: ExpoPushMessage[] = validTokens.map(token => ({
      to: token,
      sound: 'default',
      title,
      body,
      data: data || {},
      ios: {
        sound: 'default',
        badge: 1,
        priority: 'high',
      },
      android: {
        sound: 'default',
        priority: 'high',
        channelId: 'default',
      },
    }));

    // Chunk into batches of 100
    const chunks = expo.chunkPushNotifications(messages);
    const tickets: ExpoPushTicket[] = [];
    let successCount = 0;
    let failedCount = 0;
    const errors: any[] = [];

    // Send each chunk
    for (const chunk of chunks) {
      try {
        const chunkTickets = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...chunkTickets);
        
        chunkTickets.forEach(ticket => {
          if (ticket.status === 'error') {
            failedCount++;
            errors.push(ticket.message);
          } else {
            successCount++;
          }
        });
      } catch (error: any) {
        // console.error('[ExpoPush] Error sending chunk:', error.message);
        failedCount += chunk.length;
        errors.push(error.message);
      }
    }

    
    return { success: successCount, failed: failedCount, errors };
  } catch (error: any) {
    // console.error('[ExpoPush] ❌ Bulk send error:', error.message);
    return { success: 0, failed: tokens.length, errors: [error.message] };
  }
}

/**
 * Send notification to a topic (users subscribed to a channel)
 * You'll need to manage topic subscriptions in your database
 */
export async function sendTopicNotification(
  topic: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    // This requires you to store topic subscriptions in your database
    // Example: profiles array column or separate subscription table
    
    // You would query your database here for all tokens subscribed to this topic
    // Then call sendBulkPushNotification
    
    return { 
      success: true,
      error: 'Topic notifications require database implementation'
    };
  } catch (error: any) {
    // console.error('[ExpoPush] ❌ Topic notification error:', error.message);
    return { success: false, error: error.message };
  }
}

// ============ PREDEFINED NOTIFICATION TEMPLATES ============

/**
 * Send order status update notification
 */
export async function sendOrderNotification(
  expoPushToken: string,
  orderId: string,
  orderNumber: string,
  status: string,
  message: string
) {
  const statusEmojis: Record<string, string> = {
    pending: '⏳',
    confirmed: '✅',
    preparing: '👨‍🍳',
    ready: '📦',
    picked_up: '🚴',
    on_the_way: '🚗',
    delivered: '🎉',
    cancelled: '❌',
    rejected: '🚫',
  };

  const emoji = statusEmojis[status] || '📱';

  return sendPushNotification(
    expoPushToken,
    `${emoji} Order ${status.replace('_', ' ').toUpperCase()}`,
    message,
    { 
      type: 'order-update',
      orderId, 
      orderNumber, 
      status 
    }
  );
}

/**
 * Send new order notification (for admin/delivery)
 */
export async function sendNewOrderNotification(
  expoPushToken: string,
  orderId: string,
  orderNumber: string,
  customerName: string,
  totalAmount: number,
  restaurantName: string
) {
  return sendPushNotification(
    expoPushToken,
    '🔔 New Order Received!',
    `${customerName} ordered AFG ${totalAmount} from ${restaurantName}`,
    {
      type: 'new-order',
      orderId,
      orderNumber,
      customerName,
      totalAmount,
      restaurantName,
    }
  );
}

/**
 * Send delivery assignment notification
 */
export async function sendDeliveryAssignmentNotification(
  expoPushToken: string,
  orderId: string,
  orderNumber: string,
  restaurantName: string
) {
  return sendPushNotification(
    expoPushToken,
    '🚴 New Delivery Assignment!',
    `Order #${orderNumber} from ${restaurantName}`,
    {
      type: 'delivery-assignment',
      orderId,
      orderNumber,
      restaurantName,
    }
  );
}

/**
 * Send order delivered notification
 */
export async function sendOrderDeliveredNotification(
  expoPushToken: string,
  orderId: string,
  orderNumber: string
) {
  return sendPushNotification(
    expoPushToken,
    '🎉 Order Delivered!',
    `Order #${orderNumber} has been delivered successfully`,
    {
      type: 'order-delivered',
      orderId,
      orderNumber,
    }
  );
}

// ============ TOKEN MANAGEMENT ============

/**
 * Check if a push token is valid
 */
export function isValidPushToken(token: string): boolean {
  return Expo.isExpoPushToken(token);
}

/**
 * Get list of invalid tokens from a batch
 */
export function filterInvalidTokens(tokens: string[]): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];

  tokens.forEach(token => {
    if (Expo.isExpoPushToken(token)) {
      valid.push(token);
    } else {
      invalid.push(token);
    }
  });

  return { valid, invalid };
}

// Export for use in Supabase Edge Functions or backend
export default {
  sendPushNotification,
  sendBulkPushNotification,
  sendTopicNotification,
  sendOrderNotification,
  sendNewOrderNotification,
  sendDeliveryAssignmentNotification,
  sendOrderDeliveredNotification,
  isValidPushToken,
  filterInvalidTokens,
};
