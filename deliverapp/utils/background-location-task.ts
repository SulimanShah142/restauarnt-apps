import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';

export const LOCATION_TASK_NAME = 'background-location-task';

// Define interface for location task data
interface LocationTaskData {
  locations: Location.LocationObject[];
}

// Web fallback: Broadcast location using browser geolocation
let webLocationWatchId: number | null = null;

const startWebBackgroundLocation = (driverId: string): boolean => {
  if (!navigator.geolocation) {
    console.warn('[background-location-task] 🌐 Browser geolocation not supported');
    return false;
  }

  webLocationWatchId = navigator.geolocation.watchPosition(
    (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;

      // Broadcast to Supabase channels (same as native)
      const orderChannel = supabase.channel(`driver-live-tracking-${(globalThis as any).orderId || 'global'}`);
      orderChannel.send({
        type: 'broadcast',
        event: 'location-update',
        payload: {
          lat: latitude,
          lng: longitude,
          timestamp: new Date().toISOString(),
          driverId: (globalThis as any).driverId || 'unknown',
          orderId: (globalThis as any).orderId || null
        },
      }).then(({ error }: any) => {
        if (error) {
          console.error('[background-location-task] Error sending to order channel:', error);
        }
      });

      // Also send to admin channel for admin tracking
      const adminChannel = supabase.channel('admin-delivery-tracking');
      adminChannel.send({
        type: 'broadcast',
        event: 'location-update',
        payload: {
          lat: latitude,
          lng: longitude,
          timestamp: new Date().toISOString(),
          driverId: (globalThis as any).driverId || 'unknown',
          orderId: (globalThis as any).orderId || null
        },
      }).then(({ error }: any) => {
        if (error) {
          console.error('[background-location-task] Error sending to admin channel:', error);
        }
      });
    },
    (error: GeolocationPositionError) => {
      console.error('[background-location-task] 🌐 Web location error:', error.message);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
  );

  return true;
};

const stopWebBackgroundLocation = (): void => {
  if (webLocationWatchId !== null) {
    navigator.geolocation.clearWatch(webLocationWatchId);
    webLocationWatchId = null;
  }
};

// Define the background task for location updates (NATIVE ONLY - not supported on web)
if (Platform.OS !== 'web') {
  TaskManager.defineTask<LocationTaskData>(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.error('Location task error:', error);
      return;
    }

    if (data) {
      const { locations } = data;
      const { latitude, longitude } = locations[0].coords;

      // Broadcast the live position without saving to DB
      // This uses 0 bytes of permanent storage
      // Send to both the order-specific channel and the admin channel
      const orderChannel = supabase.channel(`driver-live-tracking-${(globalThis as any).orderId || 'global'}`);
      orderChannel.send({
        type: 'broadcast',
        event: 'location-update',
        payload: {
          lat: latitude,
          lng: longitude,
          timestamp: new Date().toISOString(),
          driverId: (globalThis as any).driverId || 'unknown', // Driver ID should be set globally when authenticated
          orderId: (globalThis as any).orderId || null
        },
      }).then(({ error }: any) => {
        if (error) {
          console.error('[background-location-task] Error sending to order channel:', error);
        }
      });

      // Also send to admin channel for admin tracking
      const adminChannel = supabase.channel('admin-delivery-tracking');
      adminChannel.send({
        type: 'broadcast',
        event: 'location-update',
        payload: {
          lat: latitude,
          lng: longitude,
          timestamp: new Date().toISOString(),
          driverId: (globalThis as any).driverId || 'unknown', // Driver ID should be set globally when authenticated
          orderId: (globalThis as any).orderId || null
        },
      }).then(({ error }: any) => {
        if (error) {
          console.error('[background-location-task] Error sending to admin channel:', error);
        }
      });
    }
  });
}

// Function to start background location tracking
export const startBackgroundLocationTracking = async (driverId: string): Promise<boolean> => {
  // Web fallback - note: true background tracking not possible on web
  if (Platform.OS === 'web') {
    (globalThis as any).driverId = driverId;
    return startWebBackgroundLocation(driverId);
  }

  try {
    // Request location permissions
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') {
      console.error('Background location permission not granted');
      return false;
    }

    // Set the driver ID globally for use in the background task
    (globalThis as any).driverId = driverId;

    // Start watching position in the background
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 5000, // Update every 5 seconds
      distanceInterval: 10, // Update every 10 meters
      showsBackgroundLocationIndicator: true,
    });

    return true;
  } catch (error) {
    console.error('Error starting background location tracking:', error);
    return false;
  }
};

// Function to stop background location tracking
export const stopBackgroundLocationTracking = async (): Promise<void> => {
  // Web fallback
  if (Platform.OS === 'web') {
    stopWebBackgroundLocation();
    (globalThis as any).driverId = null;
    (globalThis as any).orderId = null;
    return;
  }

  try {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    // Clean up global variables
    (globalThis as any).driverId = null;
    (globalThis as any).orderId = null;
  } catch (error) {
    console.error('Error stopping background location tracking:', error);
  }
};

// Function to get current location (for foreground use)
export const getCurrentLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
  // Web fallback
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.warn('[background-location-task] 🌐 Browser geolocation not supported');
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position: GeolocationPosition) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error: GeolocationPositionError) => {
          console.warn('[background-location-task] 🌐 Web location error:', error.message);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.error('Location permission not granted');
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error('Error getting current location:', error);
    return null;
  }
};
