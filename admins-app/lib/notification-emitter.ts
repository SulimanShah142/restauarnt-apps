// Global notification event emitter for in-app banners
// CRITICAL: This MUST be a singleton module to work across components

type NotificationType = 'success' | 'error' | 'info' | 'warning' | 'order';

interface NotificationData {
  title: string;
  message: string;
  type: NotificationType;
}

type NotificationListener = (notification: NotificationData) => void;

// Module-level listeners set - persists across imports
const listeners = new Set<NotificationListener>();

// Debug: Log when module is loaded

export const showNotificationBanner = (notification: NotificationData) => {
  
  if (listeners.size === 0) {
    console.warn('[NotificationEmitter] ⚠️ WARNING: No listeners registered!');
    console.warn('[NotificationEmitter] ⚠️ Check if subscribeToNotifications was called');
  }
  
  listeners.forEach(listener => {
    try {
      listener(notification);
    } catch (error) {
      console.error('[NotificationEmitter] ❌ Listener error:', error);
    }
  });
};

export const subscribeToNotifications = (listener: NotificationListener) => {
  listeners.add(listener);
  
  // Return unsubscribe function
  return () => {
    listeners.delete(listener);
  };
};

// Export listener count for debugging
export const getListenerCount = () => listeners.size;
