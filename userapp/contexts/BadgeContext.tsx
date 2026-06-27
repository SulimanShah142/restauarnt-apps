// Badge Context for User App - Tracks order status updates
// Uses OneSignal for notifications instead of Supabase Realtime
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';

interface BadgeContextType {
  orderUpdatesCount: number;
  refreshBadge: () => Promise<void>;
}

const BadgeContext = createContext<BadgeContextType | undefined>(undefined);

export function BadgeProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [orderUpdatesCount, setOrderUpdatesCount] = useState(0);

  console.log('[BadgeContext] Render - session:', !!session, 'isReady:', isReady, 'count:', orderUpdatesCount);

  // Load session on mount with error handling
  useEffect(() => {
    console.log('[BadgeContext] useEffect: Loading session...');
    const loadSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('[BadgeContext] Session error:', error);
        } else {
          console.log('[BadgeContext] Session loaded:', !!session);
        }
        setSession(session);
      } catch (err) {
        console.error('[BadgeContext] Error loading session:', err);
      } finally {
        setIsReady(true);
        console.log('[BadgeContext] Session load complete, isReady: true');
      }
    };
    loadSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, _session) => {
      console.log('[BadgeContext] onAuthStateChange:', event, 'session:', !!_session);
      setSession(_session);
    });

    return () => {
      console.log('[BadgeContext] Cleanup: Unsubscribing auth listener');
      subscription.unsubscribe();
    };
  }, []);

  // Load initial badge count when session changes
  useEffect(() => {
    // Wait for auth to be ready before loading badge count
    if (!isReady) {
      console.log('[BadgeContext] Not ready yet, skipping badge load');
      return;
    }

    const loadBadgeCount = async () => {
      try {
        if (!session?.user?.id) {
          console.log('[BadgeContext] No user session, setting count to 0');
          setOrderUpdatesCount(0);
          return;
        }

        console.log('[BadgeContext] Loading badge count for user:', session.user.id);

        // Count active orders (not delivered/cancelled)
        const { data, error } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', session.user.id)
          .in('status', ['pending', 'confirmed', 'preparing', 'ready', 'on_the_way']);

        if (error) {
          console.error('[BadgeContext] Error loading badge count:', error);
          setOrderUpdatesCount(0);
          return;
        }

        const count = data?.length || 0;
        console.log('[BadgeContext] Badge count loaded:', count);
        setOrderUpdatesCount(count);
      } catch (err) {
        console.error('[BadgeContext] Error:', err);
        setOrderUpdatesCount(0);
      }
    };

    loadBadgeCount();

    // Setup OneSignal notification tap listener for badge updates
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      console.log('[BadgeContext] Notification tapped:', data);
      // Refresh badge when user taps an order notification
      if ((data?.type as string)?.startsWith('order_') || data?.orderId || data?.order_id) {
        console.log('[BadgeContext] Order notification tapped, refreshing badge');
        loadBadgeCount();
      }
    });

    return () => {
      console.log('[BadgeContext] Cleanup: Removing notification listener');
      subscription.remove();
    };
  }, [session?.user?.id, isReady]);

  const refreshBadge = async () => {
    console.log('[BadgeContext] refreshBadge called');
    if (!session?.user?.id) {
      console.log('[BadgeContext] No user session, setting count to 0');
      setOrderUpdatesCount(0);
      return;
    }

    const { data, error } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready', 'on_the_way']);

    if (error) {
      console.error('[BadgeContext] refreshBadge error:', error);
      setOrderUpdatesCount(0);
      return;
    }

    const count = data?.length || 0;
    console.log('[BadgeContext] refreshBadge count:', count);
    setOrderUpdatesCount(count);
  };

  return (
    <BadgeContext.Provider value={{ orderUpdatesCount, refreshBadge }}>
      {children}
    </BadgeContext.Provider>
  );
}

export function useBadge() {
  const context = useContext(BadgeContext);
  if (context === undefined) {
    // Return safe defaults instead of throwing to prevent crashes
    console.warn('[useBadge] Used outside BadgeProvider, returning safe defaults');
    return {
      orderUpdatesCount: 0,
      refreshBadge: async () => {},
    };
  }
  console.log('[useBadge] Returning badge context');
  return context;
};
