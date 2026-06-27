// Badge Context for Admin App - Tracks new orders
// Uses OneSignal for notifications instead of Supabase Realtime
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as Notifications from 'expo-notifications';

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

  // Load initial badge count when session changes
  useEffect(() => {
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

    loadBadgeCount();

    // Setup OneSignal notification tap listener for badge updates
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      // Refresh badge when user taps an order notification
      if (data?.type === 'new_order' || data?.type === 'order_update' || data?.orderId || data?.order_id) {
        loadBadgeCount();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [sessionEmail]);

  const refreshBadge = async () => {
    if (!sessionEmail) {
      setNewOrdersCount(0);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'confirmed', 'preparing', 'ready', 'on_the_way']);

      if (error) {
        setNewOrdersCount(0);
        return;
      }

      const count = data?.length || 0;
      setNewOrdersCount(count);
    } catch (error) {
      console.error('[AdminBadge] Error refreshing badge:', error);
      setNewOrdersCount(0);
    }
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
};
