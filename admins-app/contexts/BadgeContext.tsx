// Badge Context for Admin App - Tracks new orders
// Uses OneSignal for notifications instead of Supabase Realtime
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { OneSignal } from 'react-native-onesignal'; // 📌 Swapped expo-notifications out for OneSignal

interface BadgeContextType {
  newOrdersCount: number;
  refreshBadge: () => Promise<void>;
}

const BadgeContext = createContext<BadgeContextType | undefined>(undefined);

export function BadgeProvider({ children }: { children: React.ReactNode }) {
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load session email from AsyncStorage directly to avoid circular dependency
  useEffect(() => {
    const loadSessionEmail = async () => {
      try {
        const AsyncStorage = await import('@react-native-async-storage/async-storage');
        const sessionJson = await AsyncStorage.default.getItem('admin_session');
        if (sessionJson) {
          const session = JSON.parse(sessionJson);
          // Check if session is expired
          const currentTime = Math.floor(Date.now() / 1000);
          if (session.expiresAt && currentTime < session.expiresAt) {
            setSessionEmail(session.user?.email || null);
          } else {
            setSessionEmail(null);
          }
        } else {
          setSessionEmail(null);
        }
      } catch (error) {
        console.error('[BadgeContext] Error loading session:', error);
        setSessionEmail(null);
      } finally {
        setIsInitialized(true);
      }
    };

    loadSessionEmail();
  }, []);

  // Helper logic to run count validation
  const loadBadgeCount = async () => {
    if (!sessionEmail) {
      setNewOrdersCount(0);
      return;
    }

    try {
      // Count pending/new orders (not delivered/cancelled)
      const { data, error } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'confirmed', 'preparing', 'ready', 'on_the_way']);

      if (error) {
        console.error('[AdminBadge] Error loading badge count:', error);
        setNewOrdersCount(0);
        return;
      }

      const count = data?.length || 0;
      setNewOrdersCount(count);
    } catch (error) {
      console.error('[AdminBadge] Error loading badge count:', error);
      setNewOrdersCount(0);
    }
  };

  // Load initial badge count when session changes and attach OneSignal listeners
  useEffect(() => {
    loadBadgeCount();

    // 📡 1. Refresh badge if notification arrives while the user is inside the app
    const handleForegroundNotification = (event: any) => {
      const data = event.notification.additionalData;
      console.log('[AdminBadge] Foreground notification received:', data);
      if (data?.type === 'new_order' || data?.type === 'order_update' || data?.orderId || data?.order_id) {
        loadBadgeCount();
      }
    };

    // 📡 2. Refresh badge when the user clicks an external banner notification
    const handleNotificationClick = (event: any) => {
      const data = event.notification.additionalData;
      console.log('[AdminBadge] Notification banner clicked:', data);
      if (data?.type === 'new_order' || data?.type === 'order_update' || data?.orderId || data?.order_id) {
        loadBadgeCount();
      }
    };

    // Attach listeners to OneSignal Notifications namespace
    OneSignal.Notifications.addEventListener('foregroundWillDisplay', handleForegroundNotification);
    OneSignal.Notifications.addEventListener('click', handleNotificationClick);

    return () => {
      // Cleanup observers cleanly
      OneSignal.Notifications.removeEventListener('foregroundWillDisplay', handleForegroundNotification);
      OneSignal.Notifications.removeEventListener('click', handleNotificationClick);
    };
  }, [sessionEmail]);

  const refreshBadge = async () => {
    await loadBadgeCount();
  };

  return (
    <BadgeContext.Provider value={{ newOrdersCount, refreshBadge }}>
      {children}
    </BadgeContext.Provider>
  );
}

export function useBadge() {
  const context = useContext(BadgeContext);
  if (context === undefined) {
    // Return default values instead of throwing to prevent crashes
    console.warn('[useBadge] Used outside BadgeProvider, returning default values');
    return { newOrdersCount: 0, refreshBadge: async () => {} };
  }
  return context;
}
