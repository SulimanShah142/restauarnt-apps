import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import {
  startBackgroundTracking,
  stopBackgroundTracking,
  isBackgroundTrackingEnabled
} from '@/lib/background-location';

interface UseLocationTrackingProps {
  enabled?: boolean;
  userId?: string;
  isDeliveryPerson?: boolean;
  updateIntervalMs?: number;
}

interface UseLocationTrackingReturn {
  driverLocation: { latitude: number; longitude: number } | null;
  locationEnabled: boolean;
  locationPermissionDenied: boolean;
  showLocationDialog: boolean;
  checkLocationPermission: () => Promise<void>;
  enableLocation: () => Promise<void>;
}

export function useLocationTracking({
  enabled = true,
  userId,
  isDeliveryPerson = false,
  updateIntervalMs = 2000
}: UseLocationTrackingProps = {}): UseLocationTrackingReturn {
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(enabled);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);

  const locationSubscriptionRef = useRef<any>(null);

  // Check location permissions
  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();

      if (status !== 'granted') {
        setShowLocationDialog(true);
        setLocationEnabled(false);
        setLocationPermissionDenied(true);
      } else {
        setLocationEnabled(true);
        setShowLocationDialog(false);
        setLocationPermissionDenied(false);
      }
    } catch (error) {
      console.error('[LocationHook] Error checking permission:', error);
      setShowLocationDialog(true);
      setLocationEnabled(false);
      setLocationPermissionDenied(true);
    }
  };

  // Enable location
  const enableLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status === 'granted') {
        setLocationEnabled(true);
        setShowLocationDialog(false);
        setLocationPermissionDenied(false);

        // Start background tracking if delivery person
        if (isDeliveryPerson) {
          const backgroundStarted = await startBackgroundTracking();
          if (backgroundStarted) {
            // Get location immediately with BEST accuracy
            const currentLocation = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.BestForNavigation,
              timeInterval: 1000,
              distanceInterval: 5,
            });
            setDriverLocation({
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
            });

            // Update to Supabase
            if (userId && isDeliveryPerson) {
              await updateLocationToSupabase(currentLocation.coords.latitude, currentLocation.coords.longitude, userId);
            }
          }
        }
      } else {
        // User denied - keep showing the dialog
        setShowLocationDialog(true);
        setLocationEnabled(false);
        setLocationPermissionDenied(true);
      }
    } catch (error) {
      console.error('[LocationHook] Error enabling location:', error);
      setShowLocationDialog(true);
      setLocationEnabled(false);
      setLocationPermissionDenied(true);
    }
  };

  // Update location to Supabase
  const updateLocationToSupabase = async (latitude: number, longitude: number, uid: string) => {
    if (!uid) return;

    try {
      if (isDeliveryPerson) {
        // First, find the delivery person record
        const { data: deliveryPerson } = await supabase
          .from('delivery_persons')
          .select('id')
          .eq('user_id', uid)
          .maybeSingle();

        if (!deliveryPerson) {
          // Try using the user_id as delivery_person id directly
          const { data: dpById } = await supabase
            .from('delivery_persons')
            .select('id')
            .eq('id', uid)
            .maybeSingle();

          if (!dpById) return;

          // Update location
          await supabase
            .from('delivery_persons')
            .update({
              current_latitude: latitude,
              current_longitude: longitude,
              updated_at: new Date().toISOString()
            })
            .eq('id', dpById.id);
        } else {
          // Update location
          await supabase
            .from('delivery_persons')
            .update({
              current_latitude: latitude,
              current_longitude: longitude,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', uid);
        }

        // Update user's location in profiles table
        await supabase
          .from('profiles')
          .update({
            last_latitude: latitude,
            last_longitude: longitude,
            updated_at: new Date().toISOString()
          })
          .eq('id', uid);
      }
    } catch (error) {
      console.error('[LocationHook] Error updating location to Supabase:', error);
    }
  };

  // Check location permissions when component mounts and keep checking
  useEffect(() => {
    if (enabled) {
      checkLocationPermission();

      // Keep checking location status every 3 seconds if not enabled
      const checkInterval = setInterval(() => {
        if (!locationEnabled) {
          checkLocationPermission();
        }
      }, 3000);

      return () => clearInterval(checkInterval);
    }
  }, [enabled, locationEnabled]);

  // Track location and update to Supabase
  useEffect(() => {
    let isMounted = true;

    const startLocationTracking = async () => {
      if (!locationEnabled || !isMounted || !enabled) return;

      try {
        // Start BACKGROUND tracking for delivery persons
        if (isDeliveryPerson) {
          const backgroundStarted = await startBackgroundTracking();

          if (backgroundStarted) {
            console.warn('[LocationHook] ⚠️ Background tracking failed, using foreground only');
          }
        }

        // Get initial location with BEST accuracy
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 5,
        });

        if (isMounted) {
          setDriverLocation({
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          });

          // Update location to Supabase immediately
          if (userId) {
            await updateLocationToSupabase(currentLocation.coords.latitude, currentLocation.coords.longitude, userId);
          }
        }

        // Watch for location updates
        locationSubscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: updateIntervalMs,
            distanceInterval: 5,
          },
          (location) => {
            if (isMounted) {
              setDriverLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              });

              // Update to Supabase periodically
              if (userId) {
                updateLocationToSupabase(location.coords.latitude, location.coords.longitude, userId);
              }
            }
          }
        );

      } catch (error: any) {
        // Gracefully handle location errors
        if (error.message?.includes('location services are not enabled') ||
            error.message?.includes('location services are disabled') ||
            error.message?.includes('Current location is unavailable')) {
          console.warn('[LocationHook] ⚠️ Location services disabled');
        } else if (error.message?.includes('permission')) {
          console.warn('[LocationHook] ⚠️ Location permission denied');
        } else {
          console.error('[LocationHook] ❌ Location error:', error.message);
        }
      }
    };

    startLocationTracking();

    // Cleanup on unmount
    return () => {
      isMounted = false;

      // Clean up foreground subscription only
      if (locationSubscriptionRef.current) {
        try {
          if (typeof locationSubscriptionRef.current.remove === 'function') {
            locationSubscriptionRef.current.remove();
          } else if (typeof locationSubscriptionRef.current.unsubscribe === 'function') {
            locationSubscriptionRef.current.unsubscribe();
          }
        } catch (error) {
          console.warn('[LocationHook] Error cleaning up subscription:', error);
        }
        locationSubscriptionRef.current = null;
      }
    };
  }, [locationEnabled, enabled, userId, isDeliveryPerson, updateIntervalMs]);

  return {
    driverLocation,
    locationEnabled,
    locationPermissionDenied,
    showLocationDialog,
    checkLocationPermission,
    enableLocation,
  };
}
