import { ExpoConfig, ConfigContext } from 'expo/config';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

// Check if google-services.json exists
const googleServicesPath = path.resolve(__dirname, 'google-services.json');
const hasGoogleServices = fs.existsSync(googleServicesPath);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'AYAR Delivery',
  slug: 'ayar-delivery',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/splash-screen.jpg',
  scheme: 'ayardelivery',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/images/splash-screen.jpg',
    resizeMode: 'contain',
    backgroundColor: '#C41E26',
  },
  android: {
    package: 'com.ayar.delivery',
    googleServicesFile: './google-services.json',
    adaptiveIcon: {
      foregroundImage: './assets/images/splash-screen.jpg',
      backgroundColor: '#C41E26',
    },
    permissions: [
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'POST_NOTIFICATIONS',
      'RECEIVE_BOOT_COMPLETED',
      'VIBRATE',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
      'REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      'WAKE_LOCK',
    ],
    // @ts-ignore - required for background location on Android
    androidPermissions: {
      locationAlwaysAndWhenInUsePermission: 'Allow AYAR Delivery to use your location for delivery tracking',
      isAndroidBackgroundLocationEnabled: true,
    },
    // @ts-ignore - notification property works at runtime in Expo
    notification: {
      icon: './assets/images/android-icon-monochrome.png',
      color: '#C41E26',
    },
    // Enable cleartext traffic for MapLibre tiles
    usesCleartextTraffic: true,
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.ayar.delivery',
    appleTeamId: '3A4VP86PL8', // Linked your verified Apple Team ID
    icon: './assets/images/splash-screen.jpg',
    infoPlist: {
          "ITSAppUsesNonExemptEncryption": false,
      NSCameraUsageDescription: 'We need access to your camera to take photos.',
      NSPhotoLibraryUsageDescription:
        'We need access to your photo library to select images.',
      NSPhotoLibraryAddUsageDescription:
        'We need permission to save photos to your photo library.',
      NSLocationWhenInUseUsageDescription:
        'We need your location to track deliveries and show your current location to customers.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'We need your location to track deliveries even when the app is in the background or closed.',
      NSLocationAlwaysUsageDescription:
        'We need your location to track deliveries even when the app is in the background.',
      UIBackgroundModes: ['location', 'fetch', 'remote-notification'],
    },
  },
  web: {
    output: 'static',
    favicon: './assets/images/splash-screen.jpg',
  },
  plugins: [
    'expo-router',
    'expo-web-browser',
    'expo-location',
    'expo-sqlite',
    'expo-system-ui',
    // Only include Firebase plugin if google-services.json exists
    ...(hasGoogleServices ? ['./plugins/withFirebase'] : []),
    // OneSignal Plugin configured specifically for production App Store builds
    [
      'onesignal-expo-plugin',
      {
        mode: 'production',
      }
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#C41E26',
        image: './assets/images/splash-screen.jpg',
        imageWidth: 0,
        resizeMode: 'contain',
        dark: {
          image: './assets/images/splash-screen.jpg',
          backgroundColor: '#C41E26',
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: '4dacf6ac-71dc-43f6-9d57-c96be6f99426',
    },
    mapTilerKey: process.env.EXPO_PUBLIC_MAPTILER_KEY || '5MOQerQLiYgmkWeWHRd7',
    locationIqKey: process.env.EXPO_PUBLIC_LOCATION_IQ_TOKEN || 'pk.ac03476010699238dcadcb4f0eb9a998',
    // OneSignal App ID - CRITICAL for push notifications
    onesignalAppId: process.env.ONESIGNAL_APP_ID || process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID || '',
  },
  owner: 'suliman-jan',
  runtimeVersion: '1.0.0',
});
