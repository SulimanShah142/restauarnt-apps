// Badge Context for Delivery App - Tracks new delivery assignments
// Uses OneSignal for notifications instead of Supabase Realtime
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { getStoredDeliverySession } from '@/lib/delivery-auth';
import * as Notifications from 'expo-notifications';

interface BadgeContextType {
  newDeliveriesCount: number;
  refreshBadge: () => Promise<void>;
}

const BadgeContext = createContext<BadgeContextType | undefined>(undefined);

export function BadgeProvider({ children }: { children: ReactNode }) {
  const [newDeliveriesCount, setNewDeliveriesCount] = useState(0);

  // Load initial badge count on mount and when session changes
  useEffect(() => {
    const loadBadgeCount = async () => {
      const session = await getStoredDeliverySession();
      
      if (!session?.delivery_person_id) {
        setNewDeliveriesCount(0);
        return;
      }

      // Count pending/active delivery assignments
      const { data, error } = await supabase
        .from('delivery_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('delivery_person_id', session.delivery_person_id)
        .in('status', ['pending', 'assigned', 'picked_up']);

      if (error) {
        console.error('[DeliveryBadge] Error loading badge count:', error);
        setNewDeliveriesCount(0);
        return;
      }

      const count = data?.length || 0;
      setNewDeliveriesCount(count);
    };

    loadBadgeCount();

    // Setup OneSignal notification tap listener for badge updates
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      // Refresh badge when user taps a delivery notification
      if (data?.type === 'new_assignment' || data?.orderId || data?.order_id) {
        loadBadgeCount();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const refreshBadge = async () => {
    const session = await getStoredDeliverySession();
    
    if (!session?.delivery_person_id) {
      setNewDeliveriesCount(0);
      return;
    }

    const { data, error } = await supabase
      .from('delivery_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('delivery_person_id', session.delivery_person_id)
      .in('status', ['pending', 'assigned', 'picked_up']);

    if (error) {
      setNewDeliveriesCount(0);
      return;
    }

    const count = data?.length || 0;
    setNewDeliveriesCount(count);
  };

  return (
    <BadgeContext.Provider value={{ newDeliveriesCount, refreshBadge }}>
      {children}
    </BadgeContext.Provider>
  );
}

export const useBadge = () => {
  const context = useContext(BadgeContext);
  if (context === undefined) {
    throw new Error('useBadge must be used within a BadgeProvider');
  }
  return context;
};
