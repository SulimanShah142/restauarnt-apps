// Global Notification Context
// Provides universal notification state across the entire app
// Works on ALL pages, even when app is in background

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Notification types
export type NotificationType = 'order' | 'assignment' | 'feedback' | 'success' | 'error' | 'info' | 'warning';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  data?: any;
  timestamp: number;
}

interface NotificationContextType {
  notifications: AppNotification[];
  addNotification: (title: string, message: string, type?: NotificationType, data?: any) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Configure notification handler for when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Add a notification (both in-app and system)
  const addNotification = async (
    title: string,
    message: string,
    type: NotificationType = 'info',
    data?: any
  ) => {
    const id = Date.now().toString();
    const timestamp = Date.now();

    // Add to in-app notifications
    const newNotification: AppNotification = {
      id,
      title,
      message,
      type,
      data,
      timestamp,
    };

    setNotifications(prev => [newNotification, ...prev].slice(0, 10)); // Keep last 10

    // Send SYSTEM notification (appears on home screen, lock screen, etc.)
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: message,
          data: { id, type, ...data },
          sound: true,
          priority: Notifications.AndroidNotificationPriority?.MAX || 3,
          vibrate: [0, 250, 250, 250],
          badge: 1,
          sticky: true,
          autoDismiss: false,
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      console.error('[GlobalNotification] ❌ Error sending system notification:', error);
    }

    // Auto-remove from in-app after 5 seconds (system notification stays until dismissed)
    setTimeout(() => {
      removeNotification(id);
    }, 5000);
  };

  // Remove a specific notification
  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Clear all notifications
  const clearNotifications = () => {
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification, clearNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}

// Custom hook to use notifications
export function useGlobalNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useGlobalNotification must be used within a NotificationProvider');
  }
  return context;
}

// Helper functions for common notifications
export const showOrderNotification = (
  addNotification: (title: string, message: string, type?: NotificationType, data?: any) => void,
  type: 'new' | 'confirmed' | 'delivered' | 'assigned',
  orderData: any
) => {
  switch (type) {
    case 'new':
      addNotification(
        '🔔 New Order Received!',
        `Order #${orderData.order_number?.substring(0, 8)} - AFG ${orderData.total_amount}`,
        'order',
        { orderId: orderData.id, orderNumber: orderData.order_number }
      );
      break;
    case 'confirmed':
      addNotification(
        '✅ Order Confirmed!',
        `Order #${orderData.order_number?.substring(0, 8)} has been confirmed`,
        'success',
        { orderId: orderData.id }
      );
      break;
    case 'delivered':
      addNotification(
        '🎉 Order Delivered!',
        `Order #${orderData.order_number?.substring(0, 8)} has been delivered`,
        'success',
        { orderId: orderData.id }
      );
      break;
    case 'assigned':
      addNotification(
        '🚴 Delivery Assigned!',
        `Order #${orderData.order_number?.substring(0, 8)} assigned to delivery`,
        'assignment',
        { orderId: orderData.id, deliveryPersonId: orderData.delivery_person_id }
      );
      break;
  }
};

export const showFeedbackNotification = (
  addNotification: (title: string, message: string, type?: NotificationType, data?: any) => void,
  feedbackData: any
) => {
  addNotification(
    '💬 New Feedback Received!',
    `${feedbackData.user_name || 'User'} rated ${feedbackData.rating}/5 stars`,
    'info',
    { feedbackId: feedbackData.id, rating: feedbackData.rating }
  );
};
