/**
 * Notification Icon Configuration
 * 
 * This file configures custom notification icons for all three apps.
 * Android requires specific icon formats for notifications.
 */

// Notification icon configuration for each app
export const notificationConfig = {
  // User App (Food Delivery)
  userapp: {
    android: {
      // Small icon for status bar (must be monochrome, white on transparent)
      smallIcon: './assets/images/android-icon-monochrome.png',
      // Large icon for notification panel (can be colored)
      largeIcon: './assets/images/icon.png',
      // Color for the notification
      color: '#C41E26',
    },
    ios: {
      // iOS uses the app icon by default
      // Custom icons can be specified here
    }
  },
  
  // Delivery App
  deliverapp: {
    android: {
      smallIcon: './assets/images/android-icon-monochrome.png',
      largeIcon: './assets/images/icon.png',
      color: '#C41E26',
    },
    ios: {}
  },
  
  // Admin App
  adminsapp: {
    android: {
      smallIcon: './assets/images/android-icon-monochrome.png',
      largeIcon: './assets/images/icon.png',
      color: '#C41E26',
    },
    ios: {}
  }
};

// Default notification icon (monochrome for Android status bar)
export const DEFAULT_NOTIFICATION_ICON = './assets/images/android-icon-monochrome.png';

// Notification color (brand red)
export const NOTIFICATION_COLOR = '#C41E26';
