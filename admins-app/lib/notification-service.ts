// Notification Service for OneSignal
// Uses the native OneSignal SDK for push delivery and interaction.

import { Platform } from 'react-native';
import { router } from 'expo-router';
import { OneSignal } from 'react-native-onesignal';

const IS_WEB = Platform.OS === 'web';

export function setupNotificationHandlers() {
  if (IS_WEB) {
    return;
  }

  try {
    OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
      event.getNotification().display();
    });

    OneSignal.Notifications.addEventListener('click', (event: any) => {
      const data = event.notification.additionalData;
      if (data) {
        handleNotificationNavigation(data);
      }
    });
  } catch (error) {
    console.error('[NotificationService] ❌ Error setting up OneSignal event handlers:', error);
  }
}

function handleNotificationNavigation(data: any) {
  try {
    if (
      data.type === 'new-order' ||
      data.type === 'order-confirmed' ||
      data.type === 'order-preparing' ||
      data.type === 'order-ready' ||
      data.type === 'order-picked-up' ||
      data.type === 'order-on-the-way' ||
      data.type === 'order-delivered' ||
      data.type === 'order-update' ||          // ✅ Added to route order updates correctly
      data.type === 'delivery-assignment'      // ✅ Added to route driver assignments correctly
    ) {
      if (data.orderId) {
        router.push(`/admin/orders?orderId=${data.orderId}`);
        return;
      }
    }

    if (data.screen) {
      router.push(data.screen);
      return;
    }

    router.push('/admin/orders');
  } catch (error) {
    console.error('[NotificationService] ❌ Navigation error:', error);
  }
}


export function initializeNotificationService(appId: string) {
  if (IS_WEB) {
    return;
  }

  try {
    OneSignal.initialize(appId);
    setupNotificationHandlers();
  } catch (error) {
    console.error('[NotificationService] ❌ Failed to initialize OneSignal:', error);
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (IS_WEB) {
    return 'Notification' in window && Notification.permission === 'granted';
  }

  try {
    const granted = await OneSignal.Notifications.requestPermission(true);
    return !!granted;
  } catch (error) {
    console.error('[NotificationService] Permission request failed:', error);
    return false;
  }
}

export async function sendLocalNotification({
  title,
  body,
  data,
  sound,
  badge,
  type,
}: {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: boolean;
  badge?: number;
  type?: string;
}) {
  if (IS_WEB) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: data?.icon || '/favicon.ico',
      });
    }
    return;
  }

  console.log('[NotificationService] OneSignal handles remote notification delivery. ', {
    title,
    body,
    data,
    sound,
    badge,
    type,
  });
}

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
  });
}

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
  });
}

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
  });
}

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
  });
}

export async function setupNotificationChannels() {
  // OneSignal handles channel setup in the native SDK and dashboard.
  return;
}

export async function getExpoPushToken() {
  if (IS_WEB) {
    return null;
  }

  return null;
}

export async function cancelAllNotifications() {
  return;
}

export async function cancelNotification(notificationId: string) {
  return;
}
