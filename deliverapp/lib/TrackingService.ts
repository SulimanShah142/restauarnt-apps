// DeliverApp/lib/TrackingService.ts
import * as Location from 'expo-location';
import { supabase } from './supabase';

export const startBroadcasting = async (orderId: string) => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    console.error('Location permission not granted');
    return null;
  }

  // Get current user profile for the avatar
  const { data: { user } } = await supabase.auth.getUser();
  const avatarUrl = user?.user_metadata?.avatar_url || null;

  const channelName = `order:${orderId}`;
  const channel = supabase.channel(channelName);

  // Subscribe to the channel
  channel.subscribe();

  // Watch position with throttling - only send updates when moved 15 meters
  const subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 15 // CRITICAL: Saves messages by only sending on movement
    },
    (location) => {
      channel.send({
        type: 'broadcast',
        event: 'location_update',
        payload: {
          orderId,
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          timestamp: new Date().toISOString(),
          accuracy: location.coords.accuracy,
          avatarUrl: avatarUrl, // Include the profile picture URL
        },
      }).then((response) => {
        if (response === 'error') {
          console.error('[TrackingService] Error sending location update:', response);
        }
      });
    }
  );

  return {
    unsubscribe: () => {
      subscription?.remove();
      supabase.removeChannel(channel);
    }
  };
};

export const stopBroadcasting = (unsubscribeFn: (() => void) | null) => {
  if (unsubscribeFn) {
    unsubscribeFn();
  }
};
