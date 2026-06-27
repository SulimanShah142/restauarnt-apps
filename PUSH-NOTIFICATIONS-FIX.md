# 🔴 CRITICAL: Push Notifications Not Working - FIX

## Problem
Users are marked as "subscribed" but have **no push token** (`hasPushToken: false`).
This means OneSignal cannot send notifications because it doesn't have the FCM (Firebase Cloud Messaging) token.

## Root Cause
Firebase Cloud Messaging (FCM) is not configured for the Android apps.

## Solution

### Step 1: Create Firebase Project (if you haven't already)

1. Go to https://console.firebase.google.com/
2. Click "Add project" or select existing project
3. Follow the setup wizard

### Step 2: Add Android Apps to Firebase

For EACH app (userapp, deliverapp, admins-app):

1. In Firebase Console, click "Add app" → Android
2. Enter the Android package name:
   - **userapp**: `com.ayar.user` (check your app.config.js)
   - **deliverapp**: `com.ayar.delivery` (check your app.config.js)
   - **admins-app**: `com.ayar.admin` (check your app.config.js)
3. Download `google-services.json`
4. Place the file in the app's root directory:
   - `userapp/google-services.json`
   - `deliverapp/google-services.json`
   - `admins-app/google-services.json`

### Step 3: Enable Cloud Messaging in Firebase

For each app in Firebase Console:
1. Go to Project Settings → Your apps
2. Scroll to "Firebase Cloud Messaging API (FCM)"
3. Ensure it's enabled
4. Copy the **Server key** and **Sender ID**

### Step 4: Configure OneSignal with Firebase

1. Go to OneSignal Dashboard → Your App → Settings
2. Scroll to "Google Cloud Messaging"
3. Enter:
   - **Sender ID**: (from Firebase)
   - **Server Key**: (from Firebase)
4. Save

### Step 5: Update App Configuration

Make sure each app's `app.config.js` or `app.config.ts` has the Firebase plugin:

```javascript
plugins: [
  // ... other plugins
  './plugins/withFirebase', // Only if google-services.json exists
]
```

### Step 6: Rebuild the Apps

```bash
# For each app
cd userapp
npx expo prebuild --clean
npx expo run:android

# OR build production
npx eas build --platform android --profile production
```

### Step 7: Fix Database Trigger 401 Error

Run the SQL script in Supabase SQL Editor:
```sql
-- File: supabase/FIX-401-ERROR.sql
```

This updates the service role key used by the database trigger to call the edge function.

### Step 8: Test Notifications

1. Install the app on a physical device (not emulator)
2. Grant notification permissions when prompted
3. Check logs for:
   ```
   [OneSignal] ✅ Successfully subscribed user
   [OneSignal] Post-Init Status: { hasPushToken: true, ... }
   ```
4. Create a test order
5. Check if notification is received

## Verification Checklist

- [ ] Firebase project created
- [ ] `google-services.json` added to each app
- [ ] FCM enabled in Firebase
- [ ] OneSignal configured with Firebase credentials
- [ ] Apps rebuilt with Firebase configuration
- [ ] Database trigger 401 error fixed
- [ ] Users show `hasPushToken: true` in logs
- [ ] Test notifications received

## Common Issues

### "hasPushToken: false"
- Firebase not configured correctly
- Missing `google-services.json`
- App not rebuilt after adding Firebase

### "All included players are not subscribed"
- User denied notification permission
- OneSignal subscription out of sync
- Run `ensureOneSignalSubscribed()` to re-subscribe

### 401 Error on Edge Function
- Service role key expired/incorrect
- Run `FIX-401-ERROR.sql` to update

## Additional Resources

- OneSignal FCM Setup: https://documentation.onesignal.com/docs/generate-a-google-server-api-key
- Firebase Setup: https://firebase.google.com/docs/android/setup
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
