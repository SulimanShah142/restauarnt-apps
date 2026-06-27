# 🔔 Push Notifications Setup Guide - Expo 54 + OneSignal v5

## ✅ What Was Fixed

1. **Added OneSignal Expo Plugin** to all three app.config files
2. **Updated OneSignal initialization code** to use proper v5 API
3. **Added proper push token logging** to debug issues

## 📋 Step-by-Step Setup

### Step 1: Install OneSignal Expo Plugin (if not already installed)

For EACH app, run:

```bash
cd userapp
npm install onesignal-expo-plugin --save-dev

cd ../deliverapp
npm install onesignal-expo-plugin --save-dev

cd ../admins-app
npm install onesignal-expo-plugin --save-dev
```

### Step 2: Download google-services.json from Firebase

1. Go to https://console.firebase.google.com/
2. Select your Firebase project (or create one)
3. Click "Add app" → Android for EACH app:

   **userapp:**
   - Package name: `com.ayar.food`
   
   **deliverapp:**
   - Package name: `com.ayar.delivery`
   
   **admins-app:**
   - Package name: `com.ayar.admin`

4. Download `google-services.json` for each app
5. Place in app root directories:
   - `userapp/google-services.json`
   - `deliverapp/google-services.json`
   - `admins-app/google-services.json`

### Step 3: Add SHA-256 Fingerprint to Firebase

This is CRITICAL for push tokens to work!

```bash
# For each app, get the SHA-256 fingerprint
cd userapp
keytool -list -v -keystore ~/.android/debug.keystore -alias debug -storepass android -keypass android

# Or for production keystore:
keytool -list -v -keystore /path/to/keystore.jks -alias your-alias
```

Then:
1. Go to Firebase Console → Project Settings → Your apps
2. Click "Add fingerprint"
3. Paste the SHA-256 hash
4. Save

### Step 4: Configure OneSignal with Firebase

1. Go to OneSignal Dashboard → Your App → Settings
2. Scroll to "Google Cloud Messaging"
3. Enter:
   - **Sender ID**: (from Firebase Console → Project Settings → Cloud Messaging)
   - **Server Key**: (from Firebase Console → Project Settings → Cloud Messaging)
4. Save for ALL THREE apps

### Step 5: Rebuild Apps

```bash
# For EACH app
cd userapp
npx expo prebuild --clean
npx expo run:android

# OR build production
npx eas build --platform android --profile production
```

### Step 6: Fix Database Triggers (Supabase)

Run in Supabase SQL Editor:

```sql
-- File: supabase/CHECK-AND-FIX-TRIGGERS-FINAL.sql
```

This will:
- Recreate notification triggers
- Fix 401 authentication errors
- Log when triggers fire

### Step 7: Test Push Tokens

1. Open each app on a physical device (not emulator)
2. Grant notification permissions when prompted
3. Check console logs for:

```
[OneSignal] ✅ User is subscribed with push token
[OneSignal] Post-Init Status: {
  isSubscribed: true,
  hasPushToken: true,
  pushToken: "eXmPl3T0k3n...",
  onesignalId: "abc-123-..."
}
```

### Step 8: Test Notifications

1. Sign in to userapp
2. Create a test order
3. Check Supabase logs for "Calling edge function"
4. Check OneSignal dashboard for notification delivery
5. User should receive notification

## 🔍 Debugging Checklist

### Push Token is null/none

- [ ] google-services.json exists in app root
- [ ] SHA-256 fingerprint added to Firebase
- [ ] Firebase project linked to OneSignal
- [ ] App rebuilt after adding Firebase config
- [ ] Running on physical device (not emulator)

### "All players are not subscribed"

- [ ] User granted notification permission
- [ ] OneSignal subscription status is true
- [ ] Push token exists in database
- [ ] Run `ensureOneSignalSubscribed()` to re-subscribe

### Triggers not firing

- [ ] Run CHECK-AND-FIX-TRIGGERS-FINAL.sql
- [ ] Check Supabase logs for "Calling edge function"
- [ ] Verify pg_net extension is installed
- [ ] Check service role key is correct

### 401 Error on Edge Function

- [ ] Service role key is correct in SQL trigger
- [ ] Run FIX-401-ERROR.sql
- [ ] Edge function is deployed (check with `npx supabase functions list`)

## 📱 App IDs Reference

| App | OneSignal App ID | Package Name |
|-----|------------------|--------------|
| userapp | `38e20d47-839b-4944-8455-daf65977aaf9` | `com.ayar.food` |
| deliverapp | `da1609d1-cebc-47a1-9b0c-4d79797997344c` | `com.ayar.delivery` |
| admins-app | `2665a069-40cb-4335-8af1-0f4d8b77aeea` | `com.ayar.admin` |

## 🧪 Test Script

Run this in Supabase SQL Editor to test notifications:

```sql
-- Test edge function directly
SELECT net.http_post(
  url := 'https://gjyipzhhgxgumgbnpikg.supabase.co/functions/v1/send-onesignal-notification',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
  ),
  body := jsonb_build_object(
    'record', jsonb_build_object(
      'id', 'test-123',
      'order_number', 'TEST-001',
      'user_id', 'YOUR_USER_ID',
      'status', 'confirmed',
      'total_amount', 100
    ),
    'table', 'orders',
    'type', 'UPDATE'
  ),
  timeout_milliseconds := 10000
) as response;
```

## 📞 Support Resources

- OneSignal Expo Docs: https://documentation.onesignal.com/docs/expo
- OneSignal v5 Migration: https://documentation.onesignal.com/docs/react-native-sdk-setup
- Firebase Setup: https://firebase.google.com/docs/android/setup
- Supabase pg_net: https://supabase.com/docs/guides/functions/using-pg-net
