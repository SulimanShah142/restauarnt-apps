# OneSignal & Firebase Configuration Guide

## Problem: OneSignal Not Generating Subscription ID

The issue is that **OneSignal v5 requires proper native configuration** that gets baked into the app during `prebuild`. Without this, the SDK can't initialize properly.

---

## How OneSignal & Firebase Work in Expo

### 1. Configuration Flow

```
app.config.js/ts (Your config)
    ↓
expo prebuild (Generates native Android/iOS files)
    ↓
android/app/google-services.json (Copied by Expo)
android/AndroidManifest.xml (Modified with OneSignal metadata)
android/build.gradle (Modified with OneSignal SDK)
    ↓
APK/AAB Build (Final app with OneSignal baked in)
```

### 2. Key Configuration Points

#### A. `googleServicesFile` in app.config
This tells Expo where to find your Firebase config. Expo will:
- Copy `google-services.json` to `android/app/google-services.json` during prebuild
- Modify `android/build.gradle` to include the Google Services plugin
- This is **REQUIRED** for Firebase Cloud Messaging (FCM) which OneSignal uses

#### B. `onesignal-expo-plugin` in app.config
This tells Expo to:
- Add OneSignal SDK to `android/build.gradle`
- Add OneSignal metadata to `AndroidManifest.xml`
- Configure the native OneSignal initialization

#### C. Environment Variables
- `ONESIGNAL_APP_ID` in `.env` → Used by JavaScript code
- `onesignalAppId` in `app.config.extra` → Used by native code

---

## Fixed Configuration for All Three Apps

### User App (userapp/app.config.js)

```javascript
const { ExpoConfig } = require('expo/config');
require('dotenv/config');
const fs = require('fs');
const path = require('path');

// Check if google-services.json exists
const googleServicesPath = path.resolve(__dirname, 'google-services.json');
const hasGoogleServices = fs.existsSync(googleServicesPath);

module.exports = ({ config }) => ({
  ...config,
  name: 'AYAR Food Delivery',
  slug: 'ayar-food-delivery',
  version: '1.0.2',
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
    // CRITICAL: This copies google-services.json to android/app/ during prebuild
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
      locationAlwaysAndWhenInUsePermission: 'Allow AYAR Food Delivery to use your location',
      isAndroidBackgroundLocationEnabled: false,
    },
    notification: {
      icon: './assets/images/android-icon-monochrome.png',
      color: '#C41E26',
    },
    usesCleartextTraffic: true,
  },
  plugins: [
    'expo-router',
    'expo-web-browser',
    'expo-location',
    'expo-sqlite',
    'expo-system-ui',
    'expo-dev-client',
    'expo-notifications',
    // Firebase plugin (only if google-services.json exists)
    ...(hasGoogleServices ? ['./plugins/withFirebase'] : []),
    // OneSignal Plugin - REQUIRED for push notifications
    [
      'onesignal-expo-plugin',
      {
        mode: 'production', // Use 'production' for real builds
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
  extra: {
    router: {},
    eas: {
      projectId: 'e6467c5c-fc6a-4ec8-b512-feb4045a4582',
    },
    mapTilerKey: process.env.EXPO_PUBLIC_MAPTILER_KEY || '5MOQerQLiYgmkWeWHRd7',
    locationIqKey: process.env.EXPO_PUBLIC_LOCATION_IQ_TOKEN || 'pk.ac03476010699238dcadcb4f0eb9a998',
    // CRITICAL: OneSignal App ID for native code
    onesignalAppId: process.env.ONESIGNAL_APP_ID || '38e20d47-839b-4944-8455-daf65977aaf9',
  },
  runtimeVersion: '1.0.2',
  updates: {
    enabled: true,
    url: 'https://u.expo.dev/e6467c5c-fc6a-4ec8-b512-feb4045a4582',
  },
});
```

### Admin App (admins-app/app.config.ts)

```typescript
import { ExpoConfig, ConfigContext } from 'expo/config';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const googleServicesPath = path.resolve(__dirname, 'google-services.json');
const hasGoogleServices = fs.existsSync(googleServicesPath);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'AYAR Admin',
  slug: 'ayar-admin',
  version: '1.0.0',
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
    // CRITICAL: This copies google-services.json to android/app/ during prebuild
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
    androidPermissions: {
      locationAlwaysAndWhenInUsePermission: 'Allow AYAR Admin to use your location',
      isAndroidBackgroundLocationEnabled: true,
    },
    notification: {
      icon: './assets/images/android-icon-monochrome.png',
      color: '#C41E26',
    },
    usesCleartextTraffic: true,
  },
  plugins: [
    'expo-router',
    'expo-web-browser',
    'expo-location',
    'expo-sqlite',
    'expo-system-ui',
    'expo-dev-client',
    'expo-notifications',
    // Firebase plugin (only if google-services.json exists)
    ...(hasGoogleServices ? ['./plugins/withFirebase'] : []),
    // OneSignal Plugin - REQUIRED for push notifications
    [
      'onesignal-expo-plugin',
      {
        mode: 'production', // Use 'production' for real builds
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
  extra: {
    router: {},
    eas: {
      projectId: '839f92d4-f6ba-4122-8143-157d475986c4',
    },
    mapTilerKey: process.env.EXPO_PUBLIC_MAPTILER_KEY || '5MOQerQLiYgmkWeWHRd7',
    locationIqKey: process.env.EXPO_PUBLIC_LOCATION_IQ_TOKEN || 'pk.ac03476010699238dcadcb4f0eb9a998',
    // CRITICAL: OneSignal App ID for native code
    onesignalAppId: process.env.ONESIGNAL_APP_ID || '2665a069-40cb-4335-8af1-0f4d8b77aeea',
  },
  runtimeVersion: '1.0.0',
  updates: {
    enabled: true,
    url: 'https://u.expo.dev/839f92d4-f6ba-4122-8143-157d475986c4',
  },
});
```

### Delivery App (deliverapp/app.config.ts)

```typescript
import { ExpoConfig, ConfigContext } from 'expo/config';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

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
    // CRITICAL: This copies google-services.json to android/app/ during prebuild
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
    androidPermissions: {
      locationAlwaysAndWhenInUsePermission: 'Allow AYAR Delivery to use your location',
      isAndroidBackgroundLocationEnabled: true,
    },
    notification: {
      icon: './assets/images/android-icon-monochrome.png',
      color: '#C41E26',
    },
    usesCleartextTraffic: true,
  },
  plugins: [
    'expo-router',
    'expo-web-browser',
    'expo-location',
    'expo-sqlite',
    'expo-system-ui',
    'expo-dev-client',
    'expo-notifications',
    // Firebase plugin (only if google-services.json exists)
    ...(hasGoogleServices ? ['./plugins/withFirebase'] : []),
    // OneSignal Plugin - REQUIRED for push notifications
    [
      'onesignal-expo-plugin',
      {
        mode: 'production', // Use 'production' for real builds
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
  extra: {
    router: {},
    eas: {
      projectId: '4dacf6ac-71dc-43f6-9d57-c96be6f99426',
    },
    mapTilerKey: process.env.EXPO_PUBLIC_MAPTILER_KEY || '5MOQerQLiYgmkWeWHRd7',
    locationIqKey: process.env.EXPO_PUBLIC_LOCATION_IQ_TOKEN || 'pk.ac03476010699238dcadcb4f0eb9a998',
    // CRITICAL: OneSignal App ID for native code
    onesignalAppId: process.env.ONESIGNAL_APP_ID || 'da1609d1-cebc-47a1-9b0c-4d797997344c',
  },
  runtimeVersion: '1.0.0',
  updates: {
    enabled: true,
    url: 'https://u.expo.dev/4dacf6ac-71dc-43f6-9d57-c96be6f99426',
  },
});
```

---

## Required .env Files

### User App (.env)
```
ONESIGNAL_APP_ID=38e20d47-839b-4944-8455-daf65977aaf9
ONESIGNAL_REST_API_KEY=os_v2_app_...
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

### Admin App (.env)
```
ONESIGNAL_APP_ID=2665a069-40cb-4335-8af1-0f4d8b77aeea
ONESIGNAL_REST_API_KEY=os_v2_app_...
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
ADMIN_EMAIL=Mohammadseyar885@gmail.com
```

### Delivery App (.env)
```
ONESIGNAL_APP_ID=da1609d1-cebc-47a1-9b0c-4d797997344c
ONESIGNAL_REST_API_KEY=os_v2_app_...
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## Build Process (CRITICAL)

After changing app.config, you MUST rebuild:

```bash
# 1. Clean and rebuild native code
npx expo prebuild --clean --platform android

# 2. Run the app
npx expo run:android

# OR build with EAS
eas build --platform android --profile production
```

---

## Verification Steps

### 1. Check google-services.json was copied
```bash
# After prebuild, verify the file exists:
ls admins-app/android/app/google-services.json
```

### 2. Check AndroidManifest.xml has OneSignal
```bash
# Should contain:
<meta-data android:name="com.onesignal.NotificationOpened.DEFAULT" android:value="true"/>
<meta-data android:name="com.onesignal.app_id" android:value="YOUR_APP_ID"/>
```

### 3. Check build.gradle has OneSignal
```bash
# admins-app/android/app/build.gradle should have:
implementation 'com.onesignal:OneSignal:5.+.+
```

### 4. Run app and check logs
```
[OneSignal] Initializing...
[OneSignal] Permission granted: true
[OneSignal] Initialization complete
[OneSignal] Initial subscription status: { onesignalId: "✅ abc12345...", ... }
```

---

## Common Issues

### Issue 1: "google-services.json not found"
**Solution**: Make sure the file exists in the app folder (userapp/, admins-app/, deliverapp/) and the path in app.config is correct.

### Issue 2: OneSignal ID is null
**Solution**: 
1. Run `npx expo prebuild --clean`
2. Make sure `google-services.json` has the correct package name
3. Check Firebase console has SHA-256 fingerprint

### Issue 3: Notifications work from dashboard but not from edge function
**Solution**: This means tokens aren't being saved to database. Run the SQL migration `FIX_ONESIGNAL_TOKEN_REGISTRATION.sql`.

---

## Summary

| Configuration | Purpose | Where |
|--------------|---------|-------|
| `googleServicesFile` | Copies Firebase config to native Android | `app.config.android` |
| `onesignal-expo-plugin` | Adds OneSignal SDK to native build | `app.config.plugins` |
| `onesignalAppId` in extra | Used by JavaScript code | `app.config.extra` |
| `ONESIGNAL_APP_ID` in .env | Environment variable for JS | `.env` file |

**All four must be configured correctly for OneSignal to work!**
