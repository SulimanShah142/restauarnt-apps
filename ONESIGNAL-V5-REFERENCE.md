# OneSignal v5 API Reference - Correct Commands

## ✅ Correct OneSignal v5 Commands

### 1. Get Push Token
```javascript
// ✅ CORRECT (v5) - It's a PROPERTY, not a function
const token = OneSignal.User.pushSubscription.token;

// ❌ WRONG (v4) - Don't use parentheses
// const token = OneSignal.User.pushSubscription.getPushToken();
```

### 2. Set External User ID
```javascript
// ✅ CORRECT (v5) - Use login()
OneSignal.login("user-id");

// OR use our wrapper function
import { setExternalUserId } from '@/utils/onesignal';
setExternalUserId("user-id");

// ❌ WRONG (v4)
// OneSignal.setExternalUserId("user-id");
```

### 3. Get OneSignal ID
```javascript
// ✅ CORRECT (v5) - It's a PROPERTY
const id = OneSignal.User.getOnesignalId();
// OR
const id = OneSignal.User.pushSubscription.id;

// ❌ WRONG (v4)
// OneSignal.User.pushSubscription.getOnesignalId();
```

### 4. Clear External User ID
```javascript
// ✅ CORRECT (v5) - Use logout()
OneSignal.logout();

// OR use our wrapper function
import { clearExternalUserId } from '@/utils/onesignal';
clearExternalUserId();

// ❌ WRONG (v4)
// OneSignal.setExternalUserId(null);
```

### 5. Check Subscription Status
```javascript
// ✅ CORRECT (v5)
const isSubscribed = await OneSignal.User.pushSubscription.getOptedInAsync();

// ❌ WRONG (v4)
// const isSubscribed = await OneSignal.getSubscription();
```

### 6. Opt-In to Push Notifications
```javascript
// ✅ CORRECT (v5)
await OneSignal.User.pushSubscription.optIn();

// ❌ WRONG (v4)
// OneSignal.setSubscription(true);
```

### 7. Request Permission
```javascript
// ✅ CORRECT (v5)
const granted = await OneSignal.Notifications.requestPermission(true);

// ❌ WRONG (v4)
// OneSignal.promptForPushNotificationsWithUserResponse();
```

### 8. Check Native Permission
```javascript
// ✅ CORRECT (v5)
const hasPermission = await OneSignal.Notifications.permissionNative();

// ❌ WRONG (v4)
// OneSignal.getPermissionState();
```

## 📋 Complete Registration Example (v5)

```javascript
import { OneSignal } from 'react-native-onesignal';

export const registerPushToken = async (userId: string) => {
  try {
    console.log("Starting v5 registration for:", userId);

    // 1. Identify the user (Replaces setExternalUserId)
    OneSignal.login(userId);

    // 2. Ensure they are opted in
    OneSignal.User.pushSubscription.optIn();

    // 3. Get IDs (Note: no parentheses, these are properties)
    const pushToken = OneSignal.User.pushSubscription.token;
    const osId = OneSignal.User.pushSubscription.id;

    if (pushToken) {
      console.log("✅ Push Token found:", pushToken);
      // Send to your backend here
    } else {
      console.log("⏳ Token not ready yet. OneSignal is likely still handshaking with Google.");
    }
  } catch (error) {
    console.error("OneSignal v5 Error:", error);
  }
};
```

## 🔍 Debugging Checklist

### Push Token is null/none
- [ ] google-services.json exists in app root
- [ ] SHA-256 fingerprint added to Firebase
- [ ] Firebase project linked to OneSignal
- [ ] App rebuilt after adding Firebase config
- [ ] Running on physical device (not emulator)
- [ ] User granted notification permission (Android 13+)

### "All players are not subscribed"
- [ ] User granted notification permission
- [ ] OneSignal subscription status is true
- [ ] Push token exists in database
- [ ] Run `ensureOneSignalSubscribed()` to re-subscribe

### TypeError: getPushToken is not a function
- [ ] You're using v4 syntax with v5 SDK
- [ ] Change `getPushToken()` to `.token` (property)

### TypeError: setExternalUserId is not a function
- [ ] You're using v4 syntax with v5 SDK
- [ ] Change `setExternalUserId()` to `OneSignal.login()`
- [ ] Or use our wrapper: `setExternalUserId()` from utils/onesignal.ts

## 📱 App IDs Reference

| App | OneSignal App ID | Package Name |
|-----|------------------|--------------|
| userapp | `38e20d47-839b-4944-8455-daf65977aaf9` | `com.ayar.food` |
| deliverapp | `da1609d1-cebc-47a1-9b0c-4d797997344c` | `com.ayar.delivery` |
| admins-app | `2665a069-40cb-4335-8af1-0f4d8b77aeea` | `com.ayar.admin` |

## 🧪 Expected Logs (Success)

```
[OneSignal] Initializing with App ID: da1609d1-cebc-47a1-9b0c-4d797997344c
[OneSignal] Requesting notification permission...
[OneSignal] Permission granted: true
[OneSignal] Permission granted, opting in to push...
[OneSignal] Push subscription available, checking status...
[OneSignal] Post-Init Status: {
  isSubscribed: true,
  hasPushToken: true,
  pushToken: "eXmPl3T0k3nFr0mFCM...",
  onesignalId: "abc-123-def-456..."
}
[OneSignal] ✅ User is subscribed with push token
```

## 📞 Support Resources

- OneSignal v5 Docs: https://documentation.onesignal.com/docs/react-native-sdk-setup
- OneSignal v5 Migration: https://documentation.onesignal.com/docs/react-native-onesignalv5-migration-guide
- Firebase Setup: https://firebase.google.com/docs/android/setup
