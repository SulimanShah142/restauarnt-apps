# APK Size Optimization Guide

## Current Issue: 140MB APKs (Should be 35-50MB)

## Step 1: Check What's Making APKs Large

### Run this to analyze bundle size:
```bash
cd C:\Users\Administrator\restaurant-app\userapp
npx react-native-bundle-visualizer
```

## Step 2: Common Size Issues & Fixes

### Issue 1: Development Client in Production
**Problem:** `developmentClient: true` in production profile
**Fix:** Already correct in your eas.json ✅

### Issue 2: Large Image Assets
**Check:** `assets/images/` folder size
```bash
# Compress all images
cd C:\Users\Administrator\restaurant-app\userapp
# Use tools like TinyPNG or ImageOptim
```

**Target:** Each image < 200KB, splash screen < 500KB

### Issue 3: Unused Dependencies
**Check package.json for unused packages:**
```bash
# These might be too heavy:
- firebase-admin (only needed server-side)
- leaflet (web-only, remove if not used)
- @types/* (dev dependencies, move to devDependencies)
```

### Issue 4: Building from Wrong Directory
**CRITICAL:** Make sure you're building from EACH app folder:

```bash
# ✅ CORRECT - Build USERAPP
cd C:\Users\Administrator\restaurant-app\userapp
eas build --platform android --profile production

# ✅ CORRECT - Build DELIVERAPP  
cd C:\Users\Administrator\restaurant-app\deliverapp
eas build --platform android --profile production

# ✅ CORRECT - Build ADMINS-APP
cd C:\Users\Administrator\restaurant-app\admins-app
eas build --platform android --profile production
```

**❌ WRONG:** Don't build from `restaurant-app` root!

## Step 3: Optimize Package.json

### Move dev dependencies:
```json
{
  "devDependencies": {
    "@babel/plugin-proposal-decorators": "^7.29.0",
    "@expo/cli": "^54.0.23",
    "@expo/ngrok": "^4.1.3",
    "@types/react": "~19.1.0",
    "typescript": "~5.9.2"
  }
}
```

### Remove unused heavy packages:
```bash
# Check if these are actually used:
- firebase-admin (12MB+) - Only needed server-side
- leaflet (5MB+) - Web-only mapping library
```

## Step 4: Build with Size Optimization

### Clean build:
```bash
cd C:\Users\Administrator\restaurant-app\userapp

# Clean node_modules and build cache
rm -rf node_modules
npm cache clean --force
npm install

# Build production APK
eas build --platform android --profile production
```

## Step 5: Expected Sizes

| Component | Size |
|-----------|------|
| React Native Runtime | ~20MB |
| Your Code | ~5-10MB |
| Dependencies | ~10-15MB |
| Assets (images) | ~5-10MB |
| **TOTAL** | **40-55MB** |

## Step 6: If Still Large (>80MB)

### Check build logs for:
1. **Duplicate dependencies** - Same package multiple versions
2. **Large native libraries** - FFmpeg, ML kits, etc.
3. **Unoptimized images** - PNGs > 1MB

### Run size analysis:
```bash
# After build, download APK and analyze
java -jar bundletool.jar get-size total --apks=your-app.apk
```

## Quick Fix Commands

```bash
# USERAPP - Clean and rebuild
cd C:\Users\Administrator\restaurant-app\userapp
rm -rf node_modules android ios
npm install
eas build --platform android --profile production

# DELIVERAPP - Clean and rebuild
cd C:\Users\Administrator\restaurant-app\deliverapp
rm -rf node_modules android ios
npm install
eas build --platform android --profile production

# ADMINS-APP - Clean and rebuild
cd C:\Users\Administrator\restaurant-app\admins-app
rm -rf node_modules android ios
npm install
eas build --platform android --profile production
```

## Verify Build is Production

After build, check APK info:
```bash
# Production APK should show:
- build-type: release
- debuggable: false
- minified: true
```

If it shows `debuggable: true`, you're building development builds!
