// Global Notification Context for Deliver App
// Provides universal notification state across the entire app

import React, { createContext, useContext, useState, ReactNode } from 'react';
import * as Notifications from 'expo-notifications';

export type NotificationType = 'assignment' | 'order' | 'success' | 'error' | 'info';

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

// Configure notification handler
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

  const addNotification = async (
    title: string,
    message: string,
    type: NotificationType = 'info',
    data?: any
  ) => {
    const id = Date.now().toString();
    const timestamp = Date.now();

    const newNotification: AppNotification = {
      id,
      title,
      message,
      type,
      data,
      timestamp,
    };

    setNotifications(prev => [newNotification, ...prev].slice(0, 10));

    // Send SYSTEM notification (appears on home screen)
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
        },
        trigger: null,
      });
    } catch (error) {
      console.error('[DeliverNotification] ❌ Error:', error);
    }

    setTimeout(() => {
      removeNotification(id);
    }, 5000);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification, clearNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useGlobalNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useGlobalNotification must be used within a NotificationProvider');
  }
  return context;
}
