/**
 * Background Location Service for Delivery App
 * Tracks delivery person location even when app is in background
 *
 * IMPORTANT: Requires native rebuild to work properly!
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const LOCATION_TRACKING_TASK = 'delivery-location-tracking';
const UPDATE_INTERVAL = 5000; // 5 seconds
const DISTANCE_INTERVAL = 5; // 5 meters

// Register background location task
export async function registerBackgroundLocationTask() {
  try {
    // Define the task BEFORE registering it
    if (!TaskManager.isTaskDefined(LOCATION_TRACKING_TASK)) {
      TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
        if (error) {
          console.error('[BackgroundLocation] Task error:', error);
          return;
        }

        if (data && typeof data === 'object' && 'locations' in data && Array.isArray((data as any).locations)) {
          const locations = (data as any).locations as Location.LocationObject[];
          const location = locations[0];

          if (location && location.coords) {

            // Update delivery person's location in database
            await updateDeliveryPersonLocation(
              location.coords.latitude,
              location.coords.longitude,
              location.coords.accuracy ?? 0
            );
          }
        }
      });
    }

    return true;
  } catch (error) {
    console.error('[BackgroundLocation] ❌ Error registering task:', error);
    return false;
  }
}

// Start background location tracking
export async function startBackgroundLocationTracking(deliveryPersonId: string) {
  try {

    // Request permissions
    const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
    
    if (existingStatus !== 'granted') {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        console.error('[BackgroundLocation] ❌ Foreground location permission denied');
        return false;
      }
    }

    // Request background location permission
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      console.warn('[BackgroundLocation] ⚠️ Background location permission denied - tracking will only work in foreground');
    }

    // Check if task is already running
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
    if (hasStarted) {
      return true;
    }

    // Start location tracking
    await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
      accuracy: Location.Accuracy.High,
      distanceInterval: DISTANCE_INTERVAL,
      timeInterval: UPDATE_INTERVAL,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Delivery Tracking Active',
        notificationBody: 'Your location is being tracked for delivery',
        notificationColor: '#C41E26',
      },
    });

    // Store delivery person ID for location updates
    await storeDeliveryPersonId(deliveryPersonId);

    return true;
  } catch (error: any) {
    console.error('[BackgroundLocation] ❌ Error starting tracking:', error);
    console.error('[BackgroundLocation] Error details:', {
      message: error.message,
      code: error.code,
      name: error.name,
    });
    return false;
  }
}

// Stop background location tracking
export async function stopBackgroundLocationTracking() {
  try {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
    }

    // Clear stored delivery person ID
    await clearDeliveryPersonId();

    return true;
  } catch (error) {
    console.error('[BackgroundLocation] ❌ Error stopping tracking:', error);
    return false;
  }
}

// Update delivery person location in database
async function updateDeliveryPersonLocation(
  latitude: number,
  longitude: number,
  accuracy: number
) {
  try {
    // Get stored delivery person ID
    const deliveryPersonId = await getStoredDeliveryPersonId();
    if (!deliveryPersonId) {
      return;
    }

    // Update current location in delivery_persons table
    const { error } = await supabase
      .from('delivery_persons')
      .update({
        current_latitude: latitude,
        current_longitude: longitude,
        current_location: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', deliveryPersonId);

    if (error) {
      console.error('[BackgroundLocation] Error updating location:', error);
    }
  } catch (error) {
    console.error('[BackgroundLocation] Error in location update:', error);
  }
}

// Store delivery person ID for background task
async function storeDeliveryPersonId(id: string) {
  try {
    await AsyncStorage.setItem('@delivery_person_id', id);
  } catch (error) {
    console.error('[BackgroundLocation] Error storing delivery person ID:', error);
  }
}

// Get stored delivery person ID
async function getStoredDeliveryPersonId(): Promise<string | null> {
  try {
    const id = await AsyncStorage.getItem('@delivery_person_id');
    return id;
  } catch (error) {
    console.error('[BackgroundLocation] Error getting delivery person ID:', error);
    return null;
  }
}

// Clear stored delivery person ID
async function clearDeliveryPersonId() {
  try {
    await AsyncStorage.removeItem('@delivery_person_id');
  } catch (error) {
    console.error('[BackgroundLocation] Error clearing delivery person ID:', error);
  }
}

// Check if background location is enabled
export async function isBackgroundLocationEnabled(): Promise<boolean> {
  try {
    const { status } = await Location.getBackgroundPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('[BackgroundLocation] Error checking background location:', error);
    return false;
  }
}

// Request battery optimization exemption (Android only)
export async function requestBatteryOptimizationExemption() {
  try {
    // expo-power is not available, skip battery optimization
    return false;
  } catch (error) {
    console.error('[BackgroundLocation] Error requesting battery exemption:', error);
    return false;
  }
}

// Initialize location service (call this on app start)
export async function initializeLocationService() {
  try {
    // Register background task
    await registerBackgroundLocationTask();

    // Check if we should auto-start tracking (if delivery person was on duty)
    const deliveryPersonId = await getStoredDeliveryPersonId();
    if (deliveryPersonId) {
      await startBackgroundLocationTracking(deliveryPersonId);
    }

    return true;
  } catch (error) {
    console.error('[BackgroundLocation] ❌ Error initializing service:', error);
    return false;
  }
}
