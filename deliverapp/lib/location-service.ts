// Optimized Location Service for Delivery App
// Updates location only every 50 meters to prevent spam
// Uses Supabase Realtime broadcasts for live tracking

import * as Location from 'expo-location';
import { supabase } from './supabase';
import { Platform } from 'react-native';

// Configuration
const DISTANCE_INTERVAL_METERS = 50; // Update only after 50 meters
const TIME_INTERVAL_MS = 10000; // Max update every 10 seconds (fallback)
const UPDATE_ACCURACY_THRESHOLD = 50; // Max accuracy in meters

// State
let lastKnownLocation: { latitude: number; longitude: number } | null = null;
let lastUpdateTime = 0;
let locationSubscription: any = null;

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Check if location update should be sent
 * Returns true if distance traveled > 50 meters OR time since last update > 10 seconds
 */
const shouldUpdateLocation = (
  newLat: number,
  newLng: number,
  accuracy: number
): boolean => {
  // Don't update if accuracy is too poor
  if (accuracy > UPDATE_ACCURACY_THRESHOLD) {
    return false;
  }

  const now = Date.now();
  
  // First location - always update
  if (!lastKnownLocation) {
    return true;
  }

  // Calculate distance from last known location
  const distance = calculateDistance(
    lastKnownLocation.latitude,
    lastKnownLocation.longitude,
    newLat,
    newLng
  );


  // Update if traveled more than 50 meters
  if (distance >= DISTANCE_INTERVAL_METERS) {
    return true;
  }

  // Update if enough time has passed (fallback)
  if (now - lastUpdateTime >= TIME_INTERVAL_MS) {
    return true;
  }

  // Don't update - hasn't moved enough
  return false;
};

/**
 * Update location to Supabase and broadcast via Realtime
 */
export const updateDeliveryLocation = async (
  orderId: string,
  latitude: number,
  longitude: number,
  accuracy: number
): Promise<boolean> => {
  try {
    // Check if we should update
    if (!shouldUpdateLocation(latitude, longitude, accuracy)) {
      return false;
    }

    // Get delivery person ID from session
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;

    if (!session?.user?.id) {
      console.warn('[LocationService] No session found');
      return false;
    }

    // Find delivery person record
    const { data: deliveryPerson } = await supabase
      .from('delivery_persons')
      .select('id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    const deliveryPersonId = deliveryPerson?.id;

    if (!deliveryPersonId) {
      console.warn('[LocationService] No delivery person record found');
      return false;
    }

    // Update location in database
    const { error } = await supabase
      .from('delivery_persons')
      .update({
        current_latitude: latitude,
        current_longitude: longitude,
        updated_at: new Date().toISOString(),
      })
      .eq('id', deliveryPersonId);

    if (error) {
      console.error('[LocationService] Error updating database:', error);
      return false;
    }

    // Broadcast location via Realtime for live tracking
    const channel = supabase.channel(`order-${orderId}-location`);
    await channel.send({
      type: 'broadcast',
      event: 'location-update',
      payload: {
        delivery_person_id: deliveryPersonId,
        latitude,
        longitude,
        accuracy,
        timestamp: new Date().toISOString(),
      },
    }).then((response) => {
      if (response === 'error') {
        console.error('[LocationService] Error broadcasting location:', response);
      }
    });

    // Update last known location
    lastKnownLocation = { latitude, longitude };
    lastUpdateTime = Date.now();


    return true;
  } catch (error) {
    console.error('[LocationService] Error updating location:', error);
    return false;
  }
};

/**
 * Start location tracking with optimization
 * Only updates every 50 meters or 10 seconds
 */
export const startOptimizedTracking = async (
  orderId: string,
  onLocationUpdate?: (location: { latitude: number; longitude: number }) => void
): Promise<boolean> => {
  try {

    // Check permissions
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[LocationService] ⚠️ Location permission not granted');
      return false;
    }

    // Get initial location
    const initialLocation = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
    });

    // Update initial location
    await updateDeliveryLocation(
      orderId,
      initialLocation.coords.latitude,
      initialLocation.coords.longitude,
      initialLocation.coords.accuracy ?? 10
    );

    // Notify callback
    if (onLocationUpdate) {
      onLocationUpdate({
        latitude: initialLocation.coords.latitude,
        longitude: initialLocation.coords.longitude,
      });
    }

    // Watch for location updates
    locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000, // Check every 2 seconds
        distanceInterval: DISTANCE_INTERVAL_METERS, // But only notify every 50 meters
      },
      async (location) => {

        // Update location (with optimization - only updates if 50m traveled)
        const updated = await updateDeliveryLocation(
          orderId,
          location.coords.latitude,
          location.coords.longitude,
          location.coords.accuracy ?? 10
        );

        // Notify callback only if location was actually updated
        if (updated && onLocationUpdate) {
          onLocationUpdate({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      }
    );

    return true;
  } catch (error) {
    console.error('[LocationService] ❌ Error starting tracking:', error);
    return false;
  }
};

/**
 * Stop location tracking
 */
export const stopLocationTracking = async (): Promise<void> => {
  try {
    if (locationSubscription) {
      if (typeof locationSubscription.remove === 'function') {
        locationSubscription.remove();
      }
      locationSubscription = null;
    }
  } catch (error) {
    console.error('[LocationService] Error stopping tracking:', error);
  }
};

/**
 * Get last known location
 */
export const getLastKnownLocation = (): { latitude: number; longitude: number } | null => {
  return lastKnownLocation;
};

/**
 * Reset location state (call when order changes)
 */
export const resetLocationState = (): void => {
  lastKnownLocation = null;
  lastUpdateTime = 0;
};
