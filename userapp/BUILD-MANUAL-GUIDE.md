# AYAR Food Delivery - Manual Android Build Guide

This guide explains how to build signed APK and AAB files **locally** without using EAS Build, avoiding caching issues and giving you full control over the build process.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step 1: Generate Keystore](#step-1-generate-keystore)
4. [Step 2: Configure Signing](#step-2-configure-signing)
5. [Step 3: Apply Gradle Configuration](#step-3-apply-gradle-configuration)
6. [Step 4: Build APK](#step-4-build-apk)
7. [Step 5: Build AAB](#step-5-build-aab)
8. [Security Best Practices](#security-best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Overview

### Why Build Locally?

- **No Caching Issues**: What you build is exactly what's in your code
- **Full Control**: Complete control over signing and build configuration
- **Faster Iteration**: No waiting for EAS build queue
- **Offline Capable**: Build without internet connection
- **Cost Free**: No EAS build credits required

### Build Outputs

| Format | Location | Use Case |
|--------|----------|----------|
| **APK** | `android/app/build/outputs/apk/release/app-release.apk` | Direct distribution, sideloading |
| **AAB** | `android/app/build/outputs/bundle/release/app-release.aab` | Google Play Store upload |

---

## Prerequisites

Before you begin, ensure you have:

- ✅ **Java JDK 17** installed (required for Android builds)
- ✅ **Android Studio** (for Gradle and build tools)
- ✅ **Node.js** and **npm** installed
- ✅ **Expo CLI** installed globally (`npm install -g expo-cli`)
- ✅ **Environment variables** set:
  - `ANDROID_HOME` pointing to Android SDK
  - `JAVA_HOME` pointing to Java JDK

### Verify Installation

```bash
# Check Java
java -version

# Check Gradle (will be downloaded if not present)
cd android
./gradlew --version  # Linux/Mac
gradlew --version    # Windows
```

---

## Step 1: Generate Keystore

The keystore is your app's digital signature. **Keep it safe!**

### Option A: Use the Script (Recommended)

**Windows:**
```bash
.\generate-keystore.bat
```

**Linux/Mac:**
```bash
chmod +x generate-keystore.sh
./generate-keystore.sh
```

### Option B: Manual Generation

```bash
keytool -genkey -v \
  -keystore ./android/my-release-key.keystore \
  -alias ayar-food-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

### During Generation, You'll Be Asked:

1. **Keystore password** - Choose a strong password
2. **Your name** - Your name or company name
3. **Organizational unit** - e.g., "Development"
4. **Organization** - e.g., "AYAR"
5. **City** - Your city
6. **State/Province** - Your state/province
7. **Country code** - Two-letter country code (e.g., US, GB, AF)
8. **Confirm password** - Re-enter the keystore password

### ⚠️ CRITICAL: Backup Your Keystore!

**Store these in a secure location (password manager, encrypted drive, etc.):**

- `android/my-release-key.keystore` - The keystore file
- Keystore password
- Key alias (default: `ayar-food-key`)
- Key password

**If you lose the keystore, you CANNOT update your app on Google Play!**

---

## Step 2: Configure Signing

### 2.1 Create the Properties File

Edit `android/release-signing.properties`:

```properties
MYAPP_RELEASE_STORE_FILE=my-release-key.keystore
MYAPP_RELEASE_KEY_ALIAS=ayar-food-key
MYAPP_RELEASE_STORE_PASSWORD=your_actual_password_here
MYAPP_RELEASE_KEY_PASSWORD=your_actual_password_here
```

### 2.2 Verify .gitignore

The `.gitignore` file already includes:

```gitignore
# Android signing (keep secrets local)
android/release-signing.properties
*.keystore
```

**Never commit these files to GitHub!**

---

## Step 3: Apply Gradle Configuration

After running `prebuild`, you need to configure `android/app/build.gradle`.

### 3.1 Run Prebuild

```bash
npx expo prebuild --platform android --clean
```

### 3.2 Edit build.gradle

Open `android/app/build.gradle` and find the `android { }` block.

**Add the signing properties loader at the TOP** (after imports):

```gradle
def signingPropsFile = rootProject.file('../release-signing.properties')
def signingProps = new Properties()

if (signingPropsFile.exists()) {
    signingProps.load(new FileInputStream(signingPropsFile))
}
```

**Add/modify the `signingConfigs` block:**

```gradle
android {
    namespace "com.ayar.food"
    
    signingConfigs {
        release {
            if (signingPropsFile.exists()) {
                storeFile file(signingProps['MYAPP_RELEASE_STORE_FILE'])
                storePassword signingProps['MYAPP_RELEASE_STORE_PASSWORD']
                keyAlias signingProps['MYAPP_RELEASE_KEY_ALIAS']
                keyPassword signingProps['MYAPP_RELEASE_KEY_PASSWORD']
            }
        }
    }
    
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.release  // <-- This line is critical!
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
    // ... rest of config
}
```

### 3.3 Save and Verify

Save the file. The signing configuration is now applied.

---

## Step 4: Build APK

### Option A: Use the Build Script

**Windows:**
```bash
.\build-apk.bat
```

**Linux/Mac:**
```bash
chmod +x build-apk.sh
./build-apk.sh
```

### Option B: Manual Build

```bash
# Step 1: Prebuild
npx expo prebuild --platform android --clean

# Step 2: Apply Gradle configuration (see Step 3)

# Step 3: Build
cd android
./gradlew assembleRelease  # Linux/Mac
gradlew assembleRelease    # Windows

# Step 4: Find your APK
# Location: android/app/build/outputs/apk/release/app-release.apk
```

### Install APK on Device

```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

---

## Step 5: Build AAB (Google Play Store)

### Option A: Use the Build Script

**Windows:**
```bash
.\build-aab.bat
```

**Linux/Mac:**
```bash
chmod +x build-aab.sh
./build-aab.sh
```

### Option B: Manual Build

```bash
# Step 1: Prebuild
npx expo prebuild --platform android --clean

# Step 2: Apply Gradle configuration (see Step 3)

# Step 3: Build AAB
cd android
./gradlew bundleRelease  # Linux/Mac
gradlew bundleRelease    # Windows

# Step 4: Find your AAB
# Location: android/app/build/outputs/bundle/release/app-release.aab
```

### Upload to Google Play

1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app
3. Go to "Production" or "Internal testing"
4. Click "Create new release"
5. Upload the `app-release.aab` file
6. Fill in release notes
7. Submit for review

---

## Security Best Practices

### 🔒 Protect Your Keystore

1. **Backup immediately** to multiple secure locations:
   - Encrypted USB drive
   - Password manager (for passwords)
   - Secure cloud storage (encrypted)

2. **Never share** the keystore file publicly

3. **Use strong passwords** (16+ characters, mix of upper/lower, numbers, symbols)

4. **Document** the keystore details in a secure location:
   - Keystore location
   - Key alias
   - Passwords (use a password manager!)
   - Creation date
   - Validity period (10000 days = ~27 years)

### 🔒 Protect Your Properties File

1. **Never commit** `release-signing.properties` to Git
2. **Use templates** for team members (see `release-signing.properties.template`)
3. **Restrict file permissions** (Linux/Mac):
   ```bash
   chmod 600 android/release-signing.properties
   ```

### 🔒 Build Environment Security

1. **Keep build tools updated** (Gradle, Android SDK, Java)
2. **Use a dedicated build machine** for production releases
3. **Verify APK signatures** before distribution:
   ```bash
   jarsigner -verify -verbose -certs app-release.apk
   ```

---

## Troubleshooting

### Error: "Keystore file not found"

**Solution:**
```bash
# Verify keystore exists
ls -la android/my-release-key.keystore  # Linux/Mac
dir android\my-release-key.keystore    # Windows

# If missing, regenerate
./generate-keystore.sh  # or generate-keystore.bat
```

### Error: "Signing failed with error 1"

**Possible causes:**
- Wrong password in `release-signing.properties`
- Corrupted keystore file
- Incorrect key alias

**Solution:**
1. Verify passwords in `release-signing.properties`
2. Test keystore:
   ```bash
   keytool -list -v -keystore android/my-release-key.keystore -alias ayar-food-key
   ```

### Error: "Gradle build failed"

**Solution:**
```bash
# Clean and rebuild
cd android
./gradlew clean
cd ..
npx expo prebuild --platform android --clean
./build-apk.sh  # or build-apk.bat
```

### Error: "Java not found" or "JAVA_HOME not set"

**Solution:**

**Windows:**
```powershell
# Set JAVA_HOME (adjust path to your Java installation)
setx JAVA_HOME "C:\Program Files\Java\jdk-17"
setx PATH "%JAVA_HOME%\bin;%PATH%"
```

**Linux/Mac:**
```bash
# Add to ~/.bashrc or ~/.zshrc
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk
export PATH=$JAVA_HOME/bin:$PATH
```

### Error: "ANDROID_HOME not set"

**Solution:**

**Windows:**
```powershell
setx ANDROID_HOME "%LOCALAPPDATA%\Android\Sdk"
```

**Linux/Mac:**
```bash
# Add to ~/.bashrc or ~/.zshrc
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools:$PATH
```

### APK Installs But Shows "App Not Installed"

**Cause:** Signing key mismatch (app was previously installed with different key)

**Solution:**
1. Uninstall the old app from device
2. Install the new APK
3. Ensure you're using the same keystore for all releases

### Build Uses Wrong Signing Config

**Solution:**
1. Verify `build.gradle` has `signingConfig signingConfigs.release` in the `release` build type
2. Verify `release-signing.properties` has correct values
3. Clean and rebuild:
   ```bash
   cd android
   ./gradlew clean
   cd ..
   ./build-apk.sh
   ```

---

## Quick Reference

### Build Commands

| Command | Description |
|---------|-------------|
| `./generate-keystore.sh` | Generate new keystore (run once) |
| `./build-apk.sh` | Build signed APK |
| `./build-aab.sh` | Build signed AAB for Play Store |
| `npx expo prebuild --platform android --clean` | Regenerate native Android code |

### File Locations

| File | Location | Purpose |
|------|----------|---------|
| Keystore | `android/my-release-key.keystore` | App signing key |
| Signing config | `android/release-signing.properties` | Build credentials |
| APK output | `android/app/build/outputs/apk/release/` | Final APK |
| AAB output | `android/app/build/outputs/bundle/release/` | Play Store bundle |
| Gradle config | `android/app/build.gradle` | Build configuration |

---

## Need Help?

- Check the [Expo Documentation](https://docs.expo.dev/build-reference/apk/)
- Review [Android Sign Your App](https://developer.android.com/studio/publish/app-signing)
- Check build logs in `android/app/build/outputs/logs/`

---

**Last Updated:** March 29, 2026  
**App Version:** 1.0.3  
**Package:** com.ayar.food
