import 'dotenv/config';

export default ({ config }: any): any => ({
  ...config,
  name: 'AYAR Admin',
  slug: 'ayar-admin',
  version: '1.0.2',
  orientation: 'portrait',
  icon: './assets/images/splash-screen.jpg',
  scheme: 'ayaradmin',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/images/splash-screen.jpg',
    resizeMode: 'contain',
    backgroundColor: '#C41E26',
  },
  android: {
    package: 'com.ayar.admin',
    // Ensure google-services.json sits in your root folder
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
    // @ts-ignore
    androidPermissions: {
      locationAlwaysAndWhenInUsePermission: 'Allow AYAR Admin to use your location for restaurant management',
      isAndroidBackgroundLocationEnabled: true,
    },
    // @ts-ignore
    notification: {
      icon: './assets/images/android-icon-monochrome.png',
      color: '#C41E26',
    },
    usesCleartextTraffic: true,
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.ayar.admin',
    appleTeamId: '3A4VP86PL8',
    icon: './assets/images/splash-screen.jpg',
    infoPlist: {
      "ITSAppUsesNonExemptEncryption": false,
      NSCameraUsageDescription: 'We need access to your camera to take photos.',
      NSPhotoLibraryUsageDescription: 'We need access to your photo library to select images.',
      NSPhotoLibraryAddUsageDescription: 'We need permission to save photos to your photo library.',
      NSLocationWhenInUseUsageDescription: 'We need your location to track deliveries and show your current location to customers.',
      NSLocationAlwaysAndWhenInUseUsageDescription: 'We need your location to track deliveries even when the app is in the background or closed.',
      NSLocationAlwaysUsageDescription: 'We need your location to track deliveries even when the app is in the background.',
      UIBackgroundModes: ['location', 'fetch', 'remote-notification'],
    },
  },
  web: {
    favicon: './assets/images/splash-screen.jpg',
  },
  plugins: [
    'expo-router',
    'expo-web-browser',
    'expo-location',
    'expo-sqlite',
    'expo-system-ui',
    // OneSignal Plugin configured for production app builds
    [
      'onesignal-expo-plugin',
      {
        mode: 'production',
        sounds: ['./assets/sounds/notification_sound.wav'],
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
      projectId: 'b0480803-b4df-4f9e-b926-eb8af0179df4',
    },
    mapTilerKey: process.env.EXPO_PUBLIC_MAPTILER_KEY || '5MOQerQLiYgmkWeWHRd7',
    locationIqKey: process.env.EXPO_PUBLIC_LOCATION_IQ_TOKEN || 'pk.ac03476010699238dcadcb4f0eb9a998',
    onesignalAppId: process.env.ONESIGNAL_APP_ID || process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID || '2665a069-40cb-4335-8af1-0f4d8b77aeea',
  },
  owner: 'slliman',
  runtimeVersion: '1.0.3',
  updates: {
    url: "https://expo.dev/b0480803-b4df-4f9e-b926-eb8af0179df4"
  }
});
