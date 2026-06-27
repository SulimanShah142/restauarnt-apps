# UserApp Development Build - Debugging Guide

## ✅ Changes Applied

All critical files now have comprehensive logging and error handling:

### Files Updated:
1. **lib/supabase.ts** - Supabase client initialization logging
2. **contexts/AuthContext.tsx** - Auth state checks, session validation, refresh logic
3. **contexts/DatabaseContext.tsx** - Database initialization with error stack traces
4. **contexts/CartContext.tsx** - All cart actions (add, remove, update, clear)
5. **contexts/BadgeContext.tsx** - Badge loading, notification handling
6. **app/_layout.tsx** - App initialization steps
7. **app/index.tsx** - Root redirect
8. **app/auth-check.tsx** - Session checks and redirect decisions
9. **app/(auth)/sign-up.tsx** - Validation, signup process, navigation
10. **database.ts** - Database initialization flow

### Log Format:
All logs use a consistent format with `[Module]` prefix:
- `✅` for success
- `❌` for errors
- `⚠️` for warnings

## 🔨 Build Commands

### Option 1: Local Development Build (Recommended for Testing)

```powershell
cd C:\Users\Administrator\restaurant-app\userapp

# 1. Clean native folders
rmdir /s /q android
rmdir /s /q ios

# 2. Prebuild with clean
npx expo prebuild --clean

# 3. Build locally
npx expo run:android --variant Release
```

### Option 2: EAS Build (Remote)

```powershell
cd C:\Users\Administrator\restaurant-app\userapp

# Development build
eas build --profile development --platform android --local

# Or production build
eas build --profile production --platform android
```

## 📱 Viewing Logs

### Android Device/Emulator:

```powershell
# Filter logs for your app
adb logcat | Select-String -Pattern "Supabase|AuthContext|Database|Cart|Badge|UserApp"

# Or use a less restrictive filter
adb logcat | Select-String -Pattern "\[.*\]"

# Clear logcat before starting
adb logcat -c
```

### React Native Debugger:

```bash
# Start Metro bundler with logs
npx expo start

# Press 'o' to open in browser or 'a' for Android
```

## 🐛 What to Look For

### 1. App Startup Sequence:
```
[Index] Rendering, redirecting to auth-check
[UserAppLayout] Initializing app...
[UserAppLayout] ✅ AsyncStorage ready
[UserAppLayout] Initializing Supabase...
[Supabase] Initializing client...
[Supabase] ✅ Client created successfully
[UserAppLayout] ✅ Supabase ready, session: false/true
```

### 2. Auth Flow:
```
[AuthContext] useEffect: Initial auth check...
[AuthContext] checkAuth: Starting auth check...
[AuthContext] checkAuth: Session found: true/false
[AuthCheck] useEffect: Checking session...
[AuthCheck] Session found: true/false
```

### 3. Database Initialization:
```
[Database] Module loaded
[Database] getDatabase called, cached: false
[Database] Initializing platform database...
[UserAppDB-Context] Initializing database...
[UserAppDB-Context] ✅ Database initialized successfully
```

### 4. Cart Operations:
```
[CartReducer] Action: ADD_ITEM payload: {...}
[CartReducer] Adding new item to cart
[CartProvider] addItem: Burger
```

### 5. Error Patterns:
```
[ModuleName] ❌ Error: <message>
[ModuleName] Error stack: <stack trace>
```

## 🚨 Common Issues & Solutions

### Issue 1: App Crashes Immediately
**Look for:** `[UserAppLayout] ❌ Initialization error:`
**Solution:** Check the error stack trace that follows

### Issue 2: Database Not Initializing
**Look for:** `[UserAppDB-Context] ❌ Failed to initialize database:`
**Solution:** Check if Expo SQLite is properly installed

### Issue 3: Auth Not Working
**Look for:** `[AuthContext] checkAuth: Session error:`
**Solution:** Verify Supabase credentials and network connection

### Issue 4: Silent Rollback (Old Code Loading)
**Look for:** No new logs appearing after rebuild
**Solution:** 
1. Uninstall app completely from device
2. Delete android/ios folders
3. Rebuild with `--clear-cache`

### Issue 5: Navigation Errors
**Look for:** `[ModuleName] Navigation error:`
**Solution:** Ensure navigation is ready before redirecting

## 📊 Expected Log Flow (Successful Startup)

```
1. [Index] Rendering, redirecting to auth-check
2. [Supabase] Initializing client...
3. [Supabase] ✅ Client created successfully
4. [UserAppLayout] Initializing app...
5. [UserAppLayout] ✅ AsyncStorage ready
6. [UserAppLayout] ✅ Supabase ready
7. [UserAppLayout] ✅ OneSignal initialized
8. [UserAppLayout] ✅ App initialization complete
9. [AuthContext] useEffect: Initial auth check...
10. [Database] Module loaded
11. [UserAppDB-Context] Initializing database...
12. [UserAppDB-Context] ✅ Database initialized successfully
13. [AuthCheck] useEffect: Checking session...
14. [AuthCheck] Session found: true/false
15. Redirect to menu or sign-in
```

## 🛠 Debugging Tips

1. **Clear logs before each test:**
   ```powershell
   adb logcat -c
   ```

2. **Save logs to file:**
   ```powershell
   adb logcat > logs.txt
   ```

3. **Filter by tag:**
   ```powershell
   adb logcat -s ReactNative:* UserAppDB-Context:* AuthContext:*
   ```

4. **Look for the first ❌** - This is usually where the problem starts

5. **Check timing** - Logs should appear in sequence within 2-3 seconds

## 📝 After Testing

Once you've identified and fixed any issues:
1. Remove or reduce console.log statements for production
2. Keep error logging (console.error) for monitoring
3. Rebuild with production profile

## 🎯 Next Steps

1. Run the build command
2. Install the APK on your device
3. Run `adb logcat` to watch logs in real-time
4. Test all flows (signup, login, menu, cart, orders)
5. Report any errors you see
