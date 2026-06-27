/**
 * Server-side Push Notification Service using Firebase Admin SDK
 *
 * This script is designed to run on a server (Supabase Edge Functions, Node.js backend, etc.)
 * It uses Firebase Admin SDK to send push notifications via FCM
 *
 * Usage:
 * 1. Install dependencies: npm install firebase-admin
 * 2. Set environment variable: FIREBASE_ADMIN_INIT=true
 * 3. Call the sendNotification function with user's expo push token
 */

import admin from 'firebase-admin';

// Initialize Firebase Admin
function initializeFirebase() {
  try {
    // Load service account from environment variable (secure method)
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (!serviceAccountJson) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set');
    }

    const serviceAccount = JSON.parse(serviceAccountJson);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    return true;
  } catch (error: any) {
    console.error('[FCM Server] ❌ Firebase Admin initialization failed:', error.message);
    return false;
  }
}

// Send push notification to a single Expo push token
export async function sendExpoPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!initializeFirebase()) {
      return { success: false, error: 'Firebase not initialized' };
    }

    // Expo push tokens are used directly with FCM
    const message: admin.messaging.Message = {
      token: expoPushToken,
      notification: {
        title,
        body,
      },
      data: data || {},
      android: {
        priority: 'high',
        notification: {
          priority: 'high',
          sound: 'default',
          channelId: 'default',
          icon: 'notification_icon',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            contentAvailable: true,
          },
        },
        headers: {
          'apns-priority': '10',
        },
      },
    };

    const response = await admin.messaging().send(message);

    return { success: true, messageId: response };
  } catch (error: any) {
    console.error('[FCM Server] ❌ Error sending push notification:', error.message);

    // Check for specific FCM errors
    if (error.code === 'messaging/invalid-registration-token') {
      // Handle invalid token
    }

    return { success: false, error: error.message };
  }
}

// Send push notification to multiple users
export async function sendBulkPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ success: number; failed: number; errors: any[] }> {
  if (!initializeFirebase()) {
    return { success: 0, failed: tokens.length, errors: ['Firebase not initialized'] };
  }

  const results = await Promise.all(
    tokens.map(token => sendExpoPushNotification(token, title, body, data))
  );

  const success = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const errors = results.filter(r => !r.success).map(r => r.error);


  return { success, failed, errors };
}

// Send notification to a topic (users subscribed to a topic)
export async function sendTopicNotification(
  topic: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!initializeFirebase()) {
      return { success: false, error: 'Firebase not initialized' };
    }

    const message: admin.messaging.Message = {
      topic,
      notification: {
        title,
        body,
      },
      data: data || {},
      android: {
        priority: 'high',
        notification: {
          priority: 'high',
          sound: 'default',
          channelId: 'default',
        },
      },
    };

    const response = await admin.messaging().send(message);
    
    return { success: true, messageId: response };
  } catch (error: any) {
    console.error('[FCM Server] ❌ Error sending topic notification:', error.message);
    return { success: false, error: error.message };
  }
}

// Subscribe users to a topic
export async function subscribeToTopic(
  tokens: string[],
  topic: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!initializeFirebase()) {
      return { success: false, error: 'Firebase not initialized' };
    }

    const response = await admin.messaging().subscribeToTopic(tokens, topic);
    
    return { success: true };
  } catch (error: any) {
    console.error('[FCM Server] ❌ Error subscribing to topic:', error.message);
    return { success: false, error: error.message };
  }
}

// Unsubscribe users from a topic
export async function unsubscribeFromTopic(
  tokens: string[],
  topic: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!initializeFirebase()) {
      return { success: false, error: 'Firebase not initialized' };
    }

    const response = await admin.messaging().unsubscribeFromTopic(tokens, topic);
    
    return { success: true };
  } catch (error: any) {
    console.error('[FCM Server] ❌ Error unsubscribing from topic:', error.message);
    return { success: false, error: error.message };
  }
}

// Example usage for order notifications
export async function sendOrderNotification(
  expoPushToken: string,
  orderId: string,
  orderNumber: string,
  status: string,
  message: string
) {
  return sendExpoPushNotification(expoPushToken, `Order ${status}`, message, {
    type: 'order-update',
    orderId,
    orderNumber,
    status,
  });
}

// Example usage for delivery assignment
export async function sendDeliveryAssignmentNotification(
  expoPushToken: string,
  orderId: string,
  orderNumber: string,
  restaurantName: string
) {
  return sendExpoPushNotification(
    expoPushToken,
    '🚴 New Delivery Assignment',
    `Order #${orderNumber} from ${restaurantName}`,
    {
      type: 'delivery-assignment',
      orderId,
      orderNumber,
    }
  );
}

// Export for use in Supabase Edge Functions or serverless functions
export default {
  sendExpoPushNotification,
  sendBulkPushNotification,
  sendTopicNotification,
  subscribeToTopic,
  unsubscribeFromTopic,
  sendOrderNotification,
  sendDeliveryAssignmentNotification,
  initializeFirebase,
};
