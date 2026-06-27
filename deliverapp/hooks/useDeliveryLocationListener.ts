import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface UseDeliveryLocationListenerProps {
  enabled: boolean;
  orderId?: string;
  deliveryPersonId?: string;
}

interface UseAllDeliveryLocationsListenerProps {
  enabled: boolean;
}

interface DeliveryLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
  deliveryPersonId: string;
}

interface DeliveryPersonWithLocation {
  id: string;
  name: string;
  email?: string;
  latitude: number;
  longitude: number;
  is_available: boolean;
  image_url?: string;
  picture_url?: string;
  updated_at?: string;
  hasLocation?: boolean;
  formattedLocation?: string;
}

/**
 * Listens to ALL delivery person locations
 * Simple database polling every 45 seconds
 */
export function useAllDeliveryLocationsListener({ enabled }: UseAllDeliveryLocationsListenerProps) {
  const [deliveryPersons, setDeliveryPersons] = useState<DeliveryPersonWithLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDeliveryPersons = async () => {
    try {

      const { data, error } = await supabase
        .from('delivery_persons')
        .select('id, name, email, is_available, current_latitude, current_longitude, image_url, picture_url, updated_at')
        .order('is_available', { ascending: false });

      if (error) {
        console.error('[AllDeliveryListener] ❌ Error:', error.message);
        setError(error.message);
        return;
      }


      // Transform ALL delivery persons
      const personsWithLocation: DeliveryPersonWithLocation[] = (data || []).map((dp: any) => ({
        id: dp.id,
        name: dp.name || 'Unknown Driver',
        email: dp.email,
        latitude: dp.current_latitude || 34.5281,
        longitude: dp.current_longitude || 69.1761,
        is_available: dp.is_available,
        image_url: dp.image_url || dp.picture_url,
        updated_at: dp.updated_at,
        hasLocation: dp.current_latitude !== null && dp.current_latitude !== undefined
      }));

      if (personsWithLocation.length > 0) {
      }

      setDeliveryPersons(personsWithLocation);
    } catch (err) {
      console.error('[AllDeliveryListener] Error:', err);
      setError('Failed to load delivery persons');
    }
  };

  useEffect(() => {
    if (!enabled) {
      setDeliveryPersons([]);
      return;
    }

    // Initial fetch
    setIsLoading(true);
    fetchDeliveryPersons().then(() => setIsLoading(false));

    // Refresh every 45 seconds
    const interval = setInterval(() => {
      fetchDeliveryPersons();
    }, 45000);

    return () => clearInterval(interval);
  }, [enabled]);

  return {
    deliveryPersons,
    isLoading,
    error,
    hasLocations: deliveryPersons.length > 0
  };
}

/**
 * Listens to delivery person location broadcasts via Supabase Realtime
 * Only listens when:
 * - enabled is true
 * - orderId exists (active order being tracked)
 */
export function useDeliveryLocationListener({
  enabled,
  orderId,
  deliveryPersonId
}: UseDeliveryLocationListenerProps) {
  const [deliveryLocation, setDeliveryLocation] = useState<DeliveryLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled || !orderId) {
      // Cleanup if not enabled or no order
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      setDeliveryLocation(null);
      return;
    }

    let isMounted = true;

    const subscribeToLocation = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Create Realtime channel for this order
        const channelName = `order:${orderId}:location`;
        const channel = supabase.channel(channelName);

        // Listen for location updates
        channel.on('broadcast', { event: 'location_update' }, (payload: any) => {

          if (payload.payload &&
              (!deliveryPersonId || payload.payload.delivery_person_id === deliveryPersonId)) {
            const location: DeliveryLocation = {
              latitude: payload.payload.latitude,
              longitude: payload.payload.longitude,
              accuracy: payload.payload.accuracy,
              timestamp: payload.payload.timestamp,
              deliveryPersonId: payload.payload.delivery_person_id
            };

            if (isMounted) {
              setDeliveryLocation(location);
            }
          }
        });

        // Subscribe to channel
        await channel.subscribe((status: string) => {
          if (status === 'SUBSCRIBED' && isMounted) {
            setIsLoading(false);

            // Fetch latest location from database on subscribe
            fetchLatestLocation();
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

    // Fetch latest location from database
    const fetchLatestLocation = async () => {
      if (!deliveryPersonId) return;

      try {
        const { data, error } = await supabase
          .from('delivery_persons')
          .select('current_latitude, current_longitude, updated_at')
          .eq('id', deliveryPersonId)
          .maybeSingle();

        if (error) {
          console.error('[DeliveryListener] Error fetching location:', error);
          return;
        }

        if (data && data.current_latitude && data.current_longitude) {
          const location: DeliveryLocation = {
            latitude: data.current_latitude,
            longitude: data.current_longitude,
            timestamp: data.updated_at || new Date().toISOString(),
            deliveryPersonId
          };

          if (isMounted) {
            setDeliveryLocation(location);
          }
        }
      } catch (err) {
        console.error('[DeliveryListener] Error fetching location from DB:', err);
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
  }, [deliveryPersonId]);

  return {
    deliveryLocation,
    isLoading,
    error,
    hasLocation: !!deliveryLocation
  };
}
