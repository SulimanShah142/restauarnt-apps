# OneSignal Configuration Summary

## ✅ All Three Apps Configured

### OneSignal App IDs

| App | OneSignal App ID | Package Name |
|-----|------------------|--------------|
| **User App** | `38e20d47-839b-4944-8455-daf65977aaf9` | `com.ayar.food` |
| **Admin App** | `2665a069-40cb-4335-8af1-0f4d8b77aeea` | `com.ayar.admin` |
| **Delivery App** | `da1609d1-cebc-47a1-9b0c-4d797997344c` | `com.ayar.delivery` |

---

## Configuration Files Updated

### 1. User App (`userapp/`)

#### `.env` file:
```env
ONESIGNAL_APP_ID=38e20d47-839b-4944-8455-daf65977aaf9
EXPO_PUBLIC_ONESIGNAL_APP_ID=38e20d47-839b-4944-8455-daf65977aaf9
ONESIGNAL_REST_API_KEY=os_v2_app_hdra2r4dtneujbcv3l3fs55k7gio2hf5sgie2y5tfjwqlypyvqilwtzbu7rgqnqgolg7f6e5bmfutm3ggj6xrpbrtxskrxvic4hne2q
```

#### `app.config.js`:
```javascript
extra: {
  // OneSignal App ID from .env - CRITICAL for push notifications
  onesignalAppId: process.env.ONESIGNAL_APP_ID || process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID || '38e20d47-839b-4944-8455-daf65977aaf9',
}
```

---

### 2. Admin App (`admins-app/`)

#### `.env` file:
```env
ONESIGNAL_APP_ID=2665a069-40cb-4335-8af1-0f4d8b77aeea
EXPO_PUBLIC_ONESIGNAL_APP_ID=2665a069-40cb-4335-8af1-0f4d8b77aeea
ONESIGNAL_REST_API_KEY=os_v2_app_ezs2a2kaznbtlcxrb5gyw55o5lt5bxeykghezbn5z6be3nzrqoilwekho5zng5qcnfhdqyvpzae26f4nhrwo3rjq4olyxpbv7wzf4fa
```

#### `app.config.ts`:
```typescript
extra: {
  // OneSignal App ID from .env - CRITICAL for push notifications
  onesignalAppId: process.env.ONESIGNAL_APP_ID || '2665a069-40cb-4335-8af1-0f4d8b77aeea',
}
```

---

### 3. Delivery App (`deliverapp/`)

#### `.env` file:
```env
ONESIGNAL_APP_ID=da1609d1-cebc-47a1-9b0c-4d797997344c
EXPO_PUBLIC_ONESIGNAL_APP_ID=da1609d1-cebc-47a1-9b0c-4d797997344c
ONESIGNAL_REST_API_KEY=os_v2_app_3ilatuooxrd2dgymjv4xtfzujrustcwtsuxuviuguaf7mrv2yspofu6sb3zeshiaud6kkhlo4366h75yhnmnjtxjum4o5jkyn5muwei
```

#### `app.config.ts`:
```typescript
extra: {
  // OneSignal App ID from .env - CRITICAL for push notifications
  onesignalAppId: process.env.ONESIGNAL_APP_ID || 'da1609d1-cebc-47a1-9b0c-4d797997344c',
}
```

---

## How Configuration Works

### Flow:
```
.env file (ONESIGNAL_APP_ID)
    ↓
app.config.js (process.env.ONESIGNAL_APP_ID)
    ↓
expo prebuild (bakes into native Android/iOS code)
    ↓
android/app/google-services.json (Firebase config)
android/AndroidManifest.xml (OneSignal metadata)
    ↓
APK/AAB Build (Final app with OneSignal configured)
```

### Environment Variable Priority:
```javascript
process.env.ONESIGNAL_APP_ID || 
process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID || 
'fallback-hardcoded-app-id'
```

---

## Required Steps After Configuration

### 1. Clean and Rebuild Native Code
```bash
# User App
cd userapp
npx expo prebuild --clean --platform android
npx expo run:android

# Admin App
cd admins-app
npx expo prebuild --clean --platform android
npx expo run:android

# Delivery App
cd deliverapp
npx expo prebuild --clean --platform android
npx expo run:android
```

### 2. Verify Configuration
After running `prebuild`, check these files exist:

```bash
# User App
ls userapp/android/app/google-services.json
ls userapp/android/app/build.gradle  # Should have OneSignal dependency

# Admin App
ls admins-app/android/app/google-services.json
ls admins-app/android/app/build.gradle  # Should have OneSignal dependency

# Delivery App
ls deliverapp/android/app/google-services.json
ls deliverapp/android/app/build.gradle  # Should have OneSignal dependency
```

### 3. Check AndroidManifest.xml
Should contain:
```xml
<meta-data android:name="com.onesignal.app_id" android:value="YOUR_APP_ID"/>
```

### 4. Check build.gradle
Should contain:
```gradle
implementation 'com.onesignal:OneSignal:5.+.+'
```

---

## Testing OneSignal

### 1. Run the app and check logs:
```
[OneSignal] Initializing...
[OneSignal] Permission granted: true
[OneSignal] Initialization complete
[OneSignal] Initial subscription status: { 
  onesignalId: "✅ abc12345-6789-abcd-efgh-ijklmnopqrst",
  pushToken: "✅ fCM_Token_...",
  subscribed: true,
  optedIn: true
}
```

### 2. Verify in Supabase:
```sql
-- Check if tokens are being saved
SELECT 
  op.user_id,
  op.app_type,
  op.onesignal_player_id,
  op.created_at,
  p.email as user_email
FROM onesignal_players op
LEFT JOIN profiles p ON p.id = op.user_id
ORDER BY op.created_at DESC
LIMIT 10;
```

### 3. Test Notification from Edge Function:
```sql
-- Trigger a test notification
UPDATE orders 
SET status = 'confirmed' 
WHERE id = 'your-order-id'
  AND status = 'pending';
```

Then check edge function logs in Supabase dashboard.

---

## Common Issues & Solutions

### Issue 1: `ONESIGNAL_APP_ID` not found
**Error**: `undefined is not a valid OneSignal App ID`

**Solution**: 
1. Check `.env` file exists in the app folder
2. Run `npx expo prebuild --clean`
3. Restart the Metro bundler with cache: `npx expo start -c`

### Issue 2: Subscription ID is null
**Error**: `[OneSignal] Initial subscription status: { onesignalId: null, ... }`

**Solution**:
1. Make sure `google-services.json` exists in the app folder
2. Check Firebase console has correct SHA-256 fingerprint
3. Run `npx expo prebuild --clean --platform android`
4. Rebuild the app: `npx expo run:android`

### Issue 3: Notifications work from dashboard but not edge function
**Solution**: Run the SQL migration `FIX_ONESIGNAL_TOKEN_REGISTRATION.sql` to fix RLS policies.

---

## Summary

✅ **All three apps now have:**
- OneSignal App IDs in `.env` files
- Environment variables referenced in `app.config.js/ts`
- `EXPO_PUBLIC_ONESIGNAL_APP_ID` for Expo to read directly
- OneSignal plugin configured with `mode: 'production'`
- Firebase/Google Services configuration

✅ **Next Steps:**
1. Run `npx expo prebuild --clean --platform android` for all three apps
2. Run the apps: `npx expo run:android`
3. Log in and check console logs for OneSignal initialization
4. Verify tokens are saved in Supabase
5. Test notifications from edge function
