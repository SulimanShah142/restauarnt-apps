/* eslint-disable no-undef */
const fs = require('fs');
const path = require('path');

// Check if google-services.json exists
const googleServicesPath = path.resolve(__dirname, 'google-services.json');
const hasGoogleServices = fs.existsSync(googleServicesPath);

module.exports = function(config) {
  return Object.assign({}, config, {
    name: 'AYAR Food Delivery',
    slug: 'ayar-food-delivery',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/splash-screen.jpg',
    scheme: 'ayarfood',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/images/splash-screen.jpg',
      resizeMode: 'contain',
      backgroundColor: '#C41E26',
    },
    android: {
      package: 'com.ayar.food',
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
        'POST_NOTIFICATIONS',
        'RECEIVE_BOOT_COMPLETED',
        'VIBRATE',
      ],
      androidPermissions: {
        locationAlwaysAndWhenInUsePermission: 'Allow AYAR Food Delivery to use your location for accurate food delivery to your address',
        isAndroidBackgroundLocationEnabled: false,
      },
      notification: {
        icon: './assets/images/android-icon-monochrome.png',
        color: '#C41E26',
      },
      usesCleartextTraffic: true,
      jsEngine: 'hermes',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.ayar.food',
      appleTeamId: '3A4VP86PL8', // Linked your verified Apple Team ID
      icon: './assets/images/splash-screen.jpg',
      infoPlist: {
            "ITSAppUsesNonExemptEncryption": false,
        NSCameraUsageDescription: 'We need access to your camera to take photos.',
        NSPhotoLibraryUsageDescription: 'We need access to your photo library to select images.',
        NSPhotoLibraryAddUsageDescription: 'We need permission to save photos to your photo library.',
        NSLocationWhenInUseUsageDescription: 'We need your location to deliver food to your exact address. This app only accesses location when the app is open and in use.',
        UIBackgroundModes: ['fetch', 'remote-notification'], // Required for background iOS push handling
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
      [
        'expo-build-properties',
        {
          android: {
            buildArchs: ['arm64-v8a', 'armeabi-v7a'],
            minSdkVersion: 26,
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            packagingOptions: {
              pickFirst: ['lib/x86/libc++_shared.so', 'lib/x86_64/libc++_shared.so', 'lib/armeabi-v7a/libc++_shared.so', 'lib/arm64-v8a/libc++_shared.so'],
              exclude: ['**/x86/**', '**/x86_64/**'],
            },
          },
          ios: {
            useFrameworks: 'static',
          },
        },
      ],
      ...(hasGoogleServices ? ['./plugins/withFirebase'] : []),
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
      [
        'expo-notifications',
        {
          icon: './assets/images/splash-screen.jpg',
          color: '#C41E26',
          sounds: [],
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    jsEngine: 'hermes',
    extra: {
      router: {},
      eas: {
        projectId: '8c7d7420-9fbc-4cf3-a4b9-a23023b81d37'
      },
      mapTilerKey: process.env.EXPO_PUBLIC_MAPTILER_KEY || '5MOQerQLiYgmkWeWHRd7',
      locationIqKey: process.env.EXPO_PUBLIC_LOCATION_IQ_TOKEN || 'pk.ac03476010699238dcadcb4f0eb9a998',
      // OneSignal App ID - CRITICAL for push notifications
      onesignalAppId: process.env.ONESIGNAL_APP_ID || process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID || '38e20d47-839b-4944-8455-daf65977aaf9',
    },
    owner: 'slliman',
    runtimeVersion: '1.0.9',
    updates: {
      url: 'https://u.expo.dev/8c7d7420-9fbc-4cf3-a4b9-a23023b81d37',
      fallbackToCacheTimeout: 30000,
    },
  });
};
