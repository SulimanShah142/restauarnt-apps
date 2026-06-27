// Global notification event emitter for in-app banners
// This allows components to trigger banner notifications without direct state access

type NotificationType = 'success' | 'error' | 'info' | 'warning' | 'assignment';

interface NotificationData {
  title: string;
  message: string;
  type: NotificationType;
}

type NotificationListener = (notification: NotificationData) => void;

const listeners = new Set<NotificationListener>();

export const showNotificationBanner = (notification: NotificationData) => {
  listeners.forEach(listener => listener(notification));
};

export const subscribeToNotifications = (listener: NotificationListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};