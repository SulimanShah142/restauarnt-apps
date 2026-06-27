import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface UseDeliveryLocationListenerProps {
  enabled: boolean;
  orderId?: string;
  deliveryPersonId?: string;
}

interface DeliveryLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
  deliveryPersonId: string;
}

interface UseDeliveryLocationListenerReturn {
  deliveryLocation: DeliveryLocation | null;
  isLoading: boolean;
  error: string | null;
  hasLocation: boolean;
  isReady: boolean;
}

/**
 * Listens to delivery person location broadcasts via Supabase Realtime
 * + Database polling every 45 seconds as fallback
 *
 * Matches admins-app/useDeliveryLocationListener implementation exactly.
 */
export function useDeliveryLocationListener({
  enabled,
  orderId,
  deliveryPersonId
}: UseDeliveryLocationListenerProps): UseDeliveryLocationListenerReturn {
  const [deliveryLocation, setDeliveryLocation] = useState<DeliveryLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const channelRef = useRef<any>(null);

  // Fetch latest location from database (fallback for broadcasts)
  const fetchLatestLocation = async () => {
    if (!deliveryPersonId) return;

    try {
      const { data, error: dbError } = await supabase
        .from('delivery_persons')
        .select('current_latitude, current_longitude, updated_at')
        .eq('id', deliveryPersonId)
        .maybeSingle() as { data: any; error: any };

      if (dbError) {
        console.error('[DeliveryListener] Error fetching location:', dbError.message);
        return;
      }

      if (data && data.current_latitude && data.current_longitude) {
        const location: DeliveryLocation = {
          latitude: data.current_latitude,
          longitude: data.current_longitude,
          timestamp: data.updated_at || new Date().toISOString(),
          deliveryPersonId
        };

        setDeliveryLocation(location);
      }
    } catch (err) {
      console.error('[DeliveryListener] Error fetching location from DB:', err);
    }
  };

  useEffect(() => {
    // Cleanup if not enabled or no order
    if (!enabled || !orderId) {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      setDeliveryLocation(null);
      setIsReady(false);
      return;
    }

    // Wait for deliveryPersonId to be ready
    if (!deliveryPersonId) {
      setIsReady(false);
      setDeliveryLocation(null);
      return;
    }

    let isMounted = true;
    setIsReady(true);

    // Subscribe to Realtime broadcasts (instant updates)
    const subscribeToLocation = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Create Realtime channel for this order
        const channelName = `order:${orderId}:location`;
        const channel = supabase.channel(channelName);

        // Listen for location updates from delivery app
        channel.on('broadcast', { event: 'location_update' }, (payload: any) => {
          if (payload.payload &&
              (!deliveryPersonId || payload.payload.delivery_person_id === deliveryPersonId)) {
            const location: DeliveryLocation = {
              latitude: payload.payload.latitude,
              longitude: payload.payload.longitude,
              accuracy: payload.payload.accuracy,
              timestamp: payload.payload.timestamp || new Date().toISOString(),
              deliveryPersonId: payload.payload.delivery_person_id || deliveryPersonId
            };

            if (isMounted) {
              console.log('[DeliveryListener] 📡 Realtime broadcast received:', location.latitude, location.longitude);
              setDeliveryLocation(location);
              setIsLoading(false);
            }
          }
        });

        // Subscribe to channel
        await channel.subscribe((status: string) => {
          if (status === 'SUBSCRIBED' && isMounted) {
            console.log('[DeliveryListener] ✅ Subscribed to location broadcasts');
            // Fetch latest location from database on initial subscribe
            fetchLatestLocation().then(() => setIsLoading(false));
          } else if (status === 'CHANNEL_ERROR' && isMounted) {
            console.error('[DeliveryListener] ❌ Channel subscription error');
            setError('Failed to connect to location updates');
            setIsLoading(false);
          }
        });

        channelRef.current = channel;
      } catch (err) {
        console.error('[DeliveryListener] Error subscribing:', err);
        if (isMounted) {
          setError('Failed to initialize location tracking');
          setIsLoading(false);
        }
      }
    };

    subscribeToLocation();

    // Database polling fallback every 45 seconds
    const pollInterval = setInterval(() => {
      fetchLatestLocation();
    }, 45000);

    // Cleanup
    return () => {
      isMounted = false;
      clearInterval(pollInterval);

      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [enabled, orderId, deliveryPersonId]);

  return {
    deliveryLocation,
    isLoading,
    error,
    hasLocation: !!deliveryLocation,
    isReady,
  };
}
