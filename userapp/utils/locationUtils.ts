import * as Location from 'expo-location';
import { Platform } from 'react-native';

// Type declarations for web globals
declare const GeolocationCoordinates: any;
declare const navigator: any;

// Web fallback using browser geolocation API
const getWebLocation = (): Promise<any | null> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      // console.warn('[locationUtils] Browser geolocation not supported');
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve(position.coords);
      },
      (error) => {
        // console.warn('[locationUtils] ⚠️ Web location error:', error.message);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
};

// Web fallback for watching location
const watchWebLocation = (
  callback: (coords: any) => void
): (() => void) => {
  if (!navigator.geolocation) {
    // console.warn('[locationUtils] Browser geolocation not supported for watching');
    return () => {};
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      callback(position.coords);
    },
    (error) => {
      // console.warn('[locationUtils] ⚠️ Web location watch error:', error.message);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
  );

  // Return cleanup function
  return () => {
    navigator.geolocation.clearWatch(watchId);
  };
};

// Function to get current location
export const getCurrentLocation = async (): Promise<Location.LocationObjectCoords | any | null> => {
  // Web fallback
  if (Platform.OS === 'web') {
    return await getWebLocation();
  }

  try {
    // Request location permission
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      // console.error('Location permission not granted');
      return null;
    }

    // Get current position
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return location.coords;
  } catch (error) {
    // console.error('Error getting current location:', error);
    return null;
  }
};

// Function to watch location
export const watchLocation = async (
  callback: (location: Location.LocationObject | any) => void
): Promise<(() => void) | null> => {
  // Web fallback
  if (Platform.OS === 'web') {
    const cleanup = watchWebLocation((coords) => {
      // Wrap in Location.LocationObject-like structure for compatibility
      callback({
        coords,
        timestamp: Date.now(),
      } as any);
    });
    return cleanup;
  }

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      // console.error('Location permission not granted');
      return null;
    }

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000, // Update every 5 seconds
        distanceInterval: 10, // Update every 10 meters
      },
      callback
    );

    // Return cleanup function
    return () => {
      subscription.remove();
    };
  } catch (error) {
    // console.error('Error watching location:', error);
    return null;
  }
};

// Interface for coordinate
export interface Coordinate {
  latitude: number;
  longitude: number;
}

// Function to calculate distance between two points (in kilometers)
export const calculateDistance = (coord1: Coordinate, coord2: Coordinate): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
  const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(coord1.latitude * Math.PI / 180) * Math.cos(coord2.latitude * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c; // Distance in kilometers
  return d;
};