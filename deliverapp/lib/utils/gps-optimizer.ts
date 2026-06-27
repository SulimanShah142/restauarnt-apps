// Conditional import for background geolocation
let BackgroundGeolocation: any = null;
try {
  const bgGeo = require('@mauron85/react-native-background-geolocation');
  BackgroundGeolocation = bgGeo.BackgroundGeolocation || bgGeo.default || bgGeo;
} catch (error) {
  console.warn('@mauron85/react-native-background-geolocation not available, using fallback');
}

// Conditional import for Geolocation from react-native
let Geolocation: any = null;
try {
  const rn = require('react-native');
  Geolocation = rn.Geolocation;
} catch (error) {
  console.warn('react-native Geolocation not available, using fallback');
  // Fallback to expo-location or standard geolocation API
  Geolocation = {
    getCurrentPosition: (success: (...args: any[]) => void, error: (...args: any[]) => void, options?: any) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position: GeolocationPosition) => success({
            coords: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            },
            timestamp: position.timestamp,
          }),
          (err: GeolocationPositionError) => error(err),
          options
        );
      } else {
        error(new Error('Geolocation not available'));
      }
    },
  };
}

import { getDatabase } from '../../db';

// GPS Optimization Utility for Background Operations
class GPSOptimizer {
  isTracking: boolean;
  lastKnownPosition: any;
  minDistanceThreshold: number;
  minTimeThreshold: number;
  batteryOptimizationLevel: string;
  currentAccuracy: string;

  constructor() {
    this.isTracking = false;
    this.lastKnownPosition = null;
    this.minDistanceThreshold = 10; // meters
    this.minTimeThreshold = 30000; // 30 seconds in ms
    this.batteryOptimizationLevel = 'balanced'; // 'high_accuracy', 'balanced', 'low_power', 'no_power'
    this.currentAccuracy = 'medium'; // 'high', 'medium', 'low'
  }

  // Initialize GPS tracking with optimized settings
  async initializeGPS() {
    try {
      if (!BackgroundGeolocation) {
        return;
      }

      // Configure background geolocation with battery-friendly settings
      BackgroundGeolocation.configure({
        desiredAccuracy: this.getDesiredAccuracy(),
        stationaryRadius: 25, // meters
        distanceFilter: this.minDistanceThreshold,
        notificationTitle: 'Delivery Tracking',
        notificationText: 'Tracking your location for delivery',
        debug: false, // enable this hear sounds for background-geolocation life-cycle.
        stopOnTerminate: false, // enable this to clear background location settings when the app terminates
        startOnBoot: true, // auto restart tracking when device is powered up
        locationProvider: BackgroundGeolocation.ACTIVITY_PROVIDER, // ACTIVITY_PROVIDER is more battery friendly

        // Activity recognition options
        activityType: 'AutomotiveNavigation', // Helps the OS optimize for the use case
        pauseLocationUpdates: false,

        // HTTP / SQLite configuration
        saveBatteryOnBackground: true,
      });

      // Register event listeners
      BackgroundGeolocation.on('location', this.onLocation.bind(this));
      BackgroundGeolocation.on('stationary', this.onStationary.bind(this));
      BackgroundGeolocation.on('error', this.onError.bind(this));
      BackgroundGeolocation.on('start', this.onStart.bind(this));
      BackgroundGeolocation.on('stop', this.onStop.bind(this));

      console.log('GPS Optimizer initialized successfully');
    } catch (error) {
      console.error('Error initializing GPS Optimizer:', error);
    }
  }

  // Get appropriate accuracy based on optimization level
  getDesiredAccuracy() {
    if (!BackgroundGeolocation) {
      return 100; // Default accuracy
    }

    switch (this.currentAccuracy) {
      case 'high':
        return BackgroundGeolocation.HIGH_ACCURACY;
      case 'medium':
        return BackgroundGeolocation.MEDIUM_ACCURACY;
      case 'low':
        return BackgroundGeolocation.LOW_ACCURACY;
      default:
        return BackgroundGeolocation.MEDIUM_ACCURACY;
    }
  }

  // Handle location updates
  async onLocation(location: any) {
    try {
      // Check if the location is significantly different from the last known position
      if (this.shouldUpdateLocation(location)) {
        this.lastKnownPosition = location;

        // Update location in the database
        const db = await getDatabase();
        // Assuming we have a delivery person ID available - in real implementation this would come from context
        // For now, we'll skip this call since we need the delivery person ID
        // await db.updateDeliveryPersonLocation(deliveryPersonId, location.coords.latitude, location.coords.longitude);
      }
    } catch (error) {
      console.error('Error updating location:', error);
    }
  }

  // Determine if location update should be processed
  shouldUpdateLocation(newLocation: any) {
    if (!this.lastKnownPosition) {
      return true; // Always update if no previous location
    }

    // Calculate distance between current and previous location
    const distance = this.calculateDistance(
      this.lastKnownPosition.coords.latitude,
      this.lastKnownPosition.coords.longitude,
      newLocation.coords.latitude,
      newLocation.coords.longitude
    );

    // Only update if distance threshold is met
    return distance >= this.minDistanceThreshold;
  }

  // Calculate distance between two points using Haversine formula
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }

  // Handle stationary events
  onStationary(stationaryLocation: any) {
    // Could reduce update frequency when stationary
  }

  // Handle errors
  onError(error: any) {
    console.error('GPS Error:', error);
  }

  // Handle start event
  onStart() {
    this.isTracking = true;
  }

  // Handle stop event
  onStop() {
    this.isTracking = false;
  }

  // Start location tracking with adaptive settings
  async startTracking() {
    try {
      // Adjust settings based on battery level and network conditions
      this.adjustSettingsForConditions();

      if (BackgroundGeolocation) {
        await BackgroundGeolocation.start();
      }
      console.log('Location tracking started successfully');
    } catch (error) {
      console.error('Error starting location tracking:', error);
    }
  }

  // Stop location tracking
  async stopTracking() {
    try {
      if (BackgroundGeolocation) {
        await BackgroundGeolocation.stop();
      }
      console.log('Location tracking stopped successfully');
    } catch (error) {
      console.error('Error stopping location tracking:', error);
    }
  }

  // Adjust GPS settings based on conditions (battery, network, etc.)
  adjustSettingsForConditions() {
    // This is a simplified version - in a real app, you'd check actual battery level, etc.
    const batteryLevel = 0.5; // Placeholder - would come from actual battery API

    if (batteryLevel < 0.2) {
      // Low battery - use power saving settings
      this.currentAccuracy = 'low';
      this.minDistanceThreshold = 50; // Increase distance threshold
      this.minTimeThreshold = 60000; // Increase time threshold to 1 minute
    } else if (batteryLevel < 0.5) {
      // Medium battery - use balanced settings
      this.currentAccuracy = 'medium';
      this.minDistanceThreshold = 25;
      this.minTimeThreshold = 45000; // 45 seconds
    } else {
      // Good battery - use more accurate settings
      this.currentAccuracy = 'medium'; // Still medium to balance accuracy and battery
      this.minDistanceThreshold = 10; // Default distance
      this.minTimeThreshold = 30000; // Default time
    }
  }

  // Adaptive location update based on movement speed
  async adaptiveLocationUpdate(currentSpeed: number) {
    // Adjust distance and time thresholds based on speed
    if (currentSpeed < 5) { // Walking speed
      this.minDistanceThreshold = 5; // Update more frequently
      this.minTimeThreshold = 15000; // Every 15 seconds
    } else if (currentSpeed < 15) { // Cycling speed
      this.minDistanceThreshold = 10; // Moderate updates
      this.minTimeThreshold = 20000; // Every 20 seconds
    } else { // Driving speed
      this.minDistanceThreshold = 25; // Less frequent updates
      this.minTimeThreshold = 30000; // Every 30 seconds
    }
  }

  // Get current position with optimized settings
  getCurrentPosition(options: any = {}) {
    const defaultOptions = {
      enableHighAccuracy: this.currentAccuracy === 'high',
      timeout: 15000,
      maximumAge: 300000, // 5 minutes
      distanceFilter: this.minDistanceThreshold
    };

    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position: any) => resolve(position),
        (error: any) => reject(error),
        { ...defaultOptions, ...options }
      );
    });
  }

  // Toggle battery optimization mode
  setBatteryOptimizationMode(mode: string) {
    this.batteryOptimizationLevel = mode;
    // Apply new settings based on mode
    this.applyOptimizationSettings();
  }

  // Apply optimization settings based on current mode
  applyOptimizationSettings() {
    switch (this.batteryOptimizationLevel) {
      case 'high_accuracy':
        this.currentAccuracy = 'high';
        this.minDistanceThreshold = 5;
        break;
      case 'balanced':
        this.currentAccuracy = 'medium';
        this.minDistanceThreshold = 10;
        break;
      case 'power_save':
        this.currentAccuracy = 'low';
        this.minDistanceThreshold = 50;
        break;
      case 'device_optimal':
        // Let the device decide based on current conditions
        this.currentAccuracy = 'medium';
        this.minDistanceThreshold = 25;
        break;
    }
  }
}

// Singleton instance
const gpsOptimizer = new GPSOptimizer();
export default gpsOptimizer;
