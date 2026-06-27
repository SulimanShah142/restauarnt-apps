// Notification Service for Expo/React Native
// Handles local notifications with sound effects

import { Platform } from 'react-native';
import { router } from 'expo-router';

// Flag to detect web platform
const IS_WEB = Platform.OS === 'web';

// Load expo-notifications
let Notifications: any = null;

// Store notification listener reference
let notificationListener: any = null;
let responseListener: any = null;

if (!IS_WEB) {
  try {
    Notifications = require('expo-notifications');

    // Configure notification handler for when app is in foreground
    Notifications.setNotificationHandler({
      handleNotification: async (notification: any) => {
        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        };
      },
    });

    // Setup notification response handler (when user taps notification)
    setupNotificationResponseHandler();
  } catch (error) {
    console.error('[DeliverNotificationService] ❌ Error loading expo-notifications:', error);
    Notifications = null;
  }
}

// Setup notification response handler - handles navigation when user taps notification
function setupNotificationResponseHandler() {
  if (!Notifications) return;

  try {
    // Remove existing listeners if any
    if (notificationListener) {
      Notifications.removeNotificationSubscription(notificationListener);
    }
    if (responseListener) {
      Notifications.removeNotificationSubscription(responseListener);
    }

    // Handle notification received while app is in foreground
    notificationListener = Notifications.addNotificationReceivedListener((notification: any) => {
      playNotificationSound('order').catch(() => {});
    });

    // Handle notification tapped by user - THIS IS THE KEY PART FOR NAVIGATION
    responseListener = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response.notification.request.content.data;


      // Handle navigation based on notification data
      if (data) {
        handleNotificationNavigation(data);
      }
    });
  } catch (error) {
    console.error('[DeliverNotificationService] ❌ Error setting up response handler:', error);
  }
}

// Handle navigation based on notification data
function handleNotificationNavigation(data: any) {
  
  try {
    // ONLY new delivery assignments - navigate to orders page
    if (data.type === 'delivery-assignment' || data.type === 'new_delivery' || data.type === 'delivery_assigned') {
      if (data.orderId) {
        router.push(`/(tabs)/orders?orderId=${data.orderId}`);
      } else if (data.assignmentId) {
        router.push(`/(tabs)/orders?assignmentId=${data.assignmentId}`);
      }
    }
    // Custom navigation based on screen
    else if (data.screen) {
      router.push(data.screen);
    }
    else {
      // Default to orders list
      router.push('/(tabs)/orders');
    }
  } catch (error) {
    console.error('[DeliverNotificationService] ❌ Navigation error:', error);
  }
}

// Sound effect player
let notificationSound: any = null;
let audioInitialized = false;

// Initialize notification sounds (skip in Expo Go)
export async function initializeNotificationSounds() {
  // CRITICAL: Skip completely in Expo Go and Web
  if (IS_WEB) {
    return;
  }

  // Already initialized
  if (audioInitialized) {
    return;
  }

  try {
    // Wrap import in try-catch to prevent Metro from bundling issues
    const AudioModule = await import('expo-audio').catch(() => null);

    if (!AudioModule) {
      return;
    }

    audioInitialized = true;
  } catch (error: any) {
    // Silently ignore all audio errors
  }
}

// Play notification sound effect (skip in Expo Go)
export async function playNotificationSound(type: 'order' | 'message' | 'alert' | 'success' = 'order') {
  // CRITICAL: Skip completely in Expo Go - don't even try to import expo-audio
  if (IS_WEB) {
    return;
  }

  try {
    const AudioModule = await import('expo-audio').catch(() => null);

    if (!AudioModule) {
      return;
    }

    // Stop any currently playing sound
    if (notificationSound) {
      await notificationSound.unloadAsync();
      notificationSound = null;
    }

    // Professional sound effects for production
    const soundFiles = {
      order: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3', // Professional alert
      message: 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3', // Soft chime
      alert: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3', // Professional alert
      success: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3', // Positive chime
    };

    const soundUri = soundFiles[type];
    const Audio = AudioModule as any;
    const { sound } = await Audio.Sound.createAsync(
      { uri: soundUri },
      { volume: 1.0, shouldPlay: true }
    );

    notificationSound = sound;
    await sound.playAsync();

    sound.setOnPlaybackStatusUpdate((status: any) => {
      if (status.isLoaded && status.didJustFinish) {
        notificationSound?.unloadAsync();
        notificationSound = null;
      }
    });
  } catch (error) {
    // Silently ignore sound errors
  }
}

// Request notification permissions (skip in Expo Go)
export async function requestNotificationPermission(): Promise<boolean> {
  if (IS_WEB) {
    return typeof window !== 'undefined' && 'Notification' in (window as any) && (window as any).Notification.permission === 'granted';
  }

  if ( !Notifications) {
    return false; // Skip silently in Expo Go
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (error) {
    return false;
  }
}

// Send local notification (appears in system notification center when swiping down)
export async function sendLocalNotification({
  title,
  body,
  data,
  sound = true,
  badge = 1,
  type = 'info',
  channelId,
}: {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: boolean;
  badge?: number;
  type?: 'order' | 'success' | 'error' | 'info' | 'warning' | 'assignment';
  channelId?: string;
}) {

  // Web fallback
  if (IS_WEB) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: data?.icon || '/favicon.ico' });
    }
    if (sound) {
      await playNotificationSound(type === 'order' ? 'order' : 'success');
    }
    return;
  }

  // Check if Notifications available
  if (!Notifications) {
    return;
  }

  try {

    // Determine channel based on type
    let notificationChannelId = channelId;
    if (!notificationChannelId) {
      switch (type) {
        case 'order':
          notificationChannelId = 'order-updates';
          break;
        case 'assignment':
          notificationChannelId = 'delivery-assignments';
          break;
        default:
          notificationChannelId = 'general';
      }
    }

    // Play custom sound effect FIRST (for immediate audio feedback)
    if (sound) {
      await playNotificationSound(type === 'order' ? 'order' : 'success').catch((err) => {
        console.error('[DeliverNotificationService] Sound play error:', err);
      });
    }

    // Get current badge count and increment
    const currentBadge = await Notifications.getBadgeCountAsync();
    const newBadgeCount = currentBadge + (badge > 0 ? badge : 1);

    // Send system notification (appears in notification center when user swipes down)
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: sound ? 'default' : undefined,
        priority: Notifications.AndroidNotificationPriority?.MAX || 3,
        vibrate: [0, 250, 250, 250],
        badge: newBadgeCount,
        sticky: true,
        autoDismiss: false,
        android: {
          channelId: notificationChannelId,
          sound: sound ? 'default' : undefined,
          priority: Notifications.AndroidNotificationPriority?.MAX || 3,
          vibrate: [0, 250, 250, 250],
          color: '#C41E26',
          visibility: Notifications.AndroidNotificationVisibility?.PUBLIC || 1,
          bypassDnd: true,
          showBadge: true,
          smallIcon: 'res/notification_icon',
        },
        ios: {
          sound: sound ? 'default' : undefined,
          badge: newBadgeCount,
          priority: 1,
          categoryIdentifier: type,
          interruptionLevel: 'active',
        },
      },
      trigger: null,
    });
  } catch (error) {
    console.error('[DeliverNotificationService] ❌ Error sending notification:', error);
    console.error('[DeliverNotificationService] Error details:', JSON.stringify(error, null, 2));
  }
}

// Send order-specific notification
export async function sendOrderNotification({
  orderId,
  orderNumber,
  status,
  message,
}: {
  orderId: string;
  orderNumber: string;
  status: string;
  message: string;
}) {
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

  await sendLocalNotification({
    title: `${emoji} Order ${status.replace('_', ' ').toUpperCase()}`,
    body: `${message} (Order #${orderNumber.substring(0, 8)})`,
    data: { orderId, orderNumber, status, type: 'order-update' },
    sound: true,
    badge: 1,
    type: 'order',
  });
}

// Send new order notification (for admin)
export async function sendNewOrderNotification({
  orderId,
  orderNumber,
  customerName,
  totalAmount,
  restaurantName,
}: {
  orderId: string;
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  restaurantName: string;
}) {
  await sendLocalNotification({
    title: '🔔 New Order Received!',
    body: `${customerName} ordered AFG ${totalAmount} from ${restaurantName}`,
    data: { orderId, orderNumber, type: 'new-order' },
    sound: true,
    badge: 1,
    type: 'order',
  });
}

// Send delivery assignment notification (for delivery personnel)
export async function sendDeliveryAssignmentNotification({
  orderId,
  orderNumber,
  restaurantName,
  deliveryPersonName,
}: {
  orderId: string;
  orderNumber: string;
  restaurantName: string;
  deliveryPersonName: string;
}) {
  await sendLocalNotification({
    title: '🚴 New Delivery Assignment!',
    body: `Order #${orderNumber.substring(0, 8)} from ${restaurantName}`,
    data: { orderId, orderNumber, type: 'delivery-assignment' },
    sound: true,
    badge: 1,
    type: 'assignment',
  });
}

// Send order delivered notification (for admin and user)
export async function sendOrderDeliveredNotification({
  orderId,
  orderNumber,
  recipientType,
}: {
  orderId: string;
  orderNumber: string;
  recipientType: 'admin' | 'user';
}) {
  await sendLocalNotification({
    title: '🎉 Order Delivered!',
    body: `Order #${orderNumber.substring(0, 8)} has been delivered successfully`,
    data: { orderId, orderNumber, type: 'order-delivered' },
    sound: true,
    badge: recipientType === 'admin' ? 1 : 0,
    type: 'success',
  });
}

// Setup notification channels (Android only, skip in Expo Go)
export async function setupNotificationChannels() {
  if (IS_WEB || !Notifications || Platform.OS !== 'android') {
    return;
  }

  try {
    // Order Updates Channel - HIGH priority with sound
    await Notifications.setNotificationChannelAsync('order-updates', {
      name: 'Order Updates',
      importance: Notifications.AndroidImportance?.MAX || 3,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      enableLights: true,
      lightColor: '#C41E26',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility?.PUBLIC || 1,
      bypassDnd: true,
      showBadge: true,
      description: 'Notifications about your order status and delivery',
    });

    // General Notifications Channel
    await Notifications.setNotificationChannelAsync('general', {
      name: 'General Notifications',
      importance: Notifications.AndroidImportance?.HIGH || 2,
      vibrationPattern: [0, 100, 100, 100],
      sound: 'default',
      enableLights: true,
      lightColor: '#4CAF50',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility?.PUBLIC || 1,
      showBadge: true,
      description: 'General app notifications and updates',
    });

    // Delivery Assignments Channel - For delivery personnel
    await Notifications.setNotificationChannelAsync('delivery-assignments', {
      name: 'Delivery Assignments',
      importance: Notifications.AndroidImportance?.MAX || 3,
      vibrationPattern: [0, 300, 300, 300],
      sound: 'default',
      enableLights: true,
      lightColor: '#FF9800',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility?.PUBLIC || 1,
      bypassDnd: true,
      showBadge: true,
      description: 'New delivery assignments and updates',
    });
  } catch (error) {
    console.error('[NotificationService] Error setting up channels:', error);
  }
}

// Initialize notification service (minimal in Expo Go)
export async function initializeNotificationService() {
  try {
    if (  IS_WEB) {
      // Return immediately in Expo Go - no initialization needed
      return false;
    }

    // Setup channels (Android only) - CRITICAL for system notifications
    await setupNotificationChannels().catch(() => {});

    // Request permission (non-blocking)
    const hasPermission = await requestNotificationPermission().catch(() => false);

    // Initialize audio (non-blocking, already checks internally)
    await initializeNotificationSounds().catch(() => {});

    // Setup listeners
    if (Notifications) {
      try {
        // Notification tapped listener - Handle navigation
        Notifications.addNotificationResponseReceivedListener((response: any) => {
          const data = response.notification.request.content.data;
          
          // Handle navigation based on notification data
          if (data) {
            handleNotificationNavigation(data);
          }
        });

        // Notification received listener - Play sound
        Notifications.addNotificationReceivedListener((notification: any) => {
          playNotificationSound('order').catch(() => {});
        });
      } catch (error) {
        // Silently ignore listener errors
      }
    }

    return hasPermission;
  } catch (error) {
    // Return false on any error, don't block app loading
    return false;
  }
}

// Get Expo push token (skip in Expo Go)
export async function getExpoPushToken() {
  if (  !Notifications) {
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: 'your-expo-project-id',
    });
    return token;
  } catch (error) {
    return null;
  }
}

// Cancel all notifications (skip in Expo Go)
export async function cancelAllNotifications() {
  if (!Notifications) {
    return;
  }

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.setBadgeCountAsync(0);
  } catch (error) {
    // Silently ignore
  }
}

// Cancel specific notification (skip in Expo Go)
export async function cancelNotification(notificationId: string) {
  if ( !Notifications) {
    return;
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    // Silently ignore
  }
};
