# OneSignal Push Notifications - Final Fix

## Problem
OneSignal is opting in but `optedIn: false` and no tokens are generated. This is because Firebase FCM is not properly integrated in the native Android build.

## Root Cause
- `google-services.json` exists in all three app directories ✅
- Firebase plugin (`withFirebase`) is configured ✅
- **BUT the native Android build doesn't have Firebase FCM integrated yet** ❌

## Solution: Rebuild All Three Apps

### Step 1: Clean and Rebuild (REQUIRED)

Run these commands in order:

```bash
# USERAPP
cd C:\Users\Administrator\restaurant-app\userapp
npx expo prebuild --clean
npx expo run:android

# DELIVERAPP
cd C:\Users\Administrator\restaurant-app\deliverapp
npx expo prebuild --clean
npx expo run:android

# ADMINS-APP
cd C:\Users\Administrator\restaurant-app\admins-app
npx expo prebuild --clean
npx expo run:android
```

### Step 2: Verify Firebase Integration

After prebuild, check that these files exist:

```
userapp/android/app/google-services.json       ✅ Should exist
userapp/android/app/build.gradle               ✅ Should have 'com.google.gms.google-services'
userapp/android/build.gradle                   ✅ Should have Google Services classpath
```

### Step 3: Test Push Notifications

1. Install the rebuilt app on your device
2. Log in
3. Check logs - you should see:
   - `[OneSignal] Subscription changed:` with `optedIn: true`
   - `[OneSignal] ✅ Tokens ready after X seconds`
   - `[OneSignal] OneSignal ID: xxx...`
   - `[OneSignal] Push Token: xxx...`

## If Still Not Working

### Check SHA-256 Fingerprint in Firebase Console

1. Get your keystore SHA-256:
```bash
cd userapp/android
./gradlew signingReport
```

2. Add the SHA-256 to Firebase Console:
   - Go to: https://console.firebase.google.com/project/ayar-mobile-apps/settings/general/android:1:556730281073:android:9968793e39d5f34f2cffd0
   - Add SHA-256 fingerprint from the signing report

### Check OneSignal Configuration

1. Go to OneSignal Dashboard
2. Verify App ID matches:
   - userapp: `38e20d47-839b-4944-8455-daf65977aaf9`
   - deliverapp: `da1609d1-cebc-47a1-9b0c-4d797997344c`
   - admins-app: `2665a069-40cb-4335-8af1-0f4d8b77aeea`

3. In OneSignal → Settings → Web Push:
   - Ensure "Use Firebase Cloud Messaging" is enabled
   - Upload your `google-services.json` if prompted

## Expected Log Output (After Fix)

```
[OneSignal] === Starting Token Sync ===
[OneSignal] Before opt-in: { optedIn: false, subscribed: false }
[OneSignal] Opting in to push notifications (fresh)...
[OneSignal] ✅ Opted in - waiting for Firebase to generate tokens...
[OneSignal] Subscription changed: { optedIn: true, subscribed: true }
[OneSignal] After opt-in: { onesignalId: ✅, pushToken: ✅, optedIn: true }
[OneSignal] ✅ Tokens obtained successfully
[OneSignal] OneSignal Subscription ID: xxx-xxx-xxx
[OneSignal] Push Token (FCM/APNs): xxx...
[OneSignal] ✅ profiles table updated successfully
[OneSignal] ✅ onesignal_players table updated successfully
```

## Key Changes Made

1. **Removed `optIn()` from initialization** - Now only called on login
2. **Added subscription observer** - Tracks state changes in real-time
3. **Added detailed logging** - Shows before/after opt-in state
4. **Fixed Expo project IDs** - All three apps now have correct IDs
5. **Added 3-second wait** - Gives Firebase time to generate tokens

## Important Notes

- **You MUST rebuild** - The native code needs Firebase FCM libraries
- **Clean prebuild is required** - `--clean` flag ensures fresh build
- **First build takes time** - Gradle downloads Firebase dependencies
- **Test on real device** - Emulator may not have Google Play Services
