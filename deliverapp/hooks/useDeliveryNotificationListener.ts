// Delivery Notification Hook - OneSignal Only
// No Supabase Realtime listeners - uses OneSignal for all notifications

import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';

export function useDeliveryNotificationListener(deliveryPersonId: string | null) {
  const [notification, setNotification] = useState<{
    title: string;
    message: string;
    visible: boolean;
  }>({ title: '', message: '', visible: false });

  useEffect(() => {
    if (!deliveryPersonId) {
      return;
    }

    // Setup OneSignal notification tap listener
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;

      // Handle delivery notification taps
      if (data?.type === 'delivery-assignment' || data?.type === 'delivery-completed') {
        // Show in-app banner when user taps notification
        setNotification({
          title: (data.title as string) || 'Delivery Update',
          message: (data.body as string) || '',
          visible: true
        });

        // Auto-hide after 5 seconds
        setTimeout(() => {
          setNotification(prev => ({ ...prev, visible: false }));
        }, 5000);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [deliveryPersonId]);

  return {
    notification,
    setNotification,
    isListening: true
  };
}
