// Firebase Admin SDK Configuration for Push Notifications
// This file initializes Firebase Admin for sending push notifications
// NOTE: This is for server-side use only - React Native apps should use client SDK

let admin: any = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  admin = require('firebase-admin');
} catch (e) {
  console.warn('[FirebaseAdmin] Firebase Admin SDK not available - server features disabled');
}

let firebaseApp: any = null;

export function initializeFirebaseAdmin() {
  if (!admin) {
    throw new Error('Firebase Admin SDK not installed');
  }
  
  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    // Load service account from environment variable (secure method)
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!serviceAccountJson) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set');
    }

    const serviceAccount = JSON.parse(serviceAccountJson);

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    return firebaseApp;
  } catch (error: any) {
    // console.error('[FirebaseAdmin] ❌ Error initializing Firebase Admin:', error.message);
    throw error;
  }
}

export function getFirebaseApp() {
  if (!firebaseApp) {
    return initializeFirebaseAdmin();
  }
  return firebaseApp;
}

export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, any>
) {
  try {
    const app = getFirebaseApp();
    
    // FCM message for Expo push tokens
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
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            contentAvailable: true,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    return { success: true, messageId: response };
  } catch (error: any) {
    // console.error('[FirebaseAdmin] ❌ Error sending push notification:', error.message);
    return { success: false, error: error.message };
  }
}

export async function sendPushNotificationToTopic(
  topic: string,
  title: string,
  body: string,
  data?: Record<string, any>
) {
  try {
    const app = getFirebaseApp();
    
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
    // console.error('[FirebaseAdmin] ❌ Error sending topic notification:', error.message);
    return { success: false, error: error.message };
  }
}

// Initialize Firebase Admin when module loads (for server-side usage)
if (process.env.NODE_ENV === 'production' || process.env.FIREBASE_ADMIN_INIT) {
  try {
    initializeFirebaseAdmin();
  } catch (error) {
    // Silently fail in client-side environments
  }
}
