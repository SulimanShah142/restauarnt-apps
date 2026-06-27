import { AppState, AppStateStatus } from 'react-native';
import gpsOptimizer from './gps-optimizer';

// Conditional import for react-native-background-timer
let BackgroundTimer: any = null;
try {
  BackgroundTimer = require('react-native-background-timer');
} catch (error) {
  console.warn('react-native-background-timer not available, using fallback');
  // Fallback implementation using setTimeout/setInterval
  BackgroundTimer = {
    setTimeout: (fn: (...args: any[]) => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: number) => clearTimeout(id),
    setInterval: (fn: (...args: any[]) => void, ms: number) => setInterval(fn, ms),
    clearInterval: (id: number) => clearInterval(id),
  };
}

class BackgroundLocationService {
  isActive: boolean;
  appState: AppStateStatus;
  backgroundTimeout: number | null;
  checkInterval: number | null;
  appStateSubscription: any;

  constructor() {
    this.isActive = false;
    this.appState = AppState.currentState;
    this.backgroundTimeout = null;
    this.checkInterval = null;
    this.appStateSubscription = null;
  }

  // Start the background location service
  async startService() {
    try {
      // Initialize GPS optimizer
      await gpsOptimizer.initializeGPS();

      // Add app state listener to handle foreground/background transitions
      this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));

      // Start tracking initially
      await gpsOptimizer.startTracking();
      this.isActive = true;
    } catch (error) {
      console.error('Error starting Background Location Service:', error);
    }
  }

  // Handle app state changes (foreground/background)
  handleAppStateChange(nextAppState: AppStateStatus) {
    if (this.appState.match(/inactive|background/) && nextAppState === 'active') {
      // App moved from background to foreground
      this.onResume();
    } else if (this.appState === 'active' && nextAppState.match(/inactive|background/)) {
      // App moved from foreground to background
      this.onSuspend();
    }

    this.appState = nextAppState;
  }

  // Called when app moves to foreground
  async onResume() {
    try {
      // Resume location tracking with normal settings
      await gpsOptimizer.setBatteryOptimizationMode('balanced');
      await gpsOptimizer.startTracking();

      // Clear any background timers
      if (this.backgroundTimeout) {
        BackgroundTimer.clearTimeout(this.backgroundTimeout);
        this.backgroundTimeout = null;
      }

      // Clear any interval timers
      if (this.checkInterval) {
        BackgroundTimer.clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
    } catch (error) {
      console.error('Error resuming location tracking:', error);
    }
  }

  // Called when app moves to background
  async onSuspend() {
    try {
      // Adjust settings for background operation to save battery
      await gpsOptimizer.setBatteryOptimizationMode('power_save');

      // Continue tracking but with optimized settings
      await gpsOptimizer.startTracking();

      // Set up periodic checks to ensure tracking continues
      this.checkInterval = BackgroundTimer.setInterval(() => {
        this.verifyTrackingStatus();
      }, 60000); // Check every minute
    } catch (error) {
      console.error('Error suspending location tracking:', error);
    }
  }

  // Verify that tracking is still active
  async verifyTrackingStatus() {
    try {
      // This is a simplified check - in a real implementation, you'd check actual status
      // For now, just ensure tracking is still running
      if (this.isActive) {
        // Adjust settings periodically based on conditions
        gpsOptimizer.adjustSettingsForConditions();
      }
    } catch (error) {
      console.error('Error verifying tracking status:', error);
    }
  }

  // Stop the background location service
  async stopService() {
    try {
      // Remove app state listener
      if (this.appStateSubscription) {
        this.appStateSubscription.remove();
        this.appStateSubscription = null;
      }

      // Stop tracking
      await gpsOptimizer.stopTracking();

      // Clear timers
      if (this.backgroundTimeout) {
        BackgroundTimer.clearTimeout(this.backgroundTimeout);
        this.backgroundTimeout = null;
      }

      if (this.checkInterval) {
        BackgroundTimer.clearInterval(this.checkInterval);
        this.checkInterval = null;
      }

      this.isActive = false;
    } catch (error) {
      console.error('Error stopping Background Location Service:', error);
    }
  }

  // Get current location with optimized settings
  async getCurrentLocation() {
    try {
      return await gpsOptimizer.getCurrentPosition();
    } catch (error) {
      console.error('Error getting current location:', error);
      throw error;
    }
  }

  // Update GPS optimization settings dynamically
  updateSettings(settings: { accuracy?: string; distanceFilter?: number; timeInterval?: number }) {
    if (settings.accuracy) {
      gpsOptimizer.currentAccuracy = settings.accuracy;
    }

    if (settings.distanceFilter) {
      gpsOptimizer.minDistanceThreshold = settings.distanceFilter;
    }

    if (settings.timeInterval) {
      gpsOptimizer.minTimeThreshold = settings.timeInterval;
    }

    // Apply the new settings
    gpsOptimizer.applyOptimizationSettings();
  }
}

// Singleton instance
const backgroundLocationService = new BackgroundLocationService();
export default backgroundLocationService;
