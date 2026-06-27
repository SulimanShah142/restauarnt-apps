import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import {
  startBackgroundTracking,
  stopBackgroundTracking
} from '@/lib/background-location';

interface UseDeliveryLocationBroadcastProps {
  enabled: boolean;
  deliveryPersonId?: string;
  activeOrderId?: string;
  orderStatus?: string;
}

/**
 * Broadcasts delivery person's location via Supabase Realtime
 * Only broadcasts when:
 * - enabled is true
 * - deliveryPersonId exists
 * - activeOrderId exists (order is assigned)
 * - orderStatus is 'picked_up' or 'on_the_way'
 * - Location changes by 50+ meters
 */
export function useDeliveryLocationBroadcast({
  enabled,
  deliveryPersonId,
  activeOrderId,
  orderStatus
}: UseDeliveryLocationBroadcastProps) {
  const lastBroadcastLocation = useRef<{ lat: number; lng: number } | null>(null);
  const broadcastChannelRef = useRef<any>(null);
  const orderChannelRef = useRef<any>(null);
  const locationSubscriptionRef = useRef<any>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Check if we should broadcast based on order status
  // Always broadcast if enabled and deliveryPersonId exists (for admin tracking)
  // Order-specific broadcast only when order is active
  const shouldBroadcast = enabled && deliveryPersonId;

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  // Broadcast location to Supabase Realtime
const broadcastLocation = async (
  latitude: number,
  longitude: number,
  accuracy?: number
) => {
  if (!deliveryPersonId) return;

  try {
    // Check if location changed by 50+ meters
    if (lastBroadcastLocation.current) {
      const distance = calculateDistance(
        lastBroadcastLocation.current.lat,
        lastBroadcastLocation.current.lng,
        latitude,
        longitude
      );

      if (distance < 50) return;
    }

    const timestamp = new Date().toISOString();

    // Update DB
    await supabase
      .from('delivery_persons')
      .update({
        current_latitude: latitude,
        current_longitude: longitude,
        updated_at: timestamp
      })
      .eq('id', deliveryPersonId);

    const payload = {
      delivery_person_id: deliveryPersonId,
      latitude,
      longitude,
      accuracy,
      timestamp
    };

    // General channel broadcast
    broadcastChannelRef.current?.send({
      type: 'broadcast',
      event: 'location_update',
      payload
    });

    // Order-specific broadcast (NO re-subscribe here!)
    if (activeOrderId) {
      orderChannelRef.current?.send({
        type: 'broadcast',
        event: 'location_update',
        payload: {
          ...payload,
          order_id: activeOrderId
        }
      });
    }

    // Save last known location
    lastBroadcastLocation.current = {
      lat: latitude,
      lng: longitude
    };

  } catch (error) {
    console.error('[DeliveryBroadcast] Error broadcasting location:', error);
  }
};

  useEffect(() => {
    if (!shouldBroadcast) {
      // Stop broadcasting if conditions not met
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.unsubscribe();
        broadcastChannelRef.current = null;
      }
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove?.();
        locationSubscriptionRef.current = null;
      }
      setIsBroadcasting(false);
      return;
    }

    let isMounted = true;

    const startBroadcasting = async () => {
      if (!isMounted) return;

      try {
        // Create Realtime channel for general delivery tracking (always)
        const channelName = 'delivery_locations';
        const channel = supabase.channel(channelName);

        await channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setIsBroadcasting(true);
          }
        });

        broadcastChannelRef.current = channel;

        // Also subscribe to order-specific channel if order is active
        if (activeOrderId) {
          const orderChannelName = `order:${activeOrderId}:location`;
          const orderChannel = supabase.channel(orderChannelName);
          await orderChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('[DeliveryBroadcast] Subscribed to order channel:', orderChannelName);
            }
          });
          orderChannelRef.current = orderChannel;
        }

        // Start background tracking
        const backgroundStarted = await startBackgroundTracking();
        if (backgroundStarted) {
          // Get initial location
          const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation,
          });

          if (isMounted) {
            await broadcastLocation(
              currentLocation.coords.latitude,
              currentLocation.coords.longitude,
              currentLocation.coords.accuracy ?? undefined
            );
          }

          // Watch for location updates (every 50 meters)
          locationSubscriptionRef.current = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.BestForNavigation,
              timeInterval: 5000, // Check every 5 seconds
              distanceInterval: 50, // Update every 50 meters
            },
            async (location) => {
              if (isMounted && shouldBroadcast) {
                await broadcastLocation(
                  location.coords.latitude,
                  location.coords.longitude,
                  location.coords.accuracy ?? undefined
                );
              }
            }
          );
        }
      } catch (error) {
        console.error('[DeliveryBroadcast] Error starting broadcast:', error);
      }
    };

    startBroadcasting();

    // Cleanup
    return () => {
      isMounted = false;

      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove?.();
        locationSubscriptionRef.current = null;
      }

      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.unsubscribe();
        broadcastChannelRef.current = null;
      }

      if (orderChannelRef.current) {
        orderChannelRef.current.unsubscribe();
        orderChannelRef.current = null;
      }

      setIsBroadcasting(false);
    };
  }, [shouldBroadcast, activeOrderId]);

  return {
    isBroadcasting,
    shouldBroadcast,
    lastBroadcastLocation: lastBroadcastLocation.current
  };
}
