// Background Location Tracking Service
// Uses expo-task-manager and expo-location for background tracking

import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// expo-task-manager is not available in Expo Go, only in development builds
let TaskManager: any = null;
const IS_EXPO_GO = Platform.OS !== 'web' && require('expo-device').default && !require('expo-device').default.isDevice;

if (!IS_EXPO_GO) {
  try {
    TaskManager = require('expo-task-manager');
  } catch (e) {
    console.error('[BackgroundLocation] Failed to load expo-task-manager:', e);
  }
}

// Define the background task name
const BACKGROUND_LOCATION_TASK = 'background-location-tracking';

// Store for tracking state
let isTrackingEnabled = false;
let trackingInterval: NodeJS.Timeout | null = null;
let lastUpdateTime = 0;
const UPDATE_INTERVAL_MS = 5000; // Update every 5 seconds

/**
 * Define the background location task
 * This runs even when the app is in background or closed
 */
export const defineBackgroundLocationTask = () => {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
    try {
      if (error) {
        console.error('[BackgroundLocation] Task error:', error);
        return;
      }

      if (data && data.locations && data.locations.length > 0) {
        const location = data.locations[0];

        // Get current session to find delivery person ID
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session;

        if (session?.user?.id) {
          await updateLocationToSupabase(
            session.user.id,
            location.coords.latitude,
            location.coords.longitude
          );
        }
      }
    } catch (err) {
      console.error('[BackgroundLocation] Error in background task:', err);
    }
  });
};

/**
 * Update location to Supabase
 */
const updateLocationToSupabase = async (
  userId: string,
  latitude: number,
  longitude: number
) => {
  try {
    // Prevent too frequent updates
    const now = Date.now();
    if (now - lastUpdateTime < UPDATE_INTERVAL_MS) {
      return;
    }
    lastUpdateTime = now;


    // First, find the delivery person record
    const { data: deliveryPerson } = await supabase
      .from('delivery_persons')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    let deliveryPersonId = deliveryPerson?.id;

    if (!deliveryPersonId) {
      // Try using user_id as delivery_person id directly
      const { data: dpById } = await supabase
        .from('delivery_persons')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      deliveryPersonId = dpById?.id;
    }

    if (!deliveryPersonId) {
      console.warn('[BackgroundLocation] No delivery person record found');
      return;
    }

    // Update location
    const { error } = await supabase
      .from('delivery_persons')
      .update({
        current_latitude: latitude,
        current_longitude: longitude,
        updated_at: new Date().toISOString(),
      })
      .eq('id', deliveryPersonId);

    if (error) {
      console.error('[BackgroundLocation] Error updating location:', error);
    }
  } catch (error) {
    console.error('[BackgroundLocation] Error in updateLocationToSupabase:', error);
  }
};

/**
 * Start background location tracking
 * This will continue tracking even when app is in background
 */
export const startBackgroundTracking = async () => {
  try {

    // Check permissions
    const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      console.warn('[BackgroundLocation] ⚠️ Foreground permission not granted');
      return false;
    }

    // Request background permission (iOS only)
    const { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      const { status: newStatus } = await Location.requestBackgroundPermissionsAsync();
      if (newStatus !== 'granted') {
        console.warn('[BackgroundLocation] ⚠️ Background permission denied');
        // Continue with foreground-only tracking
      }
    }

    // Define the background task
    defineBackgroundLocationTask();

    // Start location updates with background tracking
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 10, // Update every 10 meters
      timeInterval: 5000, // Update every 5 seconds
      showsBackgroundLocationIndicator: true, // Show location indicator on iOS
      deferredUpdatesInterval: 10000, // Allow deferred updates for battery optimization
      activityType: Location.ActivityType.AutomotiveNavigation, // Optimized for driving
      foregroundService: {
        notificationTitle: 'Location Tracking Active',
        notificationBody: 'Tracking your location for delivery updates',
      },
    });

    isTrackingEnabled = true;
    return true;
  } catch (error) {
    console.error('[BackgroundLocation] ❌ Error starting background tracking:', error);
    return false;
  }
};

/**
 * Stop background location tracking
 */
export const stopBackgroundTracking = async () => {
  try {

    // Stop location updates
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);

    isTrackingEnabled = false;
    return true;
  } catch (error) {
    console.error('[BackgroundLocation] ❌ Error stopping background tracking:', error);
    return false;
  }
};

/**
 * Check if background tracking is enabled
 */
export const isBackgroundTrackingEnabled = () => {
  return isTrackingEnabled;
};

/**
 * Get current background task status
 */
export const getBackgroundTaskStatus = async () => {
  try {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    return hasStarted;
  } catch (error) {
    console.error('[BackgroundLocation] Error getting task status:', error);
    return false;
  }
};
